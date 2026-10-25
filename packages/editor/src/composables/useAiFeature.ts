import {
  computed,
  ref,
  shallowRef,
  toRaw,
  watch,
  type ComputedRef,
  type Ref,
} from "vue";
import type { UseHistoryReturn } from "@templatical/core";
import type {
  AiChatMessage,
  AiFeatureName,
  AiFixFinding,
  AiMergeTags,
  AiMessageKind,
  AiOperationsResult,
  AiProvider,
  AiRequestBase,
  AiRewriteRequest,
  AiTurnHandlers,
  AiTurnResult,
  Block,
  Operation,
  TemplateContent,
} from "@templatical/types";
import {
  applyOperationsInPlace,
  CollaborationConflict,
  invertOperations,
  OperationError,
  safeClone,
  SdkError,
} from "@templatical/types";
import {
  AI_MISSING_PROVIDER_MESSAGE,
  type AiErrorContext,
} from "../utils/aiErrors";
import {
  aiImageContext,
  aiImageSnapshot,
  type AiImageSnapshot,
} from "../utils/aiImageContext";
import { DEFAULT_ALT_MAX_LENGTH } from "../utils/aiFixableRules";
import type { EditorCapabilities } from "../types/editor-capabilities";
import {
  AGENT_HIGHLIGHT_MS,
  summarizeAgentEdit,
  type UseCollaborationFeatureReturn,
} from "./useCollaborationFeature";

/** How long a turn waits for this editor's unsent edits to reach the backend. */
export const AI_SETTLE_TIMEOUT_MS = 3000;
/** How long a live channel gets to deliver a server-applied batch before a catch-up. */
export const AI_BROADCAST_GRACE_MS = 1000;
export { AI_MISSING_PROVIDER_MESSAGE } from "../utils/aiErrors";
/** UTF-8 bytes of serialized content, matching the wire's AI_LIMITS. */
export const AI_CONTENT_MAX_BYTES = 200_000;

export type AiPanel = "chat";
export type { AiErrorContext } from "../utils/aiErrors";

export interface AiFailure {
  error: Error;
  context: AiErrorContext;
}

/** One row of the chat (D16). */
export interface AiChatItem {
  id: string;
  role: "user" | "assistant";
  kind: AiMessageKind;
  text: string;
  attachments: { name: string; kind: "image" | "pdf" }[];
  /** Operations this turn changed, client- and server-applied together. */
  operationCount: number;
  undone: boolean;
  /** Undo is available for this not-undone message. */
  canUndo: boolean;
  /** Redo is available for this undone message. */
  canRedo: boolean;
  createdAt: string;
  status: "streaming" | "done" | "failed";
  /** Why the turn, or its last Undo or Redo, failed. */
  failure?: AiFailure;
}

export interface AiTurnOutcome {
  /** The assistant item's id, `null` when the turn left no message. */
  messageId: string | null;
  operationCount: number;
  text: string;
  failed: boolean;
}

/** The slice of the editor the feature reads and writes. */
export interface AiFeatureEditor {
  state: {
    readonly template?: { readonly id: string } | null;
    readonly selectedBlockId: string | null;
    readonly isLoading?: boolean;
    readonly isDirty?: boolean;
    readonly isSaving?: boolean;
  };
  /** Committed create/load version from core; metadata edits leave it alone. */
  loadVersion?: Readonly<Ref<number>>;
  content: Ref<TemplateContent>;
  selectBlock: (blockId: string | null) => void;
  markDirty: () => void;
}

export interface UseAiFeatureOptions {
  provider: AiProvider;
  editor: AiFeatureEditor;
  collaboration: Pick<UseCollaborationFeatureReturn, "core" | "outline"> | null;
  /** The snapshot history; read at call time (core is built after this). */
  history: () => Pick<UseHistoryReturn, "record">;
  /** Reload after a server-applied turn; check the guard before committing. */
  reload:
    | ((templateId: string, shouldApply?: () => boolean) => Promise<unknown>)
    | null;
  mergeTags: () => AiMergeTags;
  /** Bare merge tags to tags, as for remote batches (D8). */
  normalize: (
    ops: readonly Operation[],
    content: TemplateContent,
  ) => Operation[];
  /** The comments panel's state: AI panels and comments are exclusive (D18). */
  commentsOpen: Ref<boolean> | null;
  altMaxLength?: () => number;
  onError?: (error: Error) => void;
}

interface TurnRecord {
  /** Undoes the turn: each batch's inverse, the last batch's first. */
  inverse: Operation[];
  /** Redoes it after an Undo: the inverse of the Undo batch. */
  redo: Operation[] | null;
  serverApplied: boolean;
  batchIds: Set<string>;
}

interface Memory {
  generation: number;
  items: AiChatItem[];
  records: Map<string, TurnRecord>;
  storedIds: Set<string>;
  recoveries: Map<
    string,
    { item: AiChatItem; user?: AiChatItem; record: TurnRecord }
  >;
}

const isAbort = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";
const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));
const sum = (message: AiChatMessage) =>
  message.batches.reduce((total, batch) => total + batch.operationCount, 0);

function hasBlock(blocks: readonly Block[], blockId: string): boolean {
  return blocks.some(
    (block) =>
      block.id === blockId ||
      (block.type === "section" &&
        Array.isArray((block as { children?: unknown }).children) &&
        (block as unknown as { children: Block[][] }).children.some(
          (column) => Array.isArray(column) && hasBlock(column, blockId),
        )),
  );
}

function refusalOf(error: OperationError): AiOperationsResult {
  return {
    applied: false,
    code: error.code,
    opIndex: error.opIndex,
    message: error.message,
  };
}

export interface UseAiFeatureReturn {
  capability: NonNullable<EditorCapabilities["ai"]>;
  panel: Ref<AiPanel | null>;
  open: (panel: AiPanel) => void;
  close: () => void;
  has: (feature: AiFeatureName) => boolean;
  /** The loaded template's id: AI works on it, and panels reset when it changes. */
  templateId: ComputedRef<string | null>;
  /** Changes on every committed load, including same-id reloads. */
  templateSession: ComputedRef<number | string | null>;
  /** Opaque identity; AI reconciliation keeps it, external committed loads replace it. */
  sessionIdentity: ComputedRef<object | null>;
  isAvailable: ComputedRef<boolean>;
  hasConversation: boolean;
  canClear: boolean;
  messages: Ref<AiChatItem[]>;
  isLoadingHistory: Ref<boolean>;
  /** True while any AI operation owns the serialized lane. */
  busy: Ref<boolean>;
  /** Alias of busy, retained for existing panels. */
  isRunning: Ref<boolean>;
  failure: Ref<AiFailure | null>;
  keptYourVersion: Ref<boolean>;
  reloadTemplate: () => Promise<void>;
  failedPrompt: Ref<string | null>;
  failedAttachments: Ref<File[]>;
  importQueue: Ref<File[]>;
  isTemplateEmpty: ComputedRef<boolean>;
  send: (message: string, attachments?: File[]) => Promise<AiTurnOutcome>;
  startImport: (files: File[]) => void;
  fix: (finding: AiFixFinding) => Promise<AiTurnOutcome>;
  stop: () => void;
  newChat: () => Promise<void>;
  undoMessage: (id: string) => Promise<void>;
  redoMessage: (id: string) => Promise<void>;
  rewrite: (
    input: Pick<
      AiRewriteRequest,
      "html" | "preset" | "language" | "instruction"
    >,
    onText: (text: string) => void,
    signal: AbortSignal,
  ) => Promise<{ html: string }>;
  draftAltText: (blockId: string, signal?: AbortSignal) => Promise<string>;
  applyAltTexts: (
    entries: Array<{
      blockId: string;
      alt: string;
      decorative: boolean;
      expect?: AiImageSnapshot;
    }>,
  ) => Promise<void>;
  destroy: () => void;
}

/**
 * The editor's side of `init({ ai })` (A1 §3): the capability its entry points
 * read, the request each call carries, the edits a turn hands over (applied
 * through the collaboration controller or through the engine and the snapshot
 * history, one undo step per turn), server-applied batches followed or
 * reloaded, the chat in `conversation` or in memory, and every failure to
 * `onError`. Built before `useEditorCore`; reads core through getters.
 */
export function useAiFeature(options: UseAiFeatureOptions): UseAiFeatureReturn {
  const { provider, editor, collaboration } = options;
  const conversation = provider.conversation ?? null;
  const localSessionId = crypto.randomUUID();

  const panel = ref<AiPanel | null>(null);
  const memory = new Map<string, Memory>();
  let destroyed = false;
  let authorVersion = 0;
  let applyingAi = false;
  type LaneKind =
    "turn" | "replay" | "clear" | "history" | "read" | "reconcile";
  interface Session {
    id: string;
    memory: Memory;
    generation: number;
    messages: Ref<AiChatItem[]>;
    isLoadingHistory: Ref<boolean>;
    busy: Ref<boolean>;
    keptYourVersion: Ref<boolean>;
    failure: Ref<AiFailure | null>;
    failedPrompt: Ref<string | null>;
    failedAttachments: Ref<File[]>;
    importQueue: Ref<File[]>;
    loaded: boolean;
    historyGeneration: number;
    pendingHistory: { generation: number; promise: Promise<void> } | null;
    active: Job | null;
    queue: Job[];
    lifetime: AbortController;
    committingReload: boolean;
    lastRecordedTurn: string | null;
    timers: Set<ReturnType<typeof setTimeout>>;
    highlights: Ref<ReadonlyMap<string, number>>;
    highlightSequence: number;
  }
  interface Job {
    kind: LaneKind;
    scope: Session;
    controller: AbortController;
    authorVersion: number;
    execute: () => Promise<void>;
  }

  function createSession(id: string): Session {
    const saved = memoryFor(id);
    return {
      id,
      memory: saved,
      generation: ++saved.generation,
      messages: ref(saved.items),
      isLoadingHistory: ref(false),
      busy: ref(false),
      keptYourVersion: ref(false),
      failure: ref(null),
      failedPrompt: ref(null),
      failedAttachments: shallowRef([]),
      importQueue: shallowRef([]),
      loaded: false,
      historyGeneration: 0,
      pendingHistory: null,
      active: null,
      queue: [],
      lifetime: new AbortController(),
      committingReload: false,
      lastRecordedTurn: null,
      timers: new Set(),
      highlights: shallowRef(new Map()),
      highlightSequence: 0,
    };
  }

  const templateId = computed(() => editor.state.template?.id ?? null);
  const currentSession = shallowRef<Session | null>(
    templateId.value === null ? null : createSession(templateId.value),
  );
  const isAvailable = computed(
    () =>
      currentSession.value !== null && !destroyed && templateId.value !== null,
  );
  const has = (feature: AiFeatureName): boolean =>
    feature === "chatAttachments"
      ? isAvailable.value &&
        provider.chatAttachments === true &&
        typeof provider.chat === "function"
      : typeof provider[feature] === "function";
  const scopeOf = (): Session | null =>
    destroyed ? null : currentSession.value;
  const isCurrent = (scope: Session): boolean =>
    !destroyed &&
    currentSession.value === scope &&
    !scope.lifetime.signal.aborted &&
    templateId.value === scope.id;

  // Stable public refs follow the current session, never an obsolete job's refs.
  function sessionRef<T>(select: (scope: Session) => Ref<T>, empty: T): Ref<T> {
    return computed({
      get: () =>
        currentSession.value ? select(currentSession.value).value : empty,
      set: (value) => {
        const scope = scopeOf();
        if (scope) select(scope).value = value;
      },
    });
  }
  const messages = sessionRef((scope) => scope.messages, []);
  const isTemplateEmpty = computed(
    () => editor.content.value.blocks.length === 0,
  );
  const isLoadingHistory = sessionRef((scope) => scope.isLoadingHistory, false);
  const isRunning = sessionRef((scope) => scope.busy, false);
  const failure = sessionRef((scope) => scope.failure, null);
  const keptYourVersion = sessionRef((scope) => scope.keptYourVersion, false);
  const failedPrompt = sessionRef((scope) => scope.failedPrompt, null);
  const failedAttachments = sessionRef((scope) => scope.failedAttachments, []);
  const importQueue = sessionRef((scope) => scope.importQueue, []);

  function invalidateHistory(scope: Session): void {
    scope.historyGeneration++;
    scope.pendingHistory = null;
    scope.loaded = false;
    scope.isLoadingHistory.value = false;
  }

  function enqueue<T>(
    kind: LaneKind,
    scope: Session,
    run: (job: Job) => Promise<T>,
    skipped: () => T | Promise<T>,
  ): Promise<T> {
    if (!isCurrent(scope)) return Promise.resolve().then(skipped);
    return new Promise<T>((resolve, reject) => {
      const job: Job = {
        kind,
        scope,
        controller: new AbortController(),
        authorVersion: 0,
        execute: async () => {
          job.authorVersion = authorVersion;
          let result: T;
          try {
            result = await (job.controller.signal.aborted || !isCurrent(scope)
              ? skipped()
              : run(job));
          } catch (error) {
            reject(error);
            return;
          } finally {
            scope.active = null;
            scope.busy.value = false;
            pump(scope);
          }
          resolve(result);
        },
      };
      scope.queue.push(job);
      pump(scope);
    });
  }

  function pump(scope: Session): void {
    if (scope.active) return;
    const job = scope.queue.shift();
    if (!job) return;
    scope.active = job;
    // Abandoned queues drain their skipped results without reviving busy state.
    if (isCurrent(scope)) scope.busy.value = true;
    void job.execute();
  }

  function check(job: Job): void {
    job.controller.signal.throwIfAborted();
    if (!isCurrent(job.scope))
      throw new DOMException("The template changed.", "AbortError");
  }

  async function abortable<T>(
    promise: Promise<T>,
    signal: AbortSignal,
  ): Promise<T> {
    signal.throwIfAborted();
    let abort!: () => void;
    const stopped = new Promise<never>((_, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
    });
    try {
      return await Promise.race([promise, stopped]);
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }

  async function reloadCurrent(
    job: Job,
    recoverStopped = false,
    expectedAuthorVersion = job.authorVersion,
  ): Promise<void> {
    const { scope } = job;
    const valid = () =>
      scope.active === job &&
      isCurrent(scope) &&
      (recoverStopped || !job.controller.signal.aborted);
    const canKeepReload = () => {
      if (!valid()) return false;
      if (expectedAuthorVersion !== authorVersion) {
        scope.keptYourVersion.value = true;
        return false;
      }
      return true;
    };
    if (!options.reload || !canKeepReload()) return;
    try {
      await abortable(
        options.reload(scope.id, () => {
          if (!canKeepReload()) return false;
          scope.keptYourVersion.value = false;
          scope.committingReload = true;
          return true;
        }),
        scope.lifetime.signal,
      );
    } finally {
      scope.committingReload = false;
    }
  }

  function memoryFor(id: string): Memory {
    let found = memory.get(id);
    if (!found) {
      found = {
        generation: 0,
        items: [],
        records: new Map(),
        storedIds: new Set(),
        recoveries: new Map(),
      };
      memory.set(id, found);
    }
    return found;
  }

  function later(scope: Session, run: () => void, ms: number): void {
    const timer = setTimeout(() => {
      scope.timers.delete(timer);
      run();
    }, ms);
    scope.timers.add(timer);
  }

  function report(error: unknown): void {
    if (!isAbort(error)) options.onError?.(asError(error));
  }

  // --- The asker's outline (D42) ---------------------------------------------

  function outline(scope: Session, blockIds: readonly string[]): void {
    if (blockIds.length === 0) return;
    if (collaboration) {
      collaboration.outline(blockIds);
      return;
    }
    const sequence = ++scope.highlightSequence;
    const next = new Map(scope.highlights.value);
    for (const id of blockIds) next.set(id, sequence);
    scope.highlights.value = next;
    later(
      scope,
      () => {
        const rest = new Map(scope.highlights.value);
        for (const id of blockIds)
          if (rest.get(id) === sequence) rest.delete(id);
        scope.highlights.value = rest;
      },
      AGENT_HIGHLIGHT_MS,
    );
  }

  // --- Requests (D12) --------------------------------------------------------

  async function settle(scope: Session): Promise<void> {
    if (!collaboration) return;
    await Promise.race([
      collaboration.core.settle().catch(() => {}),
      new Promise<void>((resolve) =>
        later(scope, resolve, AI_SETTLE_TIMEOUT_MS),
      ),
    ]);
  }

  function requestBase(id: string): AiRequestBase {
    const content = safeClone(toRaw(editor.content.value));
    if (
      new TextEncoder().encode(JSON.stringify(content)).length >
      AI_CONTENT_MAX_BYTES
    )
      throw new SdkError(
        "This template is too large for AI.",
        413,
        "content_too_large",
      );
    return {
      templateId: id,
      content,
      revision: collaboration ? collaboration.core.revision.value : null,
      sessionId: collaboration ? collaboration.core.sessionId : localSessionId,
      mergeTags: options.mergeTags(),
    };
  }

  function selectedBlockId(): string | null {
    const id = editor.state.selectedBlockId;
    if (!id) return null;
    if (collaboration)
      return collaboration.core.hasConfirmedBlock(id) ? id : null;
    return hasBlock(editor.content.value.blocks, id) ? id : null;
  }

  // --- Applying edits (D6, D7, D8) ---------------------------------------------

  function applyOps(
    ops: Operation[],
    turn: string,
    scope: Session,
  ): AiOperationsResult {
    const normalized = options.normalize(ops, toRaw(editor.content.value));
    const summary = summarizeAgentEdit(normalized);
    if (collaboration) {
      const result = collaboration.core.applyOperations(normalized, {
        origin: "ai",
        turn,
      });
      if (!result.applied) return refusalOf(result.error);
      if (!summary.templateUpdated) outline(scope, summary.blockIds);
      return { applied: true, inverse: result.inverse };
    }
    let inverse: Operation[];
    try {
      // Also the check: it throws the engine's refusal for ops that don't apply.
      inverse = invertOperations(toRaw(editor.content.value), normalized);
    } catch (error) {
      if (error instanceof OperationError) return refusalOf(error);
      throw error;
    }
    if (scope.lastRecordedTurn !== turn) {
      options.history().record();
      scope.lastRecordedTurn = turn;
    }
    applyingAi = true;
    try {
      applyOperationsInPlace(editor.content.value, safeClone(normalized));
      editor.markDirty();
    } finally {
      applyingAi = false;
    }
    const selected = editor.state.selectedBlockId;
    if (selected && !hasBlock(editor.content.value.blocks, selected)) {
      editor.selectBlock(null);
    }
    if (!summary.templateUpdated) outline(scope, summary.blockIds);
    return { applied: true, inverse };
  }

  function followRevision(revision: number, scope: Session): void {
    if (!collaboration || !isCurrent(scope)) return;
    const core = collaboration.core;
    if (core.revision.value >= revision) return;
    if (core.connection.value !== "connected") {
      void core.catchUp();
      return;
    }
    later(
      scope,
      () => {
        if (isCurrent(scope) && core.revision.value < revision)
          void core.catchUp();
      },
      AI_BROADCAST_GRACE_MS,
    );
  }

  // --- Turns (D15, D16) --------------------------------------------------------

  function patch(
    scope: Session,
    key: string,
    changes: Partial<AiChatItem>,
  ): void {
    const saved = scope.memory;
    saved.items = saved.items.map((item) => {
      if (item.id !== key) return item;
      const next = { ...item, ...changes };
      return { ...next, ...replayAvailability(next, saved) };
    });
    for (const recovery of saved.recoveries.values()) {
      if (recovery.item.id === key) {
        recovery.item =
          saved.items.find((item) => item.id === (changes.id ?? key)) ??
          recovery.item;
      }
    }
    scope.messages.value = saved.items;
  }

  function replayAvailability(
    item: AiChatItem,
    saved: Memory,
  ): Pick<AiChatItem, "canUndo" | "canRedo"> {
    const eligible = item.role === "assistant" && item.operationCount > 0;
    if (saved.storedIds.has(item.id)) {
      return {
        canUndo:
          eligible && !item.undone && typeof conversation?.undo === "function",
        canRedo:
          eligible && item.undone && typeof conversation?.redo === "function",
      };
    }
    const record = saved.records.get(item.id);
    return {
      canUndo:
        eligible &&
        !item.undone &&
        !record?.serverApplied &&
        (record?.inverse.length ?? 0) > 0,
      canRedo:
        eligible &&
        item.undone &&
        !record?.serverApplied &&
        (record?.redo?.length ?? 0) > 0,
    };
  }

  const emptyOutcome = (): AiTurnOutcome => ({
    messageId: null,
    operationCount: 0,
    text: "",
    failed: true,
  });

  function runTurn(
    kind: AiMessageKind,
    userText: string,
    call: (
      base: AiRequestBase,
      handlers: AiTurnHandlers,
      signal: AbortSignal,
    ) => Promise<AiTurnResult>,
    attachments: File[] = [],
  ): Promise<AiTurnOutcome> {
    const scope = scopeOf();
    if (
      !scope ||
      scope.active?.kind === "turn" ||
      scope.queue.some((job) => job.kind === "turn")
    )
      return Promise.resolve(emptyOutcome());
    return enqueue(
      "turn",
      scope,
      async (job) => {
        const { controller } = job;
        const saved = scope.memory;
        const turn = crypto.randomUUID();
        const userKey = crypto.randomUUID();
        let key: string = crypto.randomUUID();
        let operationCount = 0;
        let text = "";
        let interrupted = false;
        let refusal: SdkError | null = null;
        const record: TurnRecord = {
          inverse: [],
          redo: null,
          serverApplied: false,
          batchIds: new Set(),
        };
        let outcome: AiTurnOutcome;
        let completed = false;
        let reconciling = false;
        const update = (changes: Partial<AiChatItem>) =>
          patch(scope, key, changes);
        const rememberRecovery = () => {
          const item = saved.items.find((item) => item.id === key);
          if (conversation && item)
            saved.recoveries.set(turn, {
              item,
              user: saved.items.find((item) => item.id === userKey),
              record,
            });
        };
        const reconcileLateApplied = () => {
          if (
            reconciling ||
            (!conversation && (collaboration || !options.reload))
          )
            return;
          reconciling = true;
          // Stop cancels provider work immediately. Received server facts still
          // enter the lane and reload only the session that requested the turn.
          void enqueue(
            "reconcile",
            scope,
            async (recovery) => {
              try {
                let observed: number;
                do {
                  observed = operationCount;
                  if (!collaboration && options.reload)
                    await reloadCurrent(recovery, true, job.authorVersion);
                  if (conversation) await readHistory(recovery, true, true);
                } while (isCurrent(scope) && observed !== operationCount);
              } catch (error) {
                if (isCurrent(scope)) report(error);
              } finally {
                reconciling = false;
              }
            },
            () => {
              reconciling = false;
            },
          );
        };
        const handlers: AiTurnHandlers = {
          onText: (chunk) => {
            check(job);
            text += chunk;
            update({ text });
          },
          onOperations: async (ops) => {
            check(job);
            const result = applyOps(ops, turn, scope);
            if (result.applied) {
              record.inverse = [...result.inverse, ...record.inverse];
              operationCount += ops.length;
              update({ operationCount });
            }
            return result;
          },
          onApplied: (batch) => {
            // An applied batch is a fact, including one received during Stop.
            if (!isCurrent(scope))
              throw new DOMException("The template changed.", "AbortError");
            if (!collaboration && !options.reload) {
              refusal ??= new SdkError(
                AI_MISSING_PROVIDER_MESSAGE,
                502,
                "ai_provider_error",
              );
              throw refusal;
            }
            record.serverApplied = true;
            record.batchIds.add(batch.batchId);
            operationCount += batch.operationCount;
            update({ operationCount });
            followRevision(batch.revision, scope);
            if (completed) {
              rememberRecovery();
              reconcileLateApplied();
            }
          },
        };
        try {
          try {
            await readHistory(job);
            check(job);
            scope.failure.value = null;
            scope.failedPrompt.value = null;
            scope.failedAttachments.value = [];
            const now = new Date().toISOString();
            saved.records.set(key, record);
            saved.items = [
              ...saved.items,
              {
                id: userKey,
                role: "user",
                kind,
                text: userText,
                attachments: attachments.map((file) => ({
                  name: file.name,
                  kind: file.type === "application/pdf" ? "pdf" : "image",
                })),
                operationCount: 0,
                undone: false,
                canUndo: false,
                canRedo: false,
                createdAt: now,
                status: "done",
              },
              {
                id: key,
                role: "assistant",
                kind,
                text: "",
                attachments: [],
                operationCount: 0,
                undone: false,
                canUndo: false,
                canRedo: false,
                createdAt: now,
                status: "streaming",
              },
            ];
            scope.messages.value = saved.items;
            await abortable(settle(scope), job.controller.signal);
            check(job);
            const result = await abortable(
              call(requestBase(scope.id), handlers, controller.signal),
              controller.signal,
            );
            check(job);
            if (refusal) throw refusal;
            if (result.text !== "") text = result.text;
            if (result.messageId !== null && conversation) {
              const previousKey = key;
              key = result.messageId;
              saved.storedIds.add(key);
              saved.records.delete(previousKey);
              saved.records.set(key, record);
              patch(scope, previousKey, { id: key });
            }
            update({ text, status: "done" });
            outcome = { messageId: key, operationCount, text, failed: false };
          } catch (caught) {
            const error = refusal ?? caught;
            interrupted = controller.signal.aborted || isAbort(error);
            if (!interrupted) report(error);
            if (operationCount === 0 && (!interrupted || text === "")) {
              saved.items = saved.items.filter(
                (item) => item.id !== key && item.id !== userKey,
              );
              if (isCurrent(scope)) {
                scope.messages.value = saved.items;
                if (!interrupted) {
                  if (kind === "chat") {
                    scope.failedPrompt.value = userText;
                    scope.failedAttachments.value = attachments;
                  }
                  scope.failure.value = {
                    error: asError(error),
                    context: "turn",
                  };
                }
              }
              outcome = {
                messageId: null,
                operationCount: 0,
                text: "",
                failed: !interrupted,
              };
            } else {
              update({
                status: interrupted ? "done" : "failed",
                failure: interrupted
                  ? undefined
                  : { error: asError(error), context: "turn" },
              });
              outcome = {
                messageId: key,
                operationCount,
                text,
                failed: !interrupted,
              };
            }
          }

          // Recovery belongs to the turn, even after Stop. Switching templates
          // still discards it; a user Stop retains the changes already applied.
          if (
            conversation &&
            outcome.messageId !== null &&
            operationCount > 0 &&
            (outcome.failed || interrupted)
          ) {
            rememberRecovery();
          }
          let observed: number;
          do {
            observed = operationCount;
            if (
              record.serverApplied &&
              !collaboration &&
              options.reload &&
              isCurrent(scope)
            ) {
              await reloadCurrent(job, true).catch((error) => {
                if (isCurrent(scope)) report(error);
              });
            }
            if (
              conversation &&
              saved.recoveries.has(turn) &&
              isCurrent(scope)
            ) {
              await readHistory(job, true, true);
              const recovered = saved.recoveries.get(turn);
              if (recovered) {
                outcome.messageId = recovered.item.id;
                outcome.text = recovered.item.text;
              }
            }
          } while (
            isCurrent(scope) &&
            record.serverApplied &&
            observed !== operationCount
          );
          outcome.operationCount = operationCount;
          // Stop may arrive during the final reload, after the provider-call
          // catch. Applied edits and recovery remain, but the turn did not finish.
          if (interrupted || controller.signal.aborted) outcome.failed = true;
          return outcome;
        } finally {
          completed = true;
          scope.messages.value = saved.items;
        }
      },
      emptyOutcome,
    );
  }

  // --- Undo and Redo of a message (D13, D14) ------------------------------------

  function replay(id: string, direction: "undo" | "redo"): Promise<void> {
    const scope = scopeOf();
    if (!scope || scope.busy.value) return Promise.resolve();
    return enqueue(
      "replay",
      scope,
      async (job) => {
        const saved = scope.memory;
        const item = saved.items.find((item) => item.id === id);
        if (!item) return;
        const remote = conversation?.[direction];
        const record = saved.records.get(id);
        try {
          check(job);
          if (saved.storedIds.has(id)) {
            if (typeof remote !== "function") {
              throw new SdkError(
                `This AI backend does not support ${direction}.`,
                403,
                "feature_unavailable",
              );
            }
            if (item.undone !== (direction === "redo")) return;
            const answer = await abortable(
              remote(scope.id, id, {
                sessionId: collaboration
                  ? collaboration.core.sessionId
                  : localSessionId,
              }),
              scope.lifetime.signal,
            );
            if (!isCurrent(scope)) return;
            if ("operations" in answer) {
              if (job.controller.signal.aborted) return;
              const result = applyOps(
                answer.operations,
                `${direction}:${id}:${crypto.randomUUID()}`,
                scope,
              );
              if (result.applied) {
                patch(scope, id, {
                  undone: direction === "undo",
                  failure: undefined,
                });
              }
              try {
                await abortable(
                  conversation!.settleReplay(scope.id, id, {
                    replayId: answer.replayId,
                    direction,
                    applied: result.applied,
                    sessionId: collaboration
                      ? collaboration.core.sessionId
                      : localSessionId,
                  }),
                  scope.lifetime.signal,
                );
              } catch (error) {
                if (!isCurrent(scope)) return;
                report(error);
                patch(scope, id, {
                  failure: { error: asError(error), context: direction },
                });
              }
              if (!isCurrent(scope)) return;
              if (!result.applied)
                throw new CollaborationConflict(result.message, {
                  code: result.code,
                  opIndex: result.opIndex,
                });
              return;
            } else {
              patch(scope, id, {
                undone: direction === "undo",
                failure: undefined,
              });
              if (collaboration) followRevision(answer.applied.revision, scope);
              else if (options.reload) await reloadCurrent(job, true);
              else
                throw new SdkError(
                  AI_MISSING_PROVIDER_MESSAGE,
                  502,
                  "ai_provider_error",
                );
              return;
            }
          } else {
            if (item.undone !== (direction === "redo")) return;
            const ops = direction === "undo" ? record?.inverse : record?.redo;
            if (!record || record.serverApplied || !ops || ops.length === 0)
              return;
            const result = applyOps(
              ops,
              `${direction}:${id}:${crypto.randomUUID()}`,
              scope,
            );
            if (!result.applied)
              throw new CollaborationConflict(result.message, {
                code: result.code,
                opIndex: result.opIndex,
              });
            if (direction === "undo") record.redo = result.inverse;
            else record.inverse = result.inverse;
          }
          patch(scope, id, {
            undone: direction === "undo",
            failure: undefined,
          });
        } catch (error) {
          if (!isCurrent(scope) || isAbort(error)) return;
          report(error);
          patch(scope, id, {
            failure: { error: asError(error), context: direction },
          });
        }
      },
      () => {},
    );
  }

  // --- History (D14) -----------------------------------------------------------

  function toItem(message: AiChatMessage, saved: Memory): AiChatItem {
    const item: AiChatItem = {
      id: message.id,
      role: message.role,
      kind: message.kind,
      text: message.text,
      attachments: message.attachments ?? [],
      operationCount: sum(message),
      undone: message.undone,
      canUndo: false,
      canRedo: false,
      createdAt: message.createdAt,
      status: "done",
    };
    return { ...item, ...replayAvailability(item, saved) };
  }

  function mergeHistory(list: AiChatMessage[], saved: Memory): AiChatItem[] {
    for (const message of list) saved.storedIds.add(message.id);
    const previous = new Map(saved.items.map((item) => [item.id, item]));
    let items = list.map((message) => {
      const item = toItem(message, saved);
      const old = previous.get(item.id);
      return old?.status === "failed"
        ? { ...item, status: old.status, failure: old.failure }
        : item;
    });
    for (const recovery of saved.recoveries.values()) {
      const { item, record } = recovery;
      // Only persisted identity can associate a local failure with a stored
      // message. Other sessions may append messages of the same kind at any time.
      const matches = list.filter(
        (message) =>
          message.role === "assistant" &&
          message.kind === item.kind &&
          (message.id === item.id ||
            (record.batchIds.size > 0 &&
              [...record.batchIds].every((id) =>
                message.batches.some((batch) => batch.batchId === id),
              ))),
      );
      const persisted = matches.length === 1 ? matches[0] : undefined;
      if (persisted) {
        saved.records.delete(item.id);
        saved.records.set(persisted.id, record);
        const reconciled = {
          ...toItem(persisted, saved),
          status: item.status,
          failure: item.failure,
        };
        recovery.item = reconciled;
        items = items.map((row) =>
          row.id === persisted.id ? reconciled : row,
        );
      } else {
        if (recovery.user && !items.some((row) => row.id === recovery.user!.id))
          items.push(recovery.user);
        items.push({ ...item, ...replayAvailability(item, saved) });
      }
    }
    return items;
  }

  async function readHistory(
    job: Job,
    force = false,
    recoverStopped = false,
    token = job.scope.historyGeneration,
  ): Promise<void> {
    const { scope } = job;
    if (
      !isCurrent(scope) ||
      token !== scope.historyGeneration ||
      (!recoverStopped && job.controller.signal.aborted)
    )
      return;
    if (!force && scope.loaded) return;
    const saved = scope.memory;
    if (!conversation) {
      scope.messages.value = saved.items;
      scope.loaded = true;
      return;
    }
    scope.isLoadingHistory.value = true;
    scope.loaded = false;
    try {
      const request = conversation.list(scope.id).then((list) => {
        if (
          destroyed ||
          saved.generation !== scope.generation ||
          token !== scope.historyGeneration ||
          (!recoverStopped &&
            (!isCurrent(scope) || job.controller.signal.aborted))
        )
          return;
        // A late recovery can reconcile remembered A, but only A's session refs
        // are published. The public refs may already belong to B or a new A.
        saved.items = mergeHistory(list, saved);
        scope.messages.value = saved.items;
        scope.loaded = true;
        if (scope.failure.value?.context === "history")
          scope.failure.value = null;
      });
      await abortable(
        request,
        recoverStopped ? scope.lifetime.signal : job.controller.signal,
      );
    } catch (error) {
      if (
        !isCurrent(scope) ||
        token !== scope.historyGeneration ||
        isAbort(error)
      )
        return;
      report(error);
      scope.failure.value = { error: asError(error), context: "history" };
    } finally {
      if (token === scope.historyGeneration)
        scope.isLoadingHistory.value = false;
    }
  }

  function loadConversation(scope = scopeOf()): Promise<void> {
    if (!scope || !isCurrent(scope)) return Promise.resolve();
    if (scope.pendingHistory?.generation === scope.historyGeneration)
      return scope.pendingHistory.promise;
    if (scope.loaded) return Promise.resolve();
    const token = scope.historyGeneration;
    const pending = { generation: token, promise: Promise.resolve() };
    const promise = enqueue(
      "history",
      scope,
      (job) => readHistory(job, false, false, token),
      () => {},
    );
    pending.promise = promise.finally(() => {
      if (scope.pendingHistory === pending) scope.pendingHistory = null;
    });
    scope.pendingHistory = pending;
    return pending.promise;
  }

  function newChat(): Promise<void> {
    const scope = scopeOf();
    if (
      !scope ||
      (conversation && typeof conversation.clear !== "function") ||
      (scope.active &&
        scope.active.kind !== "history" &&
        scope.active.kind !== "read") ||
      scope.queue.some((job) => job.kind !== "history" && job.kind !== "read")
    )
      return Promise.resolve();
    invalidateHistory(scope);
    scope.active?.controller.abort();
    return enqueue(
      "clear",
      scope,
      async () => {
        try {
          if (conversation && typeof conversation.clear === "function")
            await conversation.clear(scope.id);
          // A returning session owns a newer generation of this shared memory.
          // Its turns and replay records must survive this abandoned clear.
          if (scope.memory.generation !== scope.generation) return;
          // The backend cleared this template even if another session is current.
          memory.delete(scope.id);
          scope.memory.items = [];
          scope.memory.records.clear();
          scope.memory.storedIds.clear();
          scope.memory.recoveries.clear();
          invalidateHistory(scope);
          scope.messages.value = [];
          scope.loaded = true;
          scope.failure.value = null;
          scope.failedPrompt.value = null;
          scope.failedAttachments.value = [];
          if (isCurrent(scope)) memory.set(scope.id, scope.memory);
        } catch (error) {
          if (!isCurrent(scope)) return;
          report(error);
          scope.failure.value = { error: asError(error), context: "history" };
        }
      },
      () => {},
    );
  }

  // --- Panels (D17, D18) -------------------------------------------------------------

  function bootstrap(scope: Session): void {
    if (!isCurrent(scope)) return;
    void loadConversation(scope);
  }

  function open(next: AiPanel): void {
    const scope = scopeOf();
    if (!scope || !isCurrent(scope)) return;
    if (panel.value !== next && scope.busy.value) stop();
    panel.value = next;
    if (options.commentsOpen) options.commentsOpen.value = false;
    if (next === "chat") bootstrap(scope);
  }

  function startImport(files: File[]): void {
    if (files.length === 0 || !has("chatAttachments")) return;
    importQueue.value = [...files];
    open("chat");
  }

  function stopSession(scope: Session): void {
    scope.active?.controller.abort();
    for (const job of scope.queue) {
      if (job.kind !== "reconcile") job.controller.abort();
    }
  }

  function abandon(scope: Session): void {
    scope.lifetime.abort();
    stopSession(scope);
    scope.busy.value = false;
    scope.isLoadingHistory.value = false;
    for (const timer of scope.timers) clearTimeout(timer);
    scope.timers.clear();
  }

  function stop(): void {
    const scope = scopeOf();
    if (scope) stopSession(scope);
  }

  function close(): void {
    stop();
    panel.value = null;
  }

  const watchers: (() => void)[] = [
    watch(
      () => editor.state.isDirty,
      (dirty, previous) => {
        // Core clears dirty during save only when that successful request covers
        // the current mutation revision. A failed or superseded save stays dirty.
        if (previous === true && dirty === false && editor.state.isSaving)
          keptYourVersion.value = false;
      },
      { flush: "sync" },
    ),
    watch(
      editor.content,
      () => {
        if (!applyingAi && !currentSession.value?.committingReload)
          authorVersion++;
      },
      { deep: true, flush: "sync" },
    ),
  ];
  if (options.commentsOpen) {
    watchers.push(
      watch(options.commentsOpen, (isOpen) => {
        if (isOpen) close();
      }),
    );
  }

  watchers.push(
    watch(
      () => editor.loadVersion?.value ?? templateId.value,
      () => {
        if (destroyed) return;
        const previous = currentSession.value;
        if (previous?.committingReload && isCurrent(previous)) {
          previous.committingReload = false;
          return;
        }
        if (previous) abandon(previous);
        const id = templateId.value;
        const next = id === null ? null : createSession(id);
        currentSession.value = next;
        if (next && panel.value === "chat") bootstrap(next);
      },
      { flush: "sync" },
    ),
  );

  async function draftAltText(
    blockId: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const scope = scopeOf();
    const altText = provider.altText;
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    const abandonDraft = () => controller.abort();
    try {
      signal?.throwIfAborted();
      if (!scope || typeof altText !== "function")
        throw new SdkError(
          "This AI feature isn't available.",
          403,
          "feature_unavailable",
        );
      const context = aiImageContext(editor.content.value, blockId);
      if (!context)
        throw new SdkError(
          "The image is no longer available.",
          409,
          "block_missing",
        );
      signal?.addEventListener("abort", abort, { once: true });
      scope.lifetime.signal.addEventListener("abort", abandonDraft, {
        once: true,
      });
      const { url, ...rest } = context;
      const answer = await abortable(
        altText(
          {
            templateId: scope.id,
            sessionId: collaboration
              ? collaboration.core.sessionId
              : localSessionId,
            blockId,
            image: { url },
            ...rest,
            locale: editor.content.value.settings.locale,
            maxLength: options.altMaxLength?.() ?? DEFAULT_ALT_MAX_LENGTH,
          },
          controller.signal,
        ),
        controller.signal,
      );
      controller.signal.throwIfAborted();
      if (!isCurrent(scope))
        throw new DOMException("The template changed.", "AbortError");
      return answer.alt;
    } catch (error) {
      report(error);
      throw error;
    } finally {
      signal?.removeEventListener("abort", abort);
      scope?.lifetime.signal.removeEventListener("abort", abandonDraft);
    }
  }

  function applyAltTexts(
    entries: Array<{
      blockId: string;
      alt: string;
      decorative: boolean;
      expect?: AiImageSnapshot;
    }>,
  ): Promise<void> {
    const scope = scopeOf();
    if (!scope || entries.length === 0) return Promise.resolve();
    const ops: Operation[] = entries.map(
      ({ blockId, alt, decorative, expect }) => ({
        op: "updateBlock",
        blockId,
        expect: {
          ...(expect ??
            aiImageSnapshot(editor.content.value, blockId) ?? {
              src: null,
              alt: null,
              decorative: null,
            }),
        },
        set: { alt, decorative },
      }),
    );
    return enqueue(
      "replay",
      scope,
      async (job) => {
        try {
          check(job);
          const turn = crypto.randomUUID();
          for (let start = 0; start < ops.length; start += 100) {
            check(job);
            const result = applyOps(ops.slice(start, start + 100), turn, scope);
            if (!result.applied)
              throw new CollaborationConflict(result.message, {
                code: result.code,
                opIndex: result.opIndex,
              });
          }
        } catch (error) {
          report(error);
          throw error;
        }
      },
      () => {},
    );
  }

  // --- The features ------------------------------------------------------------------

  return {
    capability: {
      isFeatureEnabled: (feature) => isAvailable.value && has(feature),
      open,
      startImport,
      highlightOf: (blockId) =>
        currentSession.value?.highlights.value.get(blockId) ?? null,
    },
    panel,
    open,
    close,
    has,
    templateId,
    sessionIdentity: computed(() => currentSession.value),
    templateSession: computed(
      () => editor.loadVersion?.value ?? templateId.value,
    ),
    isAvailable,
    hasConversation: conversation !== null,
    canClear: conversation === null || typeof conversation.clear === "function",
    messages,
    isLoadingHistory,
    isRunning,
    busy: isRunning,
    failure,
    keptYourVersion,
    reloadTemplate: () => {
      const scope = scopeOf();
      return scope
        ? enqueue(
            "reconcile",
            scope,
            (job) => reloadCurrent(job),
            () => {},
          )
        : Promise.resolve();
    },
    failedPrompt,
    failedAttachments,
    importQueue,
    startImport,
    isTemplateEmpty,
    send: (message, attachments = []) => {
      const chat = provider.chat;
      return typeof chat === "function"
        ? runTurn(
            "chat",
            message,
            (base, handlers, signal) =>
              chat(
                {
                  ...base,
                  message,
                  selectedBlockId: selectedBlockId(),
                  attachments: attachments.map((file) => ({
                    file,
                    name: file.name,
                    kind: file.type === "application/pdf" ? "pdf" : "image",
                  })),
                },
                handlers,
                signal,
              ),
            attachments,
          )
        : Promise.resolve({
            messageId: null,
            operationCount: 0,
            text: "",
            failed: true,
          });
    },
    fix: (finding) => {
      const fixFinding = provider.fixFinding;
      return typeof fixFinding === "function"
        ? runTurn("fix", `Fix: ${finding.message}`, (base, handlers, signal) =>
            fixFinding({ ...base, finding }, handlers, signal),
          )
        : Promise.resolve({
            messageId: null,
            operationCount: 0,
            text: "",
            failed: true,
          });
    },
    stop,
    newChat,
    undoMessage: (id) => replay(id, "undo"),
    redoMessage: (id) => replay(id, "redo"),
    rewrite: (input, onText, signal) => {
      const scope = scopeOf();
      const rewrite = provider.rewrite;
      if (!scope || typeof rewrite !== "function")
        return Promise.reject(new Error("Rewrite isn't available."));
      return enqueue(
        "read",
        scope,
        async (job) => {
          const abort = () => job.controller.abort(signal.reason);
          signal.addEventListener("abort", abort, { once: true });
          try {
            signal.throwIfAborted();
            check(job);
            return await abortable(
              rewrite(
                { ...requestBase(scope.id), ...input },
                {
                  onText: (text) => {
                    check(job);
                    onText(text);
                  },
                },
                job.controller.signal,
              ),
              job.controller.signal,
            );
          } catch (error) {
            report(error);
            throw error;
          } finally {
            signal.removeEventListener("abort", abort);
          }
        },
        () => {
          throw new DOMException("Rewrite stopped.", "AbortError");
        },
      );
    },
    draftAltText,
    applyAltTexts,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      const scope = currentSession.value;
      if (scope) abandon(scope);
      currentSession.value = null;
      for (const unwatch of watchers) unwatch();
      watchers.length = 0;
    },
  };
}
