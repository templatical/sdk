import type { Operation, OperationErrorCode } from "@templatical/types";

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

export interface RevisionedBatch {
  revision: number;
  batchId: string;
  actor: CollaborationActor;
  ops: Operation[];
  createdAt?: string;
}

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

export interface BlockLockHolder {
  sessionId: string;
  type: "user" | "guest" | "mcp";
  /** The user id, or `guest:{sessionId}`. */
  id: string;
  name: string;
  color: string;
}

export interface BlockLock {
  blockId: string;
  holder: BlockLockHolder;
  /**
   * ISO 8601. Renewals aren't broadcast, so another session's lock is dropped
   * when it is released or its session leaves, never by this time.
   */
  expiresAt: string;
}

export type CollaborationConflictCode =
  OperationErrorCode | "lock_lost" | "content_too_large";

export type CollaborationConnectionState =
  "connected" | "reconnecting" | "offline";

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

export type OperationsAfterResult =
  | { revision: number; batches: RevisionedBatch[] }
  | { revision: number; resync: true };

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

export interface CollaborationRemoteChange {
  actor: CollaborationActor;
  ops: Operation[];
}
