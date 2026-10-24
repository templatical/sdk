import type {
  Block,
  BlockLock,
  BlockLockHolder,
  CollaborationActor,
  CollaborationConflictCode,
  CollaborationConnectionState,
  CollaborationHandlers,
  CollaborationMember,
  CollaborationProvider,
  CollaborationRemoteChange,
  Operation,
  OperationContext,
  RevisionedBatch,
  Template,
  TemplateContent,
} from "@templatical/types";
import {
  applyOperations,
  applyOperationsInPlace,
  deepEqual,
  invertOperations,
  OperationError,
  safeClone,
} from "@templatical/types";
import {
  computed,
  getCurrentScope,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
  type ComputedRef,
  type DeepReadonly,
  type Ref,
} from "@vue/reactivity";
import { diffContent } from "./diff-content";

/** Typing into one block is sent this long after the last keystroke. */
export const COLLABORATION_TYPING_DEBOUNCE_MS = 300;
/** Typing that never pauses is still sent at least this often. */
export const COLLABORATION_TYPING_MAX_WAIT_MS = 1000;
/** A revision that hasn't arrived after this long is fetched. */
export const COLLABORATION_GAP_TIMEOUT_MS = 1000;
/** A held lock is renewed this often; the backend lets it lapse after 30 s. */
export const COLLABORATION_LOCK_RENEW_MS = 10_000;
/** Waits between attempts at a batch that failed in transit. */
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10_000, 30_000];
/** The snapshot history's depth, kept for the operation history too. */
const DEFAULT_MAX_UNDO = 50;
/** OperationBatch allows 1–100 operations. */
const MAX_BATCH_OPS = 100;

const REFUSAL_CODES: ReadonlySet<string> = new Set<CollaborationConflictCode>([
  "block_exists",
  "block_missing",
  "anchor_missing",
  "precondition_failed",
  "lock_held",
  "locked_by_others",
  "invalid_operation",
  "lock_lost",
  "content_too_large",
]);

/** The template fields the controller reads, as the editor's readonly state holds them. */
export type CollaborationTemplate = DeepReadonly<
  Pick<Template, "id" | "revision" | "content">
>;

/** The slice of the editor the controller reads and writes. */
export interface CollaborationEditor {
  state: {
    readonly template: CollaborationTemplate | null;
    readonly selectedBlockId: string | null;
    readonly isLoading: boolean;
  };
  /** The live content the user edits. */
  content: Ref<TemplateContent>;
  selectBlock: (blockId: string | null) => void;
  setContent: (content: TemplateContent, markDirty?: boolean) => void;
  markDirty: () => void;
}

/** Something to tell the person at this editor. */
export type CollaborationNotice =
  /** Someone else holds the block this session tried to select. */
  | { type: "selectionRefused"; blockId: string; holder: BlockLockHolder }
  /** A local change was refused and taken back. */
  | {
      type: "editRefused";
      code: CollaborationConflictCode;
      holder?: BlockLockHolder;
    }
  /** An undo or redo step no longer applies and was dropped. */
  | { type: "undoSkipped"; code: CollaborationConflictCode };

/** A re-sync another session caused, as the backend announced it. */
export interface CollaborationRemoteResync {
  /** The revision the re-sync brings the template to. */
  revision: number;
  actor: CollaborationActor;
}

/** How {@link UseCollaborationReturn.applyOperations} sends a batch. */
export interface CollaborationApplyOptions {
  /** Sent as the batch's `origin`: an AI turn produced it (BY9). */
  origin: "ai";
  /**
   * The turn the batch belongs to. Batches of one turn share an undo step
   * while that step is the newest one.
   */
  turn: string;
}

/** What {@link UseCollaborationReturn.applyOperations} answers. */
export type CollaborationApplyResult =
  | { applied: true; inverse: Operation[] }
  | { applied: false; error: OperationError };

export interface UseCollaborationOptions {
  provider: CollaborationProvider;
  /**
   * Fetch a template when the backend says to re-sync: the templates
   * provider's `load`. Its `revision` says which revision `content` is at.
   */
  loadTemplate: (templateId: string) => Promise<Template>;
  /** This editor instance's session id. A new UUID when omitted. */
  sessionId?: string;
  /** How many undo steps to keep. */
  maxUndo?: number;
  /** A batch from another session was applied. */
  onRemoteChange?: (change: CollaborationRemoteChange) => void;
  /**
   * Another session re-synced the template — a `setContent`, a restore, a
   * batch too large to broadcast — and the backend said who. Called for a
   * revision this session doesn't have yet, before it catches up; the
   * catch-up's batches still reach `onRemoteChange`. The editor names an
   * agent's re-sync with it.
   */
  onRemoteResync?: (resync: CollaborationRemoteResync) => void;
  /**
   * Rewrite another session's batch just before it is applied, given the
   * content it applies to. Called for live batches and catch-up batches
   * alike, never for this session's own. The editor uses it to turn merge-tag
   * tokens into tags, as it does for loaded content. `onRemoteChange` still
   * receives the batch as the backend sent it.
   */
  normalizeRemoteOperations?: (
    ops: readonly Operation[],
    content: TemplateContent,
  ) => Operation[];
  onNotice?: (notice: CollaborationNotice) => void;
  onError?: (error: Error) => void;
}

export interface UseCollaborationReturn {
  readonly sessionId: string;
  /** Everyone with the template open, this session included; empty without presence. */
  members: Readonly<Ref<readonly CollaborationMember[]>>;
  /** Blocks other sessions hold, by block id. */
  locks: Readonly<Ref<ReadonlyMap<string, BlockLock>>>;
  /** `null` before a realtime join, and for a backend without realtime. */
  connection: Readonly<Ref<CollaborationConnectionState | null>>;
  /** The last revision this session confirmed. */
  revision: Readonly<Ref<number>>;
  canUndo: ComputedRef<boolean>;
  canRedo: ComputedRef<boolean>;
  /** Wire the controller to the editor. Call once, inside the editor's setup scope. */
  attach: (editor: CollaborationEditor) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  /** Turn edits not sent yet into a batch now. */
  flush: () => void;
  /** Resolves once every batch is confirmed; rejects when one fails in transit. */
  settle: () => Promise<void>;
  /** Stop reading the canvas (a version preview is on it). Batches keep arriving. */
  suspend: () => void;
  /** Put the current state back on the canvas and read it again. */
  resume: () => void;
  /** Fetch what this session missed, or reload when the backend says to. */
  catchUp: () => Promise<void>;
  /** Whether the block exists in the content the backend confirmed. */
  hasConfirmedBlock: (blockId: string) => boolean;
  /**
   * Apply a batch this editor was handed (an AI turn's) as this session's
   * own: checked against the view with this session's locks, put on the
   * canvas, sent with its `origin`, and undone with the rest of its turn. A
   * refusal changes nothing and sends nothing.
   */
  applyOperations: (
    ops: Operation[],
    options: CollaborationApplyOptions,
  ) => CollaborationApplyResult;
  destroy: () => void;
}

interface HistoryEntry {
  ops: Operation[];
  /** The AI turn whose batches this step undoes, if it is one. */
  turn?: string;
}

interface PendingBatch {
  batchId: string;
  ops: Operation[];
  origin: "edit" | "undo" | "redo" | "ai";
  /** The stack entry this batch pushed, taken back if the backend refuses it. */
  entry: HistoryEntry | null;
  /** Chunks from the same enqueue call share refusal cleanup. */
  group: { dropped: boolean };
  sent: boolean;
  /** Set once the backend confirms it. */
  revision: number | null;
}

interface Session {
  templateId: string;
  confirmed: TemplateContent;
  revision: number;
  pending: PendingBatch[];
  /** `confirmed` plus every pending batch that still applies on it. */
  view: TemplateContent;
  /** Batches that arrived ahead of a gap, by revision. */
  remote: Map<number, RevisionedBatch>;
  own: Map<number, PendingBatch>;
  inFlight: PendingBatch | null;
  gapTimer: ReturnType<typeof setTimeout> | null;
  catchingUp: Promise<void> | null;
  leave: (() => void) | null;
  retired: boolean;
  /** True while a reload runs: a drift found then is reported, not retried. */
  recovering: boolean;
  undo: HistoryEntry[];
  redo: HistoryEntry[];
  waiters: { resolve: () => void; reject: (error: Error) => void }[];
}

function refusalCode(error: unknown): CollaborationConflictCode | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && REFUSAL_CODES.has(code)
    ? (code as CollaborationConflictCode)
    : null;
}

function refusalHolder(error: unknown): BlockLockHolder | undefined {
  const holder = (error as { holder?: unknown } | null)?.holder;
  return typeof holder === "object" &&
    holder !== null &&
    typeof (holder as BlockLockHolder).sessionId === "string"
    ? (holder as BlockLockHolder)
    : undefined;
}

/** Network failures, 5xx, 408 and 429 are worth retrying; other 4xx aren't. */
function isTransient(error: unknown): boolean {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  if (typeof status !== "number") return true;
  return status >= 500 || status === 408 || status === 429;
}

function containsBlock(blocks: Block[], blockId: string): boolean {
  return blocks.some((block) => {
    if (block.id === blockId) return true;
    const children = (block as { children?: unknown }).children;
    return (
      block.type === "section" &&
      Array.isArray(children) &&
      (children as Block[][]).some(
        (column) => Array.isArray(column) && containsBlock(column, blockId),
      )
    );
  });
}

/** Typing into one block, or one settings change: worth batching up. */
function isCoalescible(ops: readonly Operation[]): boolean {
  if (ops.length === 1 && ops[0].op === "updateSettings") return true;
  const first = ops[0];
  return (
    first.op === "updateBlock" &&
    ops.every((op) => op.op === "updateBlock" && op.blockId === first.blockId)
  );
}

/**
 * A remote batch without its preconditions. The backend checked them against
 * its own copy before it accepted the batch. This copy can differ from that one
 * in merge-tag markup alone — tokens are normalized into tags on load and on
 * arrival — and an `expect` compares content exactly, so checking it here
 * refuses a batch the backend applied and reloads the template. Structural
 * checks still run, and still catch a copy that really drifted.
 */
function withoutPreconditions(ops: readonly Operation[]): Operation[] {
  return ops.map((op) => {
    if (!("expect" in op)) return op;
    const { expect: _expect, ...rest } = op;
    return rest as Operation;
  });
}

/**
 * Real-time collaboration over a {@link CollaborationProvider}.
 *
 * The controller keeps the content the backend confirmed at revision R, plus
 * this session's pending batches; the canvas shows the confirmed content with
 * the pending batches applied. Local changes are captured by diffing the
 * canvas against that view: structural changes, selection changes and blur
 * send at once, typing into one block after a short pause. One batch is in
 * flight at a time. Batches from other sessions apply strictly by revision,
 * with this session's pending batches replayed on top; a gap that isn't
 * filled within a second, a re-sync, a reconnect and a refusal all fetch what
 * was missed.
 *
 * Selecting a block takes its lock (when the backend has locks), renewed
 * while selected and released on deselect, template switch and page hide.
 * Undo and redo send inverse batches guarded by preconditions; one that no
 * longer applies is dropped with a notice. Changes from others never enter the
 * stacks.
 */
export function useCollaboration(
  options: UseCollaborationOptions,
): UseCollaborationReturn {
  const { provider } = options;
  const sessionId = options.sessionId ?? crypto.randomUUID();
  const maxUndo = options.maxUndo ?? DEFAULT_MAX_UNDO;
  const locking =
    typeof provider.acquireLock === "function" &&
    typeof provider.renewLock === "function" &&
    typeof provider.releaseLock === "function";

  const members = shallowRef<readonly CollaborationMember[]>([]);
  const locks = shallowRef<ReadonlyMap<string, BlockLock>>(new Map());
  const connection = ref<CollaborationConnectionState | null>(null);
  const revision = ref(0);
  const historyVersion = ref(0);

  let editor: CollaborationEditor | null = null;
  let active: Session | null = null;
  let suspended = false;
  let writing = false;
  let captureQueued = false;
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let typingSince = 0;
  let destroyed = false;
  /** The watchers `attach` set up; `destroy` stops them, scope or not. */
  const stopWatching: (() => void)[] = [];

  // Locks: `wanted` follows the selection, `held` is what the backend granted.
  let wanted: { templateId: string; blockId: string } | null = null;
  let held: { templateId: string; blockId: string } | null = null;
  let lockQueue: Promise<void> = Promise.resolve();
  let renewTimer: ReturnType<typeof setInterval> | null = null;

  const canUndo = computed(() => {
    void historyVersion.value;
    return (active?.undo.length ?? 0) > 0;
  });
  const canRedo = computed(() => {
    void historyVersion.value;
    return (active?.redo.length ?? 0) > 0;
  });

  function reportError(error: unknown): void {
    options.onError?.(
      error instanceof Error ? error : new Error(String(error)),
    );
  }

  function notify(
    notice: CollaborationNotice,
    session: Session | null = active,
  ): void {
    if (session !== active || destroyed) return;
    options.onNotice?.(notice);
  }

  function lockContext(): OperationContext {
    return {
      locks: [...locks.value.values()].map((lock) => ({
        blockId: lock.blockId,
        sessionId: lock.holder.sessionId,
      })),
      session: sessionId,
    };
  }

  function bumpHistory(): void {
    historyVersion.value++;
  }

  function pushCapped(stack: HistoryEntry[], entry: HistoryEntry): void {
    stack.push(entry);
    if (stack.length > maxUndo) stack.splice(0, stack.length - maxUndo);
  }

  // --- The canvas ----------------------------------------------------------

  /** Put `view` on the canvas, changing only what differs from it. */
  function renderView(view: TemplateContent): void {
    if (!editor || suspended) return;
    writing = true;
    try {
      const live = editor.content.value;
      const ops = diffContent(live, view);
      if (ops.length > 0) {
        try {
          applyOperationsInPlace(live, ops);
        } catch {
          editor.setContent(safeClone(view), false);
        }
      }
      if (!deepEqual(editor.content.value, view)) {
        editor.setContent(safeClone(view), false);
      }
    } finally {
      writing = false;
    }
    const selected = editor.state.selectedBlockId;
    if (selected && !containsBlock(view.blocks, selected)) {
      editor.selectBlock(null);
    }
  }

  // --- Local changes -------------------------------------------------------

  function scheduleCapture(): void {
    if (writing || captureQueued) return;
    captureQueued = true;
    queueMicrotask(() => {
      captureQueued = false;
      capture(false);
    });
  }

  function clearTypingTimer(): void {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
  }

  /**
   * Diff the canvas against the view and send what changed. `duringLoad` is
   * for the moment a load or create starts: the canvas still shows this
   * template, and its unsent typing must go before the content is replaced.
   */
  function capture(force: boolean, duringLoad = false): void {
    const session = active;
    if (!editor || !session || suspended || writing) return;
    if (editor.state.isLoading && !duringLoad) return;
    if (editor.state.template?.id !== session.templateId) return;
    const ops = diffContent(session.view, editor.content.value);
    if (ops.length === 0) {
      clearTypingTimer();
      return;
    }
    if (!force && isCoalescible(ops)) {
      const now = Date.now();
      if (typingTimer === null) typingSince = now;
      if (now - typingSince < COLLABORATION_TYPING_MAX_WAIT_MS) {
        if (typingTimer) clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          typingTimer = null;
          capture(true);
        }, COLLABORATION_TYPING_DEBOUNCE_MS);
        return;
      }
    }
    clearTypingTimer();
    commit(session, ops);
  }

  function flush(): void {
    capture(true);
  }

  function commit(session: Session, proposed: Operation[]): void {
    let ops = proposed;
    let next: TemplateContent;
    try {
      next = applyOperations(session.view, ops, lockContext());
    } catch (error) {
      if (!(error instanceof OperationError)) throw error;
      // Refused here, before any request: take the change back.
      renderView(session.view);
      const holder =
        error.blockId === undefined
          ? undefined
          : locks.value.get(error.blockId)?.holder;
      notify({
        type: "editRefused",
        code: error.code,
        ...(holder ? { holder } : {}),
      });
      if (error.code === "invalid_operation") reportError(error);
      return;
    }
    const live = editor!.content.value;
    if (!deepEqual(next, live)) {
      // Content that isn't well formed can defeat the diff. Send it whole
      // rather than drift from it.
      reportError(
        new Error(
          "[Templatical] Collaboration: a change couldn't be expressed as block operations, so the whole content was sent.",
        ),
      );
      ops = [{ op: "setContent", content: safeClone(live) }];
      try {
        next = applyOperations(session.view, ops, lockContext());
      } catch (error) {
        if (!(error instanceof OperationError)) throw error;
        renderView(session.view);
        notify({ type: "editRefused", code: error.code });
        return;
      }
    }
    const entry: HistoryEntry = { ops: invertOperations(session.view, ops) };
    pushCapped(session.undo, entry);
    session.redo = [];
    bumpHistory();
    session.view = next;
    enqueue(session, ops, "edit", entry);
  }

  function enqueue(
    session: Session,
    ops: Operation[],
    origin: PendingBatch["origin"],
    entry: HistoryEntry | null,
  ): void {
    const group = { dropped: false };
    let offset = 0;
    do {
      session.pending.push({
        batchId: crypto.randomUUID(),
        ops: ops.slice(offset, offset + MAX_BATCH_OPS),
        origin,
        entry,
        group,
        sent: false,
        revision: null,
      });
      offset += MAX_BATCH_OPS;
    } while (offset < ops.length);
    pump(session);
  }

  // --- Sending ---------------------------------------------------------------

  function pump(session: Session): void {
    if (session.inFlight) return;
    const next = session.pending.find((batch) => !batch.sent);
    if (!next) {
      settleWaiters(session);
      return;
    }
    next.sent = true;
    session.inFlight = next;
    send(session, next, 0);
  }

  function send(session: Session, batch: PendingBatch, attempt: number): void {
    provider
      .submit(session.templateId, {
        batchId: batch.batchId,
        baseRevision: session.revision,
        ops: batch.ops,
        ...(batch.origin === "ai" ? { origin: "ai" as const } : {}),
      })
      .then(
        ({ revision: confirmedAt }) => {
          session.inFlight = null;
          confirmOwn(session, batch, confirmedAt);
          pump(session);
        },
        (error: unknown) => {
          if (refusalCode(error) !== null) {
            session.inFlight = null;
            refuse(session, batch, error);
            pump(session);
            return;
          }
          if (isTransient(error)) {
            // Same batch id, so a submit that did land applies once.
            rejectWaiters(session, error);
            const delay =
              RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
            setTimeout(() => {
              if (!destroyed) send(session, batch, attempt + 1);
            }, delay);
            return;
          }
          session.inFlight = null;
          reportError(error);
          refuse(session, batch, error);
          pump(session);
        },
      );
  }

  function confirmOwn(session: Session, batch: PendingBatch, at: number): void {
    if (batch.revision !== null) return;
    batch.revision = at;
    if (at <= session.revision) {
      // A catch-up or a reload already brought it in.
      dropPending(session, batch);
      rebuild(session);
      return;
    }
    session.own.set(at, batch);
    drain(session);
  }

  function dropPending(session: Session, batch: PendingBatch): void {
    session.pending = session.pending.filter((pending) => pending !== batch);
    settleWaiters(session);
  }

  function takeBackEntry(session: Session, batch: PendingBatch): void {
    if (!batch.entry) return;
    for (const stack of [session.undo, session.redo]) {
      const position = stack.indexOf(batch.entry);
      if (position !== -1) stack.splice(position, 1);
    }
    bumpHistory();
  }

  function dropRefusedGroup(session: Session, batch: PendingBatch): boolean {
    const firstRefusal = !batch.group.dropped;
    batch.group.dropped = true;
    // Confirmed chunks stay applied; sent chunks still await their outcome.
    // A split step is not atomic at the backend.
    session.pending = session.pending.filter(
      (pending) => pending.group !== batch.group || pending.sent,
    );
    if (firstRefusal) takeBackEntry(session, batch);
    settleWaiters(session);
    return firstRefusal;
  }

  function refuse(session: Session, batch: PendingBatch, error: unknown): void {
    dropPending(session, batch);
    if (dropRefusedGroup(session, batch)) {
      const code = refusalCode(error) ?? "invalid_operation";
      if (batch.origin === "edit" || batch.origin === "ai") {
        const holder = refusalHolder(error);
        notify(
          { type: "editRefused", code, ...(holder ? { holder } : {}) },
          session,
        );
      } else {
        notify({ type: "undoSkipped", code }, session);
      }
    }
    rebuild(session);
    if (session === active) void catchUp();
  }

  function settleWaiters(session: Session): void {
    if (session.pending.length > 0 || session.waiters.length === 0) return;
    for (const waiter of session.waiters.splice(0)) waiter.resolve();
  }

  function rejectWaiters(session: Session, error: unknown): void {
    const reason = error instanceof Error ? error : new Error(String(error));
    for (const waiter of session.waiters.splice(0)) waiter.reject(reason);
  }

  // --- Receiving -------------------------------------------------------------

  function receive(session: Session, batch: RevisionedBatch): void {
    if (batch.revision <= session.revision) return;
    const mine = session.pending.find(
      (pending) => pending.batchId === batch.batchId,
    );
    if (mine) {
      confirmOwn(session, mine, batch.revision);
      return;
    }
    session.remote.set(batch.revision, batch);
    drain(session);
  }

  /**
   * The ops another session's batch applies here: rewritten by
   * `normalizeRemoteOperations`, then without their preconditions. A
   * normalizer that throws is reported, and the batch applies as it came.
   */
  function arriving(session: Session, batch: RevisionedBatch): Operation[] {
    let ops: readonly Operation[] = batch.ops;
    if (options.normalizeRemoteOperations) {
      try {
        ops = options.normalizeRemoteOperations(batch.ops, session.confirmed);
      } catch (error) {
        reportError(error);
      }
    }
    return withoutPreconditions(ops);
  }

  /** Apply whatever is next in revision order, own and remote alike. */
  function drain(session: Session): void {
    const applied: RevisionedBatch[] = [];
    let confirmedDroppedChunk = false;
    for (;;) {
      const at = session.revision + 1;
      const remote = session.remote.get(at);
      const own = session.own.get(at);
      if (!remote && !own) break;
      try {
        session.confirmed = applyOperations(
          session.confirmed,
          remote ? arriving(session, remote) : own!.ops,
        );
      } catch {
        if (session.recovering) {
          // Even a fresh copy doesn't take the backend's next batch: stop
          // rather than reload in a loop.
          session.remote.clear();
          session.own.clear();
          reportError(
            new Error(
              "[Templatical] Collaboration: this editor can't follow the template's changes. Reload the page.",
            ),
          );
          return;
        }
        // This copy has drifted from the backend's: start over from it.
        void reload(session);
        return;
      }
      session.revision = at;
      if (remote) {
        session.remote.delete(at);
        applied.push(remote);
      } else {
        session.own.delete(at);
        if (own!.group.dropped) confirmedDroppedChunk = true;
        dropPending(session, own!);
      }
    }
    if (session === active) revision.value = session.revision;
    if (session.remote.size > 0 || session.own.size > 0) armGapTimer(session);
    else clearGapTimer(session);

    if (applied.length === 0 && !confirmedDroppedChunk) return;
    rebuild(session);
    if (session !== active) return;
    for (const batch of applied) {
      try {
        options.onRemoteChange?.({ actor: batch.actor, ops: batch.ops });
      } catch (error) {
        reportError(error);
      }
    }
  }

  /** Recompute the view from `confirmed`, replaying what is still pending. */
  function rebuild(session: Session): void {
    // Typing not sent yet becomes a batch first, so the canvas holds nothing
    // the replay below doesn't know about.
    if (session === active) flush();
    let view = session.confirmed;
    for (let index = 0; index < session.pending.length; index++) {
      const batch = session.pending[index];
      try {
        view = applyOperations(view, batch.ops);
      } catch (error) {
        if (batch.sent) {
          // The backend decides this one; it will almost certainly refuse it.
          continue;
        }
        if (dropRefusedGroup(session, batch)) {
          const code =
            error instanceof OperationError ? error.code : "invalid_operation";
          notify(
            batch.origin === "edit" || batch.origin === "ai"
              ? { type: "editRefused", code }
              : { type: "undoSkipped", code },
            session,
          );
        }
        // Earlier pending chunks of that group may already be in this view.
        view = session.confirmed;
        index = -1;
      }
    }
    session.view = view;
    settleWaiters(session);
    if (session === active) renderView(view);
  }

  function armGapTimer(session: Session): void {
    if (session.gapTimer) return;
    session.gapTimer = setTimeout(() => {
      session.gapTimer = null;
      if (session === active) void catchUp();
    }, COLLABORATION_GAP_TIMEOUT_MS);
  }

  function clearGapTimer(session: Session): void {
    if (session.gapTimer) {
      clearTimeout(session.gapTimer);
      session.gapTimer = null;
    }
  }

  function catchUp(): Promise<void> {
    const session = active;
    if (!session) return Promise.resolve();
    if (session.catchingUp) return session.catchingUp;
    session.catchingUp = (async () => {
      try {
        const result = await provider.operationsAfter(
          session.templateId,
          session.revision,
        );
        if (session.retired) return;
        if ("resync" in result) {
          await reload(session);
          return;
        }
        for (const batch of result.batches) receive(session, batch);
      } catch (error) {
        reportError(error);
      } finally {
        session.catchingUp = null;
      }
    })();
    return session.catchingUp;
  }

  async function reload(session: Session): Promise<void> {
    session.recovering = true;
    try {
      const template = await options.loadTemplate(session.templateId);
      if (session.retired) return;
      const at = template.revision ?? session.revision;
      session.confirmed = safeClone(template.content);
      session.revision = at;
      session.remote = new Map(
        [...session.remote].filter(([remoteAt]) => remoteAt > at),
      );
      for (const [ownAt, batch] of [...session.own]) {
        if (ownAt <= at) {
          session.own.delete(ownAt);
          dropPending(session, batch);
        }
      }
      if (session === active) revision.value = at;
      rebuild(session);
      drain(session);
    } catch (error) {
      reportError(error);
    } finally {
      session.recovering = false;
    }
  }

  // --- Sessions --------------------------------------------------------------

  function handlersFor(session: Session): CollaborationHandlers {
    const live = (): boolean => session === active && !session.retired;
    return {
      onBatch: (batch) => {
        if (live()) receive(session, batch);
      },
      onResync: (at, actor) => {
        if (!live() || at <= session.revision) return;
        if (actor) {
          try {
            options.onRemoteResync?.({ revision: at, actor });
          } catch (error) {
            reportError(error);
          }
        }
        void catchUp();
      },
      onLock: (lock) => {
        if (live()) setLock(lock);
      },
      onUnlock: (blockId, holderSession) => {
        if (live()) removeLock(blockId, holderSession);
      },
      onMembers: (next) => {
        if (live()) setMembers(next);
      },
      onConnectionChange: (state) => {
        if (live()) changeConnection(session, state);
      },
    };
  }

  function join(session: Session, refresh: boolean): void {
    provider.join(session.templateId, { sessionId }, handlersFor(session)).then(
      (joined) => {
        if (session.retired || session !== active) {
          if (!refresh) joined.leave();
          return;
        }
        session.leave = joined.leave;
        replaceLocks(joined.locks, !refresh);
        setMembers(joined.members);
        if (joined.members.length > 0) connection.value = "connected";
        if (joined.revision > session.revision) void catchUp();
        if (refresh) reconcileLock();
      },
      (error: unknown) => reportError(error),
    );
  }

  function start(template: CollaborationTemplate): void {
    const content = safeClone(template.content) as TemplateContent;
    const session: Session = {
      templateId: template.id,
      confirmed: content,
      revision: template.revision ?? 0,
      pending: [],
      view: safeClone(content),
      remote: new Map(),
      own: new Map(),
      inFlight: null,
      gapTimer: null,
      catchingUp: null,
      leave: null,
      retired: false,
      recovering: false,
      undo: [],
      redo: [],
      waiters: [],
    };
    active = session;
    revision.value = session.revision;
    bumpHistory();
    join(session, false);
    if (editor?.state.selectedBlockId)
      onSelection(editor.state.selectedBlockId);
    scheduleCapture();
  }

  function retire(session: Session): void {
    session.retired = true;
    clearGapTimer(session);
    session.leave?.();
    session.leave = null;
    rejectWaiters(session, new Error("[Templatical] The template was closed."));
  }

  function changeConnection(
    session: Session,
    state: CollaborationConnectionState,
  ): void {
    const previous = connection.value;
    connection.value = state;
    if (
      state === "connected" &&
      previous !== null &&
      previous !== "connected"
    ) {
      // Back after a drop: refresh locks and members, and fetch what was missed.
      join(session, true);
    }
  }

  function switchTo(template: CollaborationTemplate | null): void {
    if (active && active.templateId === template?.id) return;
    if (active) {
      clearTypingTimer();
      retire(active);
      active = null;
    }
    members.value = [];
    locks.value = new Map();
    connection.value = null;
    wanted = null;
    reconcileLock();
    bumpHistory();
    if (template) start(template);
  }

  // --- Locks -----------------------------------------------------------------

  function setLock(lock: BlockLock): void {
    if (lock.holder.sessionId === sessionId) return;
    const next = new Map(
      [...locks.value].filter(
        ([, existing]) => existing.holder.sessionId !== lock.holder.sessionId,
      ),
    );
    next.set(lock.blockId, lock);
    locks.value = next;
    if (editor?.state.selectedBlockId === lock.blockId) {
      editor.selectBlock(null);
      notify({
        type: "selectionRefused",
        blockId: lock.blockId,
        holder: lock.holder,
      });
    }
  }

  function removeLock(blockId: string, holderSession: string): void {
    if (locks.value.get(blockId)?.holder.sessionId !== holderSession) return;
    const next = new Map(locks.value);
    next.delete(blockId);
    locks.value = next;
  }

  function replaceLocks(list: readonly BlockLock[], merge: boolean): void {
    const next = merge ? new Map(locks.value) : new Map<string, BlockLock>();
    for (const lock of list) {
      if (lock.holder.sessionId === sessionId) continue;
      if (merge && next.has(lock.blockId)) continue;
      next.set(lock.blockId, lock);
    }
    locks.value = next;
  }

  function setMembers(next: readonly CollaborationMember[]): void {
    const present = new Set(next.map((member) => member.sessionId));
    const departed = new Set(
      members.value
        .map((member) => member.sessionId)
        .filter((id) => !present.has(id)),
    );
    members.value = next;
    if (departed.size === 0) return;
    const remaining = new Map(
      [...locks.value].filter(
        ([, lock]) => !departed.has(lock.holder.sessionId),
      ),
    );
    if (remaining.size !== locks.value.size) locks.value = remaining;
  }

  function queueLock(task: () => Promise<void>): void {
    lockQueue = lockQueue.then(task).catch(reportError);
  }

  /** Move what the backend granted toward what is selected, one call at a time. */
  function reconcileLock(): void {
    if (!locking) return;
    queueLock(async () => {
      if (held && (wanted === null || held.templateId !== wanted.templateId)) {
        // Acquiring another block on the same template releases this one on
        // the backend, so only release explicitly when nothing replaces it.
        const releasing = held;
        held = null;
        stopRenewing();
        await provider.releaseLock!(releasing.templateId, releasing.blockId);
      }
      const target = wanted;
      if (
        !target ||
        (held?.templateId === target.templateId &&
          held.blockId === target.blockId)
      ) {
        return;
      }
      try {
        await provider.acquireLock!(target.templateId, target.blockId);
        held = target;
        startRenewing();
        forgetLock(target.blockId);
      } catch (error) {
        if (held?.templateId === target.templateId) {
          // Refused: the previous block is still this session's on the backend.
          const releasing = held;
          held = null;
          stopRenewing();
          await provider.releaseLock!(
            releasing.templateId,
            releasing.blockId,
          ).catch(() => {});
        }
        if (wanted !== target) return;
        refuseSelection(target.blockId, error);
      }
    });
  }

  function forgetLock(blockId: string): void {
    if (!locks.value.has(blockId)) return;
    const next = new Map(locks.value);
    next.delete(blockId);
    locks.value = next;
  }

  function refuseSelection(blockId: string, error: unknown): void {
    const code = refusalCode(error);
    if (code === "lock_held" || code === "block_missing") {
      wanted = null;
      const holder = refusalHolder(error);
      if (holder) {
        // Records the holder, deselects and says who it is.
        setLock({ blockId, holder, expiresAt: "" });
      } else if (editor?.state.selectedBlockId === blockId) {
        editor.selectBlock(null);
      }
      return;
    }
    // A failure in transit: keep the selection and try again shortly.
    reportError(error);
    setTimeout(() => {
      if (wanted?.blockId === blockId) reconcileLock();
    }, RETRY_DELAYS_MS[0]);
  }

  function startRenewing(): void {
    if (renewTimer) return;
    renewTimer = setInterval(() => {
      queueLock(async () => {
        const current = held;
        if (!current) return;
        try {
          await provider.renewLock!(current.templateId, current.blockId);
        } catch (error) {
          if (refusalCode(error) === "lock_lost") {
            held = null;
            stopRenewing();
            reconcileLock();
            return;
          }
          reportError(error);
        }
      });
    }, COLLABORATION_LOCK_RENEW_MS);
  }

  function stopRenewing(): void {
    if (renewTimer) {
      clearInterval(renewTimer);
      renewTimer = null;
    }
  }

  function onSelection(blockId: string | null): void {
    flush();
    if (!active) return;
    wanted = blockId ? { templateId: active.templateId, blockId } : null;
    reconcileLock();
  }

  /** The page is going away: send what's typed, let go of the lock, leave. */
  function onPageHide(): void {
    flush();
    if (held && locking) {
      void provider.releaseLock!(held.templateId, held.blockId).catch(() => {});
      held = null;
      stopRenewing();
    }
    active?.leave?.();
    if (active) active.leave = null;
  }

  // --- History ---------------------------------------------------------------

  function step(direction: "undo" | "redo"): void {
    const session = active;
    if (!session || suspended) return;
    flush();
    const entry = (direction === "undo" ? session.undo : session.redo).pop();
    if (!entry) return;
    bumpHistory();
    let next: TemplateContent;
    try {
      next = applyOperations(session.view, entry.ops, lockContext());
    } catch (error) {
      if (!(error instanceof OperationError)) throw error;
      notify({ type: "undoSkipped", code: error.code });
      return;
    }
    const counter: HistoryEntry = {
      ops: invertOperations(session.view, entry.ops),
    };
    pushCapped(direction === "undo" ? session.redo : session.undo, counter);
    session.view = next;
    renderView(next);
    editor?.markDirty();
    enqueue(session, entry.ops, direction, counter);
  }

  function applyFromTurn(
    ops: Operation[],
    options: CollaborationApplyOptions,
  ): CollaborationApplyResult {
    const session = active;
    if (!editor || !session || suspended) {
      return {
        applied: false,
        error: new OperationError(
          "invalid_operation",
          0,
          "No template is open for editing.",
        ),
      };
    }
    // Typing not sent yet becomes its own batch, and its own undo step, first.
    flush();
    let next: TemplateContent;
    let inverse: Operation[];
    try {
      next = applyOperations(session.view, ops, lockContext());
      inverse = invertOperations(session.view, ops);
    } catch (error) {
      if (error instanceof OperationError) return { applied: false, error };
      throw error;
    }
    const top = session.undo.at(-1);
    let entry: HistoryEntry;
    if (top && top.turn === options.turn) {
      // Undoing the turn undoes this batch first, then the earlier ones.
      top.ops = [...inverse, ...top.ops];
      entry = top;
    } else {
      entry = { ops: inverse, turn: options.turn };
      pushCapped(session.undo, entry);
    }
    session.redo = [];
    bumpHistory();
    session.view = next;
    renderView(next);
    editor.markDirty();
    // Like an edit, a batch the backend refuses takes its undo entry back.
    // If it joined a turn, that turn's whole local undo entry goes.
    enqueue(session, ops, options.origin, entry);
    return { applied: true, inverse };
  }

  // --- Public surface --------------------------------------------------------

  function attach(target: CollaborationEditor): void {
    editor = target;
    stopWatching.push(
      watch(
        () => target.state.template,
        (template) => switchTo(template),
        {
          immediate: true,
        },
      ),
      watch(() => target.content.value, scheduleCapture, { deep: true }),
      watch(() => target.state.selectedBlockId, onSelection),
      watch(
        () => target.state.isLoading,
        (loading) => (loading ? capture(true, true) : scheduleCapture()),
      ),
    );
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", onPageHide);
      window.addEventListener("blur", flush);
    }
    if (getCurrentScope()) onScopeDispose(destroy);
  }

  function settle(): Promise<void> {
    flush();
    const session = active;
    if (!session || session.pending.length === 0) return Promise.resolve();
    return new Promise((resolve, reject) =>
      session.waiters.push({ resolve, reject }),
    );
  }

  function suspend(): void {
    flush();
    suspended = true;
  }

  function resume(): void {
    suspended = false;
    if (active) renderView(active.view);
  }

  function destroy(): void {
    if (destroyed) return;
    flush();
    for (const stop of stopWatching.splice(0)) stop();
    clearTypingTimer();
    onPageHide();
    destroyed = true;
    if (active) retire(active);
    active = null;
    stopRenewing();
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("blur", flush);
    }
  }

  return {
    sessionId,
    members,
    locks,
    connection,
    revision,
    canUndo,
    canRedo,
    attach,
    undo: () => step("undo"),
    redo: () => step("redo"),
    clearHistory: () => {
      if (!active) return;
      active.undo = [];
      active.redo = [];
      bumpHistory();
    },
    flush,
    settle,
    suspend,
    resume,
    catchUp,
    hasConfirmedBlock: (blockId) =>
      active ? containsBlock(active.confirmed.blocks, blockId) : false,
    applyOperations: applyFromTurn,
    destroy,
  };
}
