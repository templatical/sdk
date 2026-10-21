import {
  applyOperations,
  OperationError,
  safeClone,
  type Block,
  type BlockLock,
  type BlockLockHolder,
  type CollaborationActor,
  type CollaborationConflictCode,
  type CollaborationMember,
  type OperationBatch,
  type OperationsAfterResult,
  type RevisionedBatch,
  type Template,
  type TemplateContent,
} from "@templatical/types";

/**
 * An in-memory collaboration backend for the "Collaboration (BYO)" scene: the
 * public `CollaborationProvider` contract implemented on the TypeScript
 * engine, the way a self-hosted backend would. It knows nothing about
 * transport; `shared.worker.ts` runs one instance for every tab.
 *
 * It mirrors Templatical Cloud's rules (the S6 cross-track contract): batches
 * apply in order and all or nothing, a repeated `batchId` answers with its
 * revision, locks belong to a session and an identity together, and a batch
 * broadcast that would be larger than 8,000 bytes goes out as a re-sync.
 */

/** Presence colours, in Templatical Cloud's order. */
export const COLLABORATION_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#6366f1",
  "#14b8a6",
] as const;

/** A lock lasts this long unless renewed; editors renew every 10 s. */
export const LOCK_TTL_MS = 30_000;

/** A session that sent no heartbeat for this long has left. */
export const MEMBER_TTL_MS = 15_000;

/** Batches kept for `operationsAfter`; an older revision gets a re-sync. */
export const LOG_LIMIT = 200;

/** Batches per submit, as Cloud allows. */
export const MAX_OPS_PER_BATCH = 100;

/**
 * A batch whose broadcast, JSON-encoded twice as it travels in a Pusher
 * request body, is larger than this goes out as a re-sync instead.
 */
export const BROADCAST_MAX_BYTES = 8000;

export interface SessionUser {
  id: string;
  name: string;
  avatarUrl?: string;
}

/** Who calls: the editor's session, and the signed-in user, if any. */
export interface SessionIdentity {
  sessionId: string;
  user: SessionUser | null;
}

/** What the server pushes to one session. */
export type ServerEvent =
  | { type: "batch"; batch: RevisionedBatch }
  | { type: "resync"; revision: number; actor: CollaborationActor }
  | { type: "lock"; lock: BlockLock }
  | { type: "unlock"; blockId: string; sessionId: string }
  | { type: "members"; members: CollaborationMember[] };

/** A refusal, as plain data, so it crosses a worker's message port. */
export interface Refusal {
  status: number;
  code: CollaborationConflictCode;
  message: string;
  opIndex?: number;
  holder?: BlockLockHolder;
  holders?: BlockLockHolder[];
}

export class RefusedError extends Error {
  constructor(readonly refusal: Refusal) {
    super(refusal.message);
    this.name = "RefusedError";
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** CRC-32 of the UTF-8 bytes, as PHP's `crc32()` computes it. */
export function crc32(text: string): number {
  let crc = 0xffffffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** A person's colour: the same on every screen, as Cloud picks it. */
export function colorFor(identity: string): string {
  return COLLABORATION_COLORS[crc32(identity) % COLLABORATION_COLORS.length];
}

/** The user id, or `guest:<sessionId>` without a user. */
export function identityOf(who: SessionIdentity): string {
  return who.user ? who.user.id : `guest:${who.sessionId}`;
}

/** Who owns a lock: the session and the identity together. */
function ownerOf(who: SessionIdentity): string {
  return `${who.sessionId}|${identityOf(who)}`;
}

function holderOf(who: SessionIdentity): BlockLockHolder {
  const identity = identityOf(who);
  return {
    sessionId: who.sessionId,
    type: who.user ? "user" : "guest",
    id: identity,
    name: who.user?.name ?? "Guest",
    color: colorFor(identity),
  };
}

function memberOf(who: SessionIdentity): CollaborationMember {
  return {
    sessionId: who.sessionId,
    userId: who.user?.id ?? null,
    name: who.user?.name ?? "Guest",
    type: who.user ? "user" : "guest",
    ...(who.user?.avatarUrl ? { avatarUrl: who.user.avatarUrl } : {}),
    color: colorFor(identityOf(who)),
  };
}

/**
 * Who made a batch. A batch an AI turn produced (`origin: "ai"`, BY9) is the
 * `ai` actor for the same person and session, so other editors name it
 * "AI (for Ada)" and the one that asked shows only its outline.
 */
function actorOf(
  who: SessionIdentity,
  origin?: OperationBatch["origin"],
): CollaborationActor {
  return {
    type: origin === "ai" ? "ai" : who.user ? "user" : "guest",
    id: identityOf(who),
    name: who.user?.name ?? "Guest",
    sessionId: who.sessionId,
  };
}

function hasBlock(blocks: readonly Block[], blockId: string): boolean {
  return blocks.some(
    (block) =>
      block.id === blockId ||
      (block.type === "section" &&
        block.children.some((column) => hasBlock(column, blockId))),
  );
}

function refuse(refusal: Refusal): never {
  throw new RefusedError(refusal);
}

interface HeldLock {
  lock: BlockLock;
  owner: string;
  expiresAt: number;
}

interface Member {
  member: CollaborationMember;
  seenAt: number;
}

interface TemplateState {
  id: string;
  name?: string;
  content: TemplateContent;
  revision: number;
  log: RevisionedBatch[];
  batchRevisions: Map<string, number>;
  locks: Map<string, HeldLock>;
  members: Map<string, Member>;
}

export type DeliverEvent = (sessionId: string, event: ServerEvent) => void;

export class SharedCollaborationServer {
  private readonly templates = new Map<string, TemplateState>();

  constructor(
    private readonly deliver: DeliverEvent,
    private readonly now: () => number = Date.now,
  ) {}

  /** The template, created from `seed` the first time anyone opens it. */
  load(templateId: string, seed: TemplateContent): Template {
    const state = this.stateOf(templateId, seed);
    return {
      id: state.id,
      ...(state.name !== undefined ? { name: state.name } : {}),
      revision: state.revision,
      content: safeClone(state.content),
      locks: this.liveLocks(state).map((held) => held.lock),
    };
  }

  /** Saves only rename: content arrives as operations. */
  rename(templateId: string, name: string | undefined): Template {
    const state = this.existing(templateId);
    if (name !== undefined) state.name = name;
    return this.load(templateId, state.content);
  }

  join(
    templateId: string,
    who: SessionIdentity,
  ): { revision: number; locks: BlockLock[]; members: CollaborationMember[] } {
    const state = this.existing(templateId);
    this.sweepState(state);
    state.members.set(who.sessionId, {
      member: memberOf(who),
      seenAt: this.now(),
    });
    this.broadcastMembers(state, who.sessionId);
    return {
      revision: state.revision,
      locks: this.liveLocks(state).map((held) => held.lock),
      members: this.membersOf(state),
    };
  }

  leave(templateId: string, sessionId: string): void {
    const state = this.templates.get(templateId);
    if (!state || !state.members.delete(sessionId)) return;
    for (const [blockId, held] of state.locks) {
      if (held.lock.holder.sessionId === sessionId) {
        state.locks.delete(blockId);
        this.broadcast(state, sessionId, {
          type: "unlock",
          blockId,
          sessionId,
        });
      }
    }
    this.broadcastMembers(state, sessionId);
  }

  heartbeat(templateId: string, sessionId: string): void {
    const member = this.templates.get(templateId)?.members.get(sessionId);
    if (member) member.seenAt = this.now();
  }

  /** Let sessions that stopped sending heartbeats go, and expired locks lapse. */
  sweep(): void {
    for (const state of this.templates.values()) this.sweepState(state);
  }

  submit(
    templateId: string,
    who: SessionIdentity,
    batch: OperationBatch,
  ): { revision: number } {
    const state = this.existing(templateId);
    this.sweepState(state);
    const known = state.batchRevisions.get(batch.batchId);
    if (known !== undefined) return { revision: known };
    if (
      !Array.isArray(batch.ops) ||
      batch.ops.length === 0 ||
      batch.ops.length > MAX_OPS_PER_BATCH
    ) {
      refuse({
        status: 422,
        code: "invalid_operation",
        message: `A batch holds 1 to ${MAX_OPS_PER_BATCH} operations.`,
      });
    }

    const locks = this.liveLocks(state);
    const owner = ownerOf(who);
    let content: TemplateContent;
    try {
      content = applyOperations(state.content, batch.ops, {
        locks: locks.map((held) => ({
          blockId: held.lock.blockId,
          sessionId: held.owner,
        })),
        session: owner,
      });
    } catch (error) {
      if (!(error instanceof OperationError)) throw error;
      const others = locks.filter((held) => held.owner !== owner);
      return refuse({
        status: error.code === "invalid_operation" ? 422 : 409,
        code: error.code,
        message: error.message,
        opIndex: error.opIndex,
        ...(error.code === "lock_held"
          ? {
              holder: others.find((held) => held.lock.blockId === error.blockId)
                ?.lock.holder,
            }
          : {}),
        ...(error.code === "locked_by_others"
          ? { holders: others.map((held) => held.lock.holder) }
          : {}),
      });
    }

    state.content = content;
    state.revision += 1;
    const entry: RevisionedBatch = {
      revision: state.revision,
      batchId: batch.batchId,
      actor: actorOf(who, batch.origin),
      ops: batch.ops,
      createdAt: new Date(this.now()).toISOString(),
    };
    state.log.push(entry);
    if (state.log.length > LOG_LIMIT) state.log.shift();
    state.batchRevisions.set(batch.batchId, state.revision);

    const replaced = batch.ops.some((op) => op.op === "setContent");
    const payload = {
      revision: entry.revision,
      batchId: entry.batchId,
      actor: entry.actor,
      ops: entry.ops,
    };
    const size = new TextEncoder().encode(
      JSON.stringify(JSON.stringify(payload)),
    ).length;
    this.broadcast(
      state,
      who.sessionId,
      replaced || size > BROADCAST_MAX_BYTES
        ? { type: "resync", revision: state.revision, actor: entry.actor }
        : { type: "batch", batch: safeClone(entry) },
    );
    return { revision: state.revision };
  }

  operationsAfter(templateId: string, after: number): OperationsAfterResult {
    const state = this.existing(templateId);
    if (after >= state.revision)
      return { revision: state.revision, batches: [] };
    const oldest = state.log[0];
    if (!oldest || after < oldest.revision - 1) {
      return { revision: state.revision, resync: true };
    }
    return {
      revision: state.revision,
      batches: safeClone(state.log.filter((batch) => batch.revision > after)),
    };
  }

  acquireLock(
    templateId: string,
    who: SessionIdentity,
    blockId: string,
  ): BlockLock {
    const state = this.existing(templateId);
    this.sweepState(state);
    if (!hasBlock(state.content.blocks, blockId)) {
      refuse({
        status: 409,
        code: "block_missing",
        message: "That block isn't in the template.",
      });
    }
    const owner = ownerOf(who);
    const existing = state.locks.get(blockId);
    if (existing && existing.owner !== owner) {
      refuse({
        status: 409,
        code: "lock_held",
        message: "Someone else is editing this block.",
        holder: existing.lock.holder,
      });
    }
    // One lock per session: taking a block lets go of the one held before.
    for (const [heldId, held] of state.locks) {
      if (held.owner === owner && heldId !== blockId) {
        state.locks.delete(heldId);
        this.broadcast(state, who.sessionId, {
          type: "unlock",
          blockId: heldId,
          sessionId: who.sessionId,
        });
      }
    }
    const held = this.hold(blockId, who);
    state.locks.set(blockId, held);
    if (!existing) {
      this.broadcast(state, who.sessionId, { type: "lock", lock: held.lock });
    }
    return held.lock;
  }

  renewLock(
    templateId: string,
    who: SessionIdentity,
    blockId: string,
  ): BlockLock {
    const state = this.existing(templateId);
    this.sweepState(state);
    const existing = state.locks.get(blockId);
    if (!existing || existing.owner !== ownerOf(who)) {
      refuse({
        status: 409,
        code: "lock_lost",
        message: "You no longer hold the lock on this block.",
      });
    }
    // Renewals aren't broadcast.
    const held = this.hold(blockId, who);
    state.locks.set(blockId, held);
    return held.lock;
  }

  releaseLock(templateId: string, who: SessionIdentity, blockId: string): void {
    const state = this.templates.get(templateId);
    const existing = state?.locks.get(blockId);
    if (!state || !existing || existing.owner !== ownerOf(who)) return;
    state.locks.delete(blockId);
    this.broadcast(state, who.sessionId, {
      type: "unlock",
      blockId,
      sessionId: who.sessionId,
    });
  }

  private hold(blockId: string, who: SessionIdentity): HeldLock {
    const expiresAt = this.now() + LOCK_TTL_MS;
    return {
      lock: {
        blockId,
        holder: holderOf(who),
        expiresAt: new Date(expiresAt).toISOString(),
      },
      owner: ownerOf(who),
      expiresAt,
    };
  }

  private stateOf(templateId: string, seed: TemplateContent): TemplateState {
    let state = this.templates.get(templateId);
    if (!state) {
      state = {
        id: templateId,
        content: safeClone(seed),
        revision: 0,
        log: [],
        batchRevisions: new Map(),
        locks: new Map(),
        members: new Map(),
      };
      this.templates.set(templateId, state);
    }
    return state;
  }

  private existing(templateId: string): TemplateState {
    const state = this.templates.get(templateId);
    if (!state) {
      throw new Error(
        `[playground] Template "${templateId}" was never loaded.`,
      );
    }
    return state;
  }

  private liveLocks(state: TemplateState): HeldLock[] {
    const now = this.now();
    return [...state.locks.values()].filter((held) => held.expiresAt > now);
  }

  private membersOf(state: TemplateState): CollaborationMember[] {
    return [...state.members.values()].map((entry) => entry.member);
  }

  private sweepState(state: TemplateState): void {
    const now = this.now();
    for (const [sessionId, entry] of state.members) {
      if (now - entry.seenAt > MEMBER_TTL_MS) this.leave(state.id, sessionId);
    }
    for (const [blockId, held] of state.locks) {
      if (held.expiresAt <= now) {
        state.locks.delete(blockId);
        this.broadcast(state, null, {
          type: "unlock",
          blockId,
          sessionId: held.lock.holder.sessionId,
        });
      }
    }
  }

  private broadcast(
    state: TemplateState,
    except: string | null,
    event: ServerEvent,
  ): void {
    for (const sessionId of state.members.keys()) {
      if (sessionId !== except) this.deliver(sessionId, event);
    }
  }

  private broadcastMembers(state: TemplateState, except: string): void {
    this.broadcast(state, except, {
      type: "members",
      members: this.membersOf(state),
    });
  }
}
