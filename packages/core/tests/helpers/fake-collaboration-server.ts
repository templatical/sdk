import type {
  BlockLock,
  CollaborationActor,
  CollaborationHandlers,
  CollaborationMember,
  CollaborationProvider,
  Operation,
  OperationBatch,
  RevisionedBatch,
  Template,
  TemplateContent,
  TemplatesProvider,
} from "@templatical/types";
import {
  applyOperations,
  CollaborationConflict,
  OperationError,
  safeClone,
} from "@templatical/types";

interface Client {
  name: string;
  handlers: CollaborationHandlers;
  /** Broadcasts not delivered yet; a test chooses when and in what order. */
  queue: (() => void)[];
}

/**
 * An in-memory collaboration backend for several clients, on the real engine.
 * Broadcasts queue per client until `deliver()`, so a test controls order
 * and timing.
 */
export class FakeCollaborationServer {
  readonly templateId: string;
  content: TemplateContent;
  revision = 0;
  log: RevisionedBatch[] = [];
  locks = new Map<string, BlockLock>();
  clients = new Map<string, Client>();
  batchIds = new Map<string, number>();
  /** Thrown by the next `submit`, once. */
  failNextSubmit: Error | null = null;
  submits = 0;
  /** Every batch `submit` received, in order, as sent. */
  submitted: OperationBatch[] = [];

  constructor(content: TemplateContent, templateId = "tpl-1") {
    this.content = safeClone(content);
    this.templateId = templateId;
  }

  template(): Template {
    return {
      id: this.templateId,
      revision: this.revision,
      content: safeClone(this.content),
    };
  }

  templatesProvider(): TemplatesProvider {
    return {
      load: async () => this.template(),
      create: false,
      save: async () => this.template(),
    };
  }

  members(): CollaborationMember[] {
    return [...this.clients.entries()].map(([sessionId, client]) => ({
      sessionId,
      userId: client.name.toLowerCase(),
      name: client.name,
      type: "user",
      color: "#3b82f6",
    }));
  }

  queueFor(sessionId: string): (() => void)[] {
    return this.clients.get(sessionId)!.queue;
  }

  deliver(sessionId: string): void {
    const queue = this.queueFor(sessionId);
    while (queue.length > 0) queue.shift()!();
  }

  deliverAll(): void {
    for (const sessionId of this.clients.keys()) this.deliver(sessionId);
  }

  /**
   * Apply a batch as an actor with no editor session (an agent, the API) and
   * broadcast it to every client, as a backend does for a tool call or a
   * headless request.
   */
  pushAs(actor: CollaborationActor, ops: Operation[]): RevisionedBatch {
    this.content = applyOperations(this.content, ops);
    this.revision++;
    const entry: RevisionedBatch = {
      revision: this.revision,
      batchId: `pushed-${this.revision}`,
      actor,
      ops,
    };
    this.log.push(entry);
    this.broadcast(null, (h) => h.onBatch(safeClone(entry)));
    return entry;
  }

  /**
   * Apply a batch as an actor with no editor session, and announce it with a
   * re-sync naming the actor instead of the batch. Catch-up still returns it.
   */
  resyncAs(actor: CollaborationActor, ops: Operation[]): RevisionedBatch {
    this.content = applyOperations(this.content, ops);
    this.revision++;
    const entry: RevisionedBatch = {
      revision: this.revision,
      batchId: `resynced-${this.revision}`,
      actor,
      ops,
    };
    this.log.push(entry);
    const revision = this.revision;
    this.broadcast(null, (h) => h.onResync(revision, safeClone(actor)));
    return entry;
  }

  private broadcast(
    except: string | null,
    event: (handlers: CollaborationHandlers) => void,
  ): void {
    for (const [sessionId, client] of this.clients) {
      if (sessionId !== except) client.queue.push(() => event(client.handlers));
    }
  }

  provider(name: string): CollaborationProvider {
    let sessionId: string | null = null;
    const holder = () => ({
      sessionId: sessionId!,
      type: "user" as const,
      id: name.toLowerCase(),
      name,
      color: "#ef4444",
    });
    return {
      join: async (_templateId, session, handlers) => {
        sessionId = session.sessionId;
        this.clients.set(session.sessionId, { name, handlers, queue: [] });
        this.broadcast(session.sessionId, (h) => h.onMembers(this.members()));
        return {
          revision: this.revision,
          locks: [...this.locks.values()],
          members: this.members(),
          leave: () => {
            this.clients.delete(session.sessionId);
            this.broadcast(null, (h) => h.onMembers(this.members()));
          },
        };
      },
      submit: async (_templateId, batch: OperationBatch) => {
        this.submits++;
        this.submitted.push(safeClone(batch));
        if (this.failNextSubmit) {
          const error = this.failNextSubmit;
          this.failNextSubmit = null;
          throw error;
        }
        const known = this.batchIds.get(batch.batchId);
        if (known !== undefined) return { revision: known };
        if (
          !Array.isArray(batch.ops) ||
          batch.ops.length === 0 ||
          batch.ops.length > 100
        ) {
          throw new CollaborationConflict(
            "A batch holds 1 to 100 operations.",
            {
              code: "invalid_operation",
              status: 422,
            },
          );
        }
        try {
          this.content = applyOperations(this.content, batch.ops, {
            locks: [...this.locks.values()].map((lock) => ({
              blockId: lock.blockId,
              sessionId: lock.holder.sessionId,
            })),
            session: sessionId,
          });
        } catch (error) {
          if (!(error instanceof OperationError)) throw error;
          const lock = error.blockId
            ? this.locks.get(error.blockId)
            : undefined;
          throw new CollaborationConflict(error.message, {
            code: error.code,
            opIndex: error.opIndex,
            ...(error.code === "lock_held" && lock
              ? { holder: lock.holder }
              : {}),
          });
        }
        this.revision++;
        const entry: RevisionedBatch = {
          revision: this.revision,
          batchId: batch.batchId,
          // A backend honouring `origin` (BY9) names an AI turn's batch so.
          actor: {
            type: batch.origin === "ai" ? "ai" : "user",
            id: name.toLowerCase(),
            name,
            sessionId,
          },
          ops: batch.ops,
        };
        this.log.push(entry);
        this.batchIds.set(batch.batchId, this.revision);
        this.broadcast(sessionId, (h) => h.onBatch(safeClone(entry)));
        return { revision: this.revision };
      },
      operationsAfter: async (_templateId, after) => ({
        revision: this.revision,
        batches: safeClone(this.log.filter((batch) => batch.revision > after)),
      }),
      acquireLock: async (_templateId, blockId) => {
        const existing = this.locks.get(blockId);
        if (existing && existing.holder.sessionId !== sessionId) {
          throw new CollaborationConflict("Held", {
            code: "lock_held",
            holder: existing.holder,
          });
        }
        for (const [id, lock] of [...this.locks]) {
          if (lock.holder.sessionId === sessionId && id !== blockId) {
            this.locks.delete(id);
            this.broadcast(sessionId, (h) => h.onUnlock(id, sessionId!));
          }
        }
        const lock: BlockLock = {
          blockId,
          holder: holder(),
          expiresAt: "2026-10-19T12:00:30.000Z",
        };
        this.locks.set(blockId, lock);
        this.broadcast(sessionId, (h) => h.onLock(lock));
        return lock;
      },
      renewLock: async (_templateId, blockId) => {
        const existing = this.locks.get(blockId);
        if (!existing || existing.holder.sessionId !== sessionId) {
          throw new CollaborationConflict("Lost", { code: "lock_lost" });
        }
        return existing;
      },
      releaseLock: async (_templateId, blockId) => {
        const existing = this.locks.get(blockId);
        if (existing?.holder.sessionId !== sessionId) return;
        this.locks.delete(blockId);
        this.broadcast(sessionId, (h) => h.onUnlock(blockId, sessionId!));
      },
    };
  }
}
