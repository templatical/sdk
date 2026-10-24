import { SdkError } from "./config";
import type { Operation, OperationErrorCode } from "./operations";

/** A batch an editor submits. */
export interface OperationBatch {
  /** A UUID the editor generates; resubmitting the same id applies it once. */
  batchId: string;
  /** The last revision the editor had confirmed when it sent the batch. */
  baseRevision: number;
  /** 1–100 operations, applied in order and all or nothing. */
  ops: Operation[];
  /**
   * `"ai"` when an AI turn produced the batch: the editor applied the
   * operations an `AiProvider` handed it. A backend may broadcast the batch
   * with `actor.type: "ai"` (the same user and session), and the other
   * editors then name it "AI (for Ada)". Absent on every other batch.
   */
  origin?: "ai";
}

/** Who made a change. */
export interface CollaborationActor {
  type: "user" | "guest" | "mcp" | "api" | "ai";
  /**
   * The user id, `guest:{sessionId}` for a guest, `null` for `api`. For `mcp`,
   * the id of the user the agent acts for; for `ai`, of the user who asked.
   */
  id: string | null;
  /** For `mcp` and `ai`, the name of the user the agent or the AI acts for. */
  name: string;
  /**
   * `null` when no editor session made the change (`api`, `mcp`). For `ai`,
   * the session that asked: that editor shows the outline and no notice.
   */
  sessionId: string | null;
  /**
   * For `mcp` only: the agent's name (`Claude`, `Cursor`, …). The editor names
   * it in the notice it shows for the batch ("Claude for Ada changed 3
   * blocks"), as text. A backend that lets agents edit sends it with every
   * agent batch, broadcast and catch-up alike.
   */
  client?: string;
}

/** A batch as the backend applied it, at the revision it produced. */
export interface RevisionedBatch {
  revision: number;
  batchId: string;
  actor: CollaborationActor;
  ops: Operation[];
  createdAt?: string;
}

/** One editor session with the template open. */
export interface CollaborationMember {
  sessionId: string;
  /** `null` for a guest. */
  userId: string | null;
  name: string;
  type: "user" | "guest";
  avatarUrl?: string;
  /** A CSS colour the backend picks, so it is the same on every screen. */
  color: string;
}

/** Who holds a lock. */
export interface BlockLockHolder {
  sessionId: string;
  type: "user" | "guest" | "mcp";
  /** The user id, or `guest:{sessionId}`. */
  id: string;
  name: string;
  color: string;
}

/** A block one session holds. */
export interface BlockLock {
  blockId: string;
  holder: BlockLockHolder;
  /**
   * ISO 8601. Renewals aren't broadcast, so another session's lock is dropped
   * when it is released or its session leaves, never by this time.
   */
  expiresAt: string;
}

/** Why a backend refused a batch or a lock. */
export type CollaborationConflictCode =
  OperationErrorCode | "lock_lost" | "content_too_large";

function defaultStatus(code: CollaborationConflictCode): number {
  if (code === "invalid_operation") return 422;
  if (code === "content_too_large") return 413;
  return 409;
}

/**
 * A refusal from a collaboration backend. `submit` rejects with one when the
 * batch conflicts (409, or 422 for `invalid_operation`) or is too large (413,
 * `content_too_large`), `acquireLock` with `lock_held`, `renewLock` with
 * `lock_lost`. The editor reads only `code`, `holder` and `holders`, so any
 * error carrying those works the same.
 */
export class CollaborationConflict extends SdkError {
  declare readonly code: CollaborationConflictCode;
  /** The operation the backend refused, for a refused batch. */
  readonly opIndex?: number;
  /** Who holds the block, for `lock_held`. */
  readonly holder?: BlockLockHolder;
  /** Who holds locks, for `locked_by_others`. */
  readonly holders?: BlockLockHolder[];

  constructor(
    message: string,
    details: {
      code: CollaborationConflictCode;
      status?: number;
      opIndex?: number;
      holder?: BlockLockHolder;
      holders?: BlockLockHolder[];
    },
  ) {
    super(message, details.status ?? defaultStatus(details.code), details.code);
    this.name = "CollaborationConflict";
    if (details.opIndex !== undefined) this.opIndex = details.opIndex;
    if (details.holder !== undefined) this.holder = details.holder;
    if (details.holders !== undefined) this.holders = details.holders;
  }
}

/** The realtime connection, as the editor shows it. */
export type CollaborationConnectionState =
  "connected" | "reconnecting" | "offline";

/** What a backend calls while an editor has joined a template. */
export interface CollaborationHandlers {
  /** Another session's batch, or one this session can't attribute to itself. */
  onBatch(batch: RevisionedBatch): void;
  /**
   * The content changed in a way batches don't describe: fetch it again.
   * `actor` is who changed it, when the backend knows: the editor names an
   * agent's re-sync (`type: "mcp"`) in a notice ("Claude for Ada updated the
   * template").
   */
  onResync(revision: number, actor?: CollaborationActor): void;
  onLock(lock: BlockLock): void;
  onUnlock(blockId: string, sessionId: string): void;
  /** Everyone with the template open, this session included. */
  onMembers(members: CollaborationMember[]): void;
  onConnectionChange(state: CollaborationConnectionState): void;
}

/** What {@link CollaborationProvider.join} resolves with. */
export interface CollaborationJoin {
  /** The template's current revision. */
  revision: number;
  /** Unexpired locks. */
  locks: BlockLock[];
  /** Everyone with the template open, this session included; empty without presence. */
  members: CollaborationMember[];
  /** Stop receiving events for this template. */
  leave(): void;
}

/** What {@link CollaborationProvider.operationsAfter} resolves with. */
export type OperationsAfterResult =
  | { revision: number; batches: RevisionedBatch[] }
  | { revision: number; resync: true };

/**
 * The bring-your-own collaboration contract: ordered operations, presence and
 * block locks over your backend. Templatical Cloud is one implementation.
 *
 * `join` may be called again for the template already joined, after a
 * reconnect: answer with the current revision, locks and members without
 * subscribing twice.
 *
 * The three lock methods are optional together: a backend without them gets
 * ordered operations and no locks.
 */
export interface CollaborationProvider {
  join(
    templateId: string,
    session: { sessionId: string },
    handlers: CollaborationHandlers,
  ): Promise<CollaborationJoin>;
  submit(
    templateId: string,
    batch: OperationBatch,
  ): Promise<{ revision: number }>;
  operationsAfter(
    templateId: string,
    revision: number,
  ): Promise<OperationsAfterResult>;
  acquireLock?(templateId: string, blockId: string): Promise<BlockLock>;
  renewLock?(templateId: string, blockId: string): Promise<BlockLock>;
  releaseLock?(templateId: string, blockId: string): Promise<void>;
}

/** What `onRemoteChange` reports: a batch another session made. */
export interface CollaborationRemoteChange {
  actor: CollaborationActor;
  ops: Operation[];
}
