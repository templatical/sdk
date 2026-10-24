import {
  computed,
  getCurrentScope,
  onScopeDispose,
  ref,
  shallowRef,
  type ComputedRef,
  type Ref,
} from "vue";
import {
  useCollaboration,
  type CollaborationEditor,
  type CollaborationNotice,
  type UseCollaborationReturn,
  type UseHistoryReturn,
} from "@templatical/core";
import type {
  BlockLock,
  BlockLockHolder,
  CollaborationActor,
  CollaborationConflictCode,
  CollaborationProvider,
  CollaborationRemoteChange,
  EditorUser,
  MergeTagsConfig,
  Operation,
  Template,
} from "@templatical/types";
import type { EditorCapabilities } from "../types/editor-capabilities";
import { normalizeRemoteOperations } from "../utils/normalizeMergeTagMarkup";

/** How long a notice stays up. */
export const COLLABORATION_NOTICE_MS = 5000;
/** An agent's batches closer together than this share one notice. */
export const AGENT_EDIT_MERGE_MS = 2000;
/** How long the blocks an agent changed stay outlined. */
export const AGENT_HIGHLIGHT_MS = 2000;

/** One person in the collaborator bar: a user's sessions, or one guest. */
export interface CollaborationPerson {
  key: string;
  type: "user" | "guest";
  /** The member's name; the bar shows its own word for a guest. */
  name: string;
  avatarUrl?: string;
  color: string;
}

/** `Omit` for each member of a union. */
type OmitEach<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** A notice the editor shows, in words the components translate. */
export type CollaborationNoticeView =
  | { id: number; kind: "selectionRefused"; name: string; isGuest: boolean }
  | {
      id: number;
      kind: "editRefused";
      code: CollaborationConflictCode;
      name?: string;
      isGuest?: boolean;
    }
  | { id: number; kind: "undoSkipped" }
  | {
      id: number;
      kind: "replaceRefused";
      holders: { name: string; isGuest: boolean }[];
    }
  | {
      id: number;
      kind: "agentEdited";
      /** The agent's name, or `null` when the backend sent none. */
      client: string | null;
      /** The user the agent acts for. */
      name: string;
      /** Distinct blocks the agent added, moved, deleted or updated. */
      blocks: number;
      /** The agent changed the template settings. */
      settings: boolean;
      /** The agent updated the whole template: a replace, a restore or a re-sync. */
      templateUpdated: boolean;
    }
  | {
      id: number;
      /** An AI changed the template for a user (`actor.type: "ai"`): Cloud, or a BYO backend honouring `origin: "ai"`. */
      kind: "aiEdited";
      /** The user who asked the AI. */
      name: string;
      blocks: number;
      settings: boolean;
      /** The AI built or replaced the whole template, or a re-sync came in. */
      templateUpdated: boolean;
    };

/** What one batch from an agent changed. */
export interface AgentEditSummary {
  /** The blocks its ops name: an added block's id, every other block op's `blockId`. */
  blockIds: string[];
  /** It has an `updateSettings`. */
  settings: boolean;
  /** It has a `setContent`, or it is a re-sync. */
  templateUpdated: boolean;
}

/** What a re-sync says: the template changed as a whole, and no blocks are named. */
const RESYNC_SUMMARY: AgentEditSummary = {
  blockIds: [],
  settings: false,
  templateUpdated: true,
};

/**
 * Read an agent's batch for its notice: the distinct blocks it names, and
 * whether it changed the settings or updated the whole template.
 */
export function summarizeAgentEdit(
  ops: readonly Operation[],
): AgentEditSummary {
  const blockIds = new Set<string>();
  let settings = false;
  let templateUpdated = false;
  for (const op of ops) {
    if (op.op === "addBlock") {
      if (typeof op.block?.id === "string") blockIds.add(op.block.id);
    } else if (op.op === "updateSettings") {
      settings = true;
    } else if (op.op === "setContent") {
      templateUpdated = true;
    } else {
      blockIds.add(op.blockId);
    }
  }
  return { blockIds: [...blockIds], settings, templateUpdated };
}

export interface UseCollaborationFeatureOptions {
  provider: CollaborationProvider;
  /** The templates provider's `load`, for a re-sync. */
  loadTemplate: (templateId: string) => Promise<Template>;
  /** `init({ user })`: the editor's own sessions are left out of the bar by it too. */
  user?: EditorUser;
  /**
   * `init({ mergeTags })`: another session's batch has its tokens turned into
   * tags with it as it arrives, the way loaded content does.
   */
  mergeTags?: MergeTagsConfig;
  onRemoteChange?: (change: CollaborationRemoteChange) => void;
  onError?: (error: Error) => void;
}

export interface UseCollaborationFeatureReturn {
  core: UseCollaborationReturn;
  /** Others' locks, read by `useEditor` before the controller attaches. */
  locks: UseCollaborationReturn["locks"];
  /** Wire the controller to the editor; call once, after `useEditor()`. */
  attach: (editor: CollaborationEditor) => void;
  /** Undo and redo by inverse batches, in place of the snapshot history. */
  history: UseHistoryReturn;
  /** Everyone else, one entry per person; empty without presence. */
  people: ComputedRef<CollaborationPerson[]>;
  /** Presence is live: the bar shows. */
  isLive: ComputedRef<boolean>;
  connection: UseCollaborationReturn["connection"];
  notices: Ref<CollaborationNoticeView[]>;
  dismissNotice: (id: number) => void;
  /** Say a whole-template replace was refused, naming who holds locks. */
  reportReplaceRefused: (holders: readonly BlockLockHolder[]) => void;
  /**
   * Outline blocks for AGENT_HIGHLIGHT_MS, with no notice: the editor that
   * asked an AI shows its own turn's changes this way (D26).
   */
  outline: (blockIds: readonly string[]) => void;
  capability: NonNullable<EditorCapabilities["collaboration"]>;
}

/** One agent's, or the AI's, run of batches and re-syncs while they share a notice. */
interface AgentRun {
  /** The actor type, the user it acts for and, for an agent, its own name. */
  key: string;
  noticeId: number;
  lastAt: number;
  blockIds: Set<string>;
  settings: boolean;
  templateUpdated: boolean;
}

/**
 * Shared glue for collaboration: the controller from `@templatical/core`, the
 * history it replaces, the people the bar shows and the notices — an AI
 * agent's and an AI's edits included, with the outline on the blocks
 * they changed.
 *
 * Built before `useEditor()`, because the editor reads others' locks from it;
 * `attach` wires it to the editor right after.
 */
export function useCollaborationFeature(
  options: UseCollaborationFeatureOptions,
): UseCollaborationFeatureReturn {
  const notices = ref<CollaborationNoticeView[]>([]);
  let nextNoticeId = 1;
  const dismissTimers = new Map<number, ReturnType<typeof setTimeout>>();

  /** Start, or restart, a notice's countdown to dismissal. */
  function armDismiss(id: number): void {
    const running = dismissTimers.get(id);
    if (running) clearTimeout(running);
    dismissTimers.set(
      id,
      setTimeout(() => dismissNotice(id), COLLABORATION_NOTICE_MS),
    );
  }

  function show(notice: OmitEach<CollaborationNoticeView, "id">): number {
    const id = nextNoticeId++;
    // One at a time: a newer notice replaces the one on screen.
    notices.value = [{ ...notice, id }];
    armDismiss(id);
    return id;
  }

  function dismissNotice(id: number): void {
    const running = dismissTimers.get(id);
    if (running) {
      clearTimeout(running);
      dismissTimers.delete(id);
    }
    notices.value = notices.value.filter((notice) => notice.id !== id);
  }

  function onNotice(notice: CollaborationNotice): void {
    if (notice.type === "selectionRefused") {
      show({
        kind: "selectionRefused",
        name: notice.holder.name,
        isGuest: notice.holder.type === "guest",
      });
    } else if (notice.type === "editRefused") {
      show({
        kind: "editRefused",
        code: notice.code,
        ...(notice.holder
          ? {
              name: notice.holder.name,
              isGuest: notice.holder.type === "guest",
            }
          : {}),
      });
    } else {
      show({ kind: "undoSkipped" });
    }
  }

  // --- Agents' edits ---------------------------------------------------------

  let agentRun: AgentRun | null = null;
  const highlights = shallowRef<ReadonlyMap<string, number>>(new Map());
  const highlightTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let highlightSequence = 0;

  /** Outline `blockIds` for AGENT_HIGHLIGHT_MS, under one new number. */
  function highlight(blockIds: readonly string[]): void {
    if (blockIds.length === 0) return;
    const sequence = ++highlightSequence;
    const next = new Map(highlights.value);
    for (const blockId of blockIds) {
      next.set(blockId, sequence);
      const running = highlightTimers.get(blockId);
      if (running) clearTimeout(running);
      highlightTimers.set(
        blockId,
        setTimeout(() => {
          highlightTimers.delete(blockId);
          const rest = new Map(highlights.value);
          rest.delete(blockId);
          highlights.value = rest;
        }, AGENT_HIGHLIGHT_MS),
      );
    }
    highlights.value = next;
  }

  /**
   * An agent's or the AI's batch or re-sync: a notice naming who acted and
   * for whom, and an outline on the blocks a batch changed. Batches and
   * re-syncs from one of them within AGENT_EDIT_MERGE_MS of each other update
   * one notice while it is the one on screen, counting each block once — so
   * the batch a re-sync's catch-up brings lands in the re-sync's notice. The
   * editor that asked the AI only outlines its batches (D26).
   */
  function noteAgent(
    actor: CollaborationActor,
    summary: AgentEditSummary,
  ): void {
    if (actor.type !== "mcp" && actor.type !== "ai") return;
    const isAi = actor.type === "ai";
    // The editor that asked the AI outlines the change but shows no notice:
    // its chat already says "Applied N changes" (D26).
    if (isAi && actor.sessionId === core.sessionId) {
      if (!summary.templateUpdated) highlight(summary.blockIds);
      return;
    }
    const client =
      !isAi && typeof actor.client === "string" && actor.client.trim() !== ""
        ? actor.client
        : null;
    const key = `${actor.type}\n${actor.id ?? ""}\n${client ?? ""}`;
    const now = Date.now();

    let run = agentRun;
    if (
      !run ||
      run.key !== key ||
      now - run.lastAt > AGENT_EDIT_MERGE_MS ||
      notices.value.at(-1)?.id !== run.noticeId
    ) {
      run = {
        key,
        noticeId: 0,
        lastAt: now,
        blockIds: new Set(),
        settings: false,
        templateUpdated: false,
      };
    }
    for (const blockId of summary.blockIds) run.blockIds.add(blockId);
    run.settings ||= summary.settings;
    run.templateUpdated ||= summary.templateUpdated;
    run.lastAt = now;

    const counts = {
      blocks: run.blockIds.size,
      settings: run.settings,
      templateUpdated: run.templateUpdated,
    };
    const view: OmitEach<CollaborationNoticeView, "id"> = isAi
      ? { kind: "aiEdited", name: actor.name, ...counts }
      : { kind: "agentEdited", client, name: actor.name, ...counts };
    if (run === agentRun) {
      notices.value = [{ ...view, id: run.noticeId }];
      armDismiss(run.noticeId);
    } else {
      run.noticeId = show(view);
      agentRun = run;
    }
    if (!summary.templateUpdated) highlight(summary.blockIds);
  }

  const core = useCollaboration({
    provider: options.provider,
    loadTemplate: options.loadTemplate,
    normalizeRemoteOperations: (ops, content) =>
      normalizeRemoteOperations(ops, content, options.mergeTags),
    // The consumer's callback runs whatever happens to the notice: an
    // integrator's `onRemoteChange` must not depend on the editor's chrome.
    onRemoteChange: (change) => {
      try {
        noteAgent(change.actor, summarizeAgentEdit(change.ops));
      } finally {
        options.onRemoteChange?.(change);
      }
    },
    // An agent's replace or restore, an AI's built template, or a batch too
    // large to broadcast reaches live editors only as a re-sync: the template
    // changed as a whole.
    onRemoteResync: ({ actor }) => noteAgent(actor, RESYNC_SUMMARY),
    onNotice,
    onError: options.onError,
  });

  if (getCurrentScope()) {
    onScopeDispose(() => {
      for (const timer of dismissTimers.values()) clearTimeout(timer);
      for (const timer of highlightTimers.values()) clearTimeout(timer);
      dismissTimers.clear();
      highlightTimers.clear();
    });
  }

  const people = computed<CollaborationPerson[]>(() => {
    const members = core.members.value;
    const self = members.find((member) => member.sessionId === core.sessionId);
    const myUserId = self?.userId ?? options.user?.id ?? null;
    const byPerson = new Map<string, CollaborationPerson>();
    for (const member of members) {
      if (member.sessionId === core.sessionId) continue;
      if (member.userId !== null && member.userId === myUserId) continue;
      const key =
        member.userId !== null
          ? `user:${member.userId}`
          : `guest:${member.sessionId}`;
      if (byPerson.has(key)) continue;
      byPerson.set(key, {
        key,
        type: member.type,
        name: member.name,
        ...(member.avatarUrl ? { avatarUrl: member.avatarUrl } : {}),
        color: member.color,
      });
    }
    return [...byPerson.values()];
  });

  const history: UseHistoryReturn = {
    canUndo: core.canUndo,
    canRedo: core.canRedo,
    isNavigating: ref(false),
    undo: core.undo,
    redo: core.redo,
    // The controller captures every change by diffing; nothing to record.
    record: () => {},
    recordDebounced: () => {},
    clear: core.clearHistory,
    destroy: () => {},
  };

  return {
    core,
    locks: core.locks,
    attach: core.attach,
    history,
    people,
    isLive: computed(() => core.members.value.length > 0),
    connection: core.connection,
    notices,
    dismissNotice,
    reportReplaceRefused: (holders) =>
      show({
        kind: "replaceRefused",
        holders: [
          ...new Map(
            holders.map((holder) => [
              holder.type === "guest" ? `guest:${holder.sessionId}` : holder.id,
              { name: holder.name, isGuest: holder.type === "guest" },
            ]),
          ).values(),
        ],
      }),
    outline: highlight,
    capability: {
      lockOf: (blockId: string): BlockLock | null =>
        core.locks.value.get(blockId) ?? null,
      agentHighlightOf: (blockId: string): number | null =>
        highlights.value.get(blockId) ?? null,
    },
  };
}
