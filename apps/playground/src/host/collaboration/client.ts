import {
  CollaborationConflict,
  type BlockLock,
  type CollaborationHandlers,
  type CollaborationMember,
  type CollaborationProvider,
  type EditorUser,
  type OperationsAfterResult,
  type Template,
  type TemplateContent,
  type TemplatesProvider,
} from "@templatical/types";
import type { Refusal, ServerEvent, SessionIdentity } from "./server";
import type { WorkerRequest } from "./shared.worker";

/** How often a joined tab tells the worker it is still there. */
const HEARTBEAT_MS = 5_000;

export interface SharedCollaboration {
  templates: TemplatesProvider;
  collaboration: CollaborationProvider;
}

type Answer =
  | { id: number; result: unknown }
  | { id: number; error: Partial<Refusal> & { message: string } }
  | { sessionId: string; event: ServerEvent };

/**
 * The tab's side of the playground's shared backend: a templates provider and
 * a collaboration provider that talk to `shared.worker.ts`. Every tab that
 * opens the scene joins the same template there.
 */
export function createSharedCollaboration(options: {
  user: EditorUser | null;
  seed: () => TemplateContent;
}): SharedCollaboration {
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  const handlers = new Map<string, CollaborationHandlers>();
  let port: MessagePort | null = null;
  let nextId = 1;
  let joined: { templateId: string; sessionId: string } | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  /**
   * The worker starts on the first request, not here: building the scene's
   * config (which the playground's unit tests do in Node) starts nothing.
   */
  function connect(): MessagePort {
    if (port) return port;
    if (typeof SharedWorker === "undefined") {
      throw new Error(
        "This setup runs its backend in a SharedWorker, which this browser doesn't support.",
      );
    }
    const worker = new SharedWorker(
      new URL("./shared.worker.ts", import.meta.url),
      { type: "module", name: "templatical-collaboration" },
    );
    port = worker.port;
    port.onmessage = (message: MessageEvent<Answer>) => {
      const answer = message.data;
      if ("event" in answer) {
        dispatch(answer.sessionId, answer.event);
        return;
      }
      const request = pending.get(answer.id);
      if (!request) return;
      pending.delete(answer.id);
      if ("error" in answer) request.reject(toError(answer.error));
      else request.resolve(answer.result);
    };
    port.start();
    window.addEventListener("pagehide", leave);
    return port;
  }

  function call<T>(
    method: WorkerRequest["method"],
    ...args: WorkerRequest["args"]
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const target = connect();
      const id = nextId++;
      pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      target.postMessage({ id, method, args });
    });
  }

  /** A refusal as the editor reads it: `code`, `holder` and `holders`. */
  function toError(error: Partial<Refusal> & { message: string }): Error {
    if (!error.code) return new Error(error.message);
    return new CollaborationConflict(error.message, {
      code: error.code,
      ...(error.status !== undefined ? { status: error.status } : {}),
      ...(error.opIndex !== undefined ? { opIndex: error.opIndex } : {}),
      ...(error.holder ? { holder: error.holder } : {}),
      ...(error.holders ? { holders: error.holders } : {}),
    });
  }

  function dispatch(sessionId: string, event: ServerEvent): void {
    const handler = handlers.get(sessionId);
    if (!handler) return;
    switch (event.type) {
      case "batch":
        return handler.onBatch(event.batch);
      case "resync":
        return handler.onResync(event.revision, event.actor);
      case "lock":
        return handler.onLock(event.lock);
      case "unlock":
        return handler.onUnlock(event.blockId, event.sessionId);
      case "members":
        return handler.onMembers(event.members);
    }
  }

  function identity(sessionId: string): SessionIdentity {
    return {
      sessionId,
      user: options.user
        ? { id: options.user.id, name: options.user.name }
        : null,
    };
  }

  /** The joined session: every request after `join` acts as it. */
  function me(): SessionIdentity {
    if (!joined) throw new Error("[playground] Join a template first.");
    return identity(joined.sessionId);
  }

  function leave(): void {
    if (!joined) return;
    void call("leave", joined.templateId, joined.sessionId);
    handlers.delete(joined.sessionId);
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    joined = null;
  }

  const collaboration: CollaborationProvider = {
    async join(templateId, session, sessionHandlers) {
      if (
        joined &&
        (joined.templateId !== templateId ||
          joined.sessionId !== session.sessionId)
      ) {
        leave();
      }
      const current = { templateId, sessionId: session.sessionId };
      joined = current;
      handlers.set(session.sessionId, sessionHandlers);
      const result = await call<{
        revision: number;
        locks: BlockLock[];
        members: CollaborationMember[];
      }>("join", templateId, identity(session.sessionId));
      heartbeat ??= setInterval(() => {
        if (joined) void call("heartbeat", joined.templateId, joined.sessionId);
      }, HEARTBEAT_MS);
      return {
        ...result,
        leave: () => {
          // A later join replaced this one: there is nothing of it to leave.
          if (joined === current) leave();
        },
      };
    },
    // Async, so a request made before `join` rejects rather than throws.
    submit: async (templateId, batch) =>
      call("submit", templateId, me(), batch),
    operationsAfter: async (templateId, revision) =>
      call<OperationsAfterResult>("operationsAfter", templateId, revision),
    acquireLock: async (templateId, blockId) =>
      call("acquireLock", templateId, me(), blockId),
    renewLock: async (templateId, blockId) =>
      call("renewLock", templateId, me(), blockId),
    releaseLock: async (templateId, blockId) =>
      call("releaseLock", templateId, me(), blockId),
  };

  const templates: TemplatesProvider = {
    load: (id) => call<Template>("load", id, options.seed()),
    create: false,
    // Content arrives as operations; a save only renames.
    save: (id, patch) => call<Template>("rename", id, patch.name),
  };

  return { templates, collaboration };
}
