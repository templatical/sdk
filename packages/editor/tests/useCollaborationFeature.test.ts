import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { useEditor } from "@templatical/core";
import type {
  BlockLock,
  BlockLockHolder,
  CollaborationActor,
  CollaborationMember,
  CollaborationProvider,
  CollaborationRemoteChange,
  Operation,
  TemplateContent,
} from "@templatical/types";
import { CollaborationConflict, safeClone } from "@templatical/types";
import {
  AGENT_EDIT_MERGE_MS,
  AGENT_HIGHLIGHT_MS,
  COLLABORATION_NOTICE_MS,
  summarizeAgentEdit,
  useCollaborationFeature,
} from "../src/composables/useCollaborationFeature";

const CONTENT = {
  blocks: [
    { id: "t1", type: "title", content: "Hi" },
    { id: "p1", type: "paragraph", content: "Body" },
  ],
  settings: { width: 600 },
} as unknown as TemplateContent;

const GRACE: BlockLockHolder = {
  sessionId: "s-grace-1",
  type: "user",
  id: "u-2",
  name: "Grace",
  color: "#ef4444",
};
const GUEST: BlockLockHolder = {
  sessionId: "g-1",
  type: "guest",
  id: "guest:g-1",
  name: "Guest",
  color: "#10b981",
};

function member(
  sessionId: string,
  userId: string | null,
  name: string,
  color = "#3b82f6",
): CollaborationMember {
  return {
    sessionId,
    userId,
    name,
    type: userId === null ? "guest" : "user",
    color,
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

async function open(options: {
  members?: (selfSessionId: string) => CollaborationMember[];
  locks?: BlockLock[];
  acquireLock?: CollaborationProvider["acquireLock"];
  onRemoteChange?: (change: CollaborationRemoteChange) => void;
}) {
  const provider: CollaborationProvider = {
    join: vi.fn(async (_templateId, session) => ({
      revision: 0,
      locks: options.locks ?? [],
      members: options.members?.(session.sessionId) ?? [],
      leave: () => {},
    })),
    submit: vi.fn(async () => ({ revision: 1 })),
    operationsAfter: vi.fn(async () => ({ revision: 0, batches: [] })),
    acquireLock:
      options.acquireLock ??
      vi.fn(async (_templateId: string, blockId: string) => ({
        blockId,
        holder: { ...GRACE, sessionId: "me" },
        expiresAt: "2026-10-19T12:00:30.000Z",
      })),
    renewLock: vi.fn(),
    releaseLock: vi.fn(async () => {}),
  };
  // Each editor gets its own copy: remote batches render into the editor's
  // content in place, and a shared object would carry one test's edits into
  // every earlier test's still-live controller.
  const content = () => safeClone(CONTENT);
  const scope = effectScope();
  const { feature, editor } = scope.run(() => {
    const feature = useCollaborationFeature({
      provider,
      loadTemplate: async (id) => ({ id, revision: 0, content: content() }),
      user: { id: "u-1", name: "Ada" },
      onRemoteChange: options.onRemoteChange,
    });
    const editor = useEditor({
      content: content(),
      templates: {
        load: async (id) => ({ id, revision: 0, content: content() }),
        create: false,
        save: false,
      },
      lockedBlocks: feature.locks,
    });
    feature.attach(editor);
    return { feature, editor };
  })!;
  await editor.load("tpl-1");
  await settle();
  return { feature, editor, provider, scope };
}

describe("useCollaborationFeature", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists everyone else once per person, guests one by one", async () => {
    const { feature } = await open({
      members: (self) => [
        member(self, "u-1", "Ada"),
        member("s-ada-2", "u-1", "Ada"),
        member("s-grace-1", "u-2", "Grace", "#ef4444"),
        member("s-grace-2", "u-2", "Grace", "#ef4444"),
        member("g-1", null, "Guest", "#10b981"),
        member("g-2", null, "Guest", "#f59e0b"),
      ],
    });

    expect(feature.isLive.value).toBe(true);
    expect(feature.people.value).toEqual([
      { key: "user:u-2", type: "user", name: "Grace", color: "#ef4444" },
      { key: "guest:g-1", type: "guest", name: "Guest", color: "#10b981" },
      { key: "guest:g-2", type: "guest", name: "Guest", color: "#f59e0b" },
    ]);
  });

  it("isn't live without presence", async () => {
    const { feature } = await open({});

    expect(feature.isLive.value).toBe(false);
    expect(feature.people.value).toEqual([]);
  });

  it("answers lockOf from others' locks", async () => {
    const lock = {
      blockId: "p1",
      holder: GRACE,
      expiresAt: "2026-10-19T12:00:30.000Z",
    };
    const { feature } = await open({ locks: [lock] });

    expect(feature.capability.lockOf("p1")).toEqual(lock);
    expect(feature.capability.lockOf("t1")).toBe(null);
  });

  it("says who holds a block it couldn't select, for five seconds", async () => {
    const { feature, editor } = await open({
      acquireLock: vi.fn(async () => {
        throw new CollaborationConflict("Held.", {
          code: "lock_held",
          holder: GUEST,
        });
      }),
    });

    editor.selectBlock("t1");
    await settle();

    expect(feature.notices.value).toEqual([
      { id: 1, kind: "selectionRefused", name: "Guest", isGuest: true },
    ]);
    expect(editor.state.selectedBlockId).toBe(null);

    await vi.advanceTimersByTimeAsync(COLLABORATION_NOTICE_MS);
    expect(feature.notices.value).toEqual([]);
  });

  it("names each holder of a refused replace once", async () => {
    const { feature } = await open({});

    feature.reportReplaceRefused([
      GRACE,
      { ...GRACE, sessionId: "s-grace-2" },
      GUEST,
      { ...GUEST, sessionId: "g-2", id: "guest:g-2" },
    ]);

    expect(feature.notices.value).toEqual([
      {
        id: 1,
        kind: "replaceRefused",
        holders: [
          { name: "Grace", isGuest: false },
          { name: "Guest", isGuest: true },
          { name: "Guest", isGuest: true },
        ],
      },
    ]);
  });

  it("keeps one notice at a time and dismisses on request", async () => {
    const { feature } = await open({});
    feature.reportReplaceRefused([GRACE]);
    feature.reportReplaceRefused([GUEST]);

    expect(feature.notices.value.map((notice) => notice.id)).toEqual([2]);

    feature.dismissNotice(2);
    expect(feature.notices.value).toEqual([]);
  });

  it("hands undo and redo to the controller and records nothing itself", async () => {
    const { feature } = await open({});

    expect(feature.history.undo).toBe(feature.core.undo);
    expect(feature.history.redo).toBe(feature.core.redo);
    expect(feature.history.clear).toBe(feature.core.clearHistory);
    expect(feature.history.canUndo).toBe(feature.core.canUndo);
    expect(() => feature.history.record()).not.toThrow();
  });
});

describe("useCollaborationFeature — agents' edits", () => {
  const CLAUDE: CollaborationActor = {
    type: "mcp",
    id: "u-1",
    name: "Ada",
    sessionId: null,
    client: "Claude",
  };
  const editTitle: Operation = {
    op: "updateBlock",
    blockId: "t1",
    set: { content: "A" },
  };
  const moveParagraph: Operation = {
    op: "moveBlock",
    blockId: "p1",
    parent: null,
    after: null,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Open, and deliver batches and re-syncs the way a backend's broadcast does. */
  async function openWithAgent(
    onRemoteChange?: (change: CollaborationRemoteChange) => void,
  ) {
    const opened = await open({ onRemoteChange });
    const handlers = vi.mocked(opened.provider.join).mock.calls[0][2];
    let revision = 0;
    async function deliver(
      ops: Operation[],
      actor: CollaborationActor = CLAUDE,
    ): Promise<void> {
      revision += 1;
      handlers.onBatch({ revision, batchId: `b-${revision}`, actor, ops });
      await settle();
    }
    /** Announce the next revision as a re-sync; its batch can follow with `deliver`. */
    async function resync(actor?: CollaborationActor): Promise<void> {
      handlers.onResync(revision + 1, actor);
      await settle();
    }
    return { ...opened, deliver, resync };
  }

  it.each<[string, Operation[], ReturnType<typeof summarizeAgentEdit>]>([
    [
      "added, moved, deleted and updated blocks, each once",
      [
        {
          op: "addBlock",
          block: { id: "n1", type: "divider" } as never,
          parent: null,
          after: null,
        },
        moveParagraph,
        { op: "deleteBlock", blockId: "d9" },
        editTitle,
        editTitle,
      ],
      {
        blockIds: ["n1", "p1", "d9", "t1"],
        settings: false,
        templateUpdated: false,
      },
    ],
    [
      "the template settings",
      [{ op: "updateSettings", set: { width: 640 } }],
      { blockIds: [], settings: true, templateUpdated: false },
    ],
    [
      "a replaced template",
      [{ op: "setContent", content: CONTENT }],
      { blockIds: [], settings: false, templateUpdated: true },
    ],
  ])("summarizes %s", (_label, ops, summary) => {
    expect(summarizeAgentEdit(ops)).toEqual(summary);
  });

  it("says which agent changed how many blocks, for whom", async () => {
    const { feature, deliver } = await openWithAgent();

    await deliver([
      editTitle,
      moveParagraph,
      { ...editTitle, set: { content: "B" } },
    ]);

    expect(feature.notices.value).toEqual([
      {
        id: expect.any(Number),
        kind: "agentEdited",
        client: "Claude",
        name: "Ada",
        blocks: 2,
        settings: false,
        templateUpdated: false,
      },
    ]);
  });

  it("merges one agent's batches within 2 s into one notice, up 5 s after the last", async () => {
    const { feature, deliver } = await openWithAgent();

    await deliver([editTitle]);
    const [first] = feature.notices.value;
    await vi.advanceTimersByTimeAsync(AGENT_EDIT_MERGE_MS - 500);
    await deliver([{ ...editTitle, set: { content: "B" } }, moveParagraph]);

    expect(feature.notices.value).toEqual([{ ...first, blocks: 2 }]);
    await vi.advanceTimersByTimeAsync(COLLABORATION_NOTICE_MS - 1);
    expect(feature.notices.value).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(feature.notices.value).toEqual([]);
  });

  it("opens a new notice for a batch more than 2 s after the last", async () => {
    const { feature, deliver } = await openWithAgent();

    await deliver([editTitle]);
    const [first] = feature.notices.value;
    await vi.advanceTimersByTimeAsync(AGENT_EDIT_MERGE_MS + 1);
    await deliver([moveParagraph]);

    expect(feature.notices.value).toHaveLength(1);
    expect(feature.notices.value[0].id).not.toBe(first.id);
    expect(feature.notices.value[0]).toMatchObject({ blocks: 1 });
  });

  it("gives another agent, or the same agent for another user, a notice of its own", async () => {
    const { feature, deliver } = await openWithAgent();

    await deliver([editTitle]);
    const [first] = feature.notices.value;
    await deliver([moveParagraph], { ...CLAUDE, client: "Cursor" });
    const [second] = feature.notices.value;
    await deliver([editTitle], { ...CLAUDE, id: "u-2", name: "Grace" });
    const [third] = feature.notices.value;

    expect(new Set([first.id, second.id, third.id]).size).toBe(3);
    expect(second).toMatchObject({ client: "Cursor", name: "Ada", blocks: 1 });
    expect(third).toMatchObject({ client: "Claude", name: "Grace", blocks: 1 });
  });

  it("counts a settings change and a replaced template", async () => {
    const { feature, deliver } = await openWithAgent();

    await deliver([{ op: "updateSettings", set: { width: 640 } }]);
    expect(feature.notices.value[0]).toMatchObject({
      blocks: 0,
      settings: true,
      templateUpdated: false,
    });
    await deliver([{ op: "setContent", content: CONTENT }]);
    expect(feature.notices.value[0]).toMatchObject({
      settings: true,
      templateUpdated: true,
    });
  });

  it("reads an agent that sent no usable name as null", async () => {
    const { feature, deliver } = await openWithAgent();

    await deliver([editTitle], { ...CLAUDE, client: "  " });

    expect(feature.notices.value[0]).toMatchObject({ client: null });
  });

  it("stays quiet for people's and the API's batches", async () => {
    const { feature, deliver } = await openWithAgent();

    await deliver([editTitle], {
      type: "user",
      id: "u-2",
      name: "Grace",
      sessionId: "s-grace-1",
    });
    await deliver([moveParagraph], {
      type: "api",
      id: null,
      name: "API",
      sessionId: null,
    });

    expect(feature.notices.value).toEqual([]);
    expect(feature.capability.agentHighlightOf("t1")).toBe(null);
  });

  it("outlines the blocks an agent changed for 2 s, restarting on a later edit", async () => {
    const { feature, deliver } = await openWithAgent();

    await deliver([editTitle]);
    const first = feature.capability.agentHighlightOf("t1");
    expect(first).toEqual(expect.any(Number));
    expect(feature.capability.agentHighlightOf("p1")).toBe(null);

    await vi.advanceTimersByTimeAsync(1500);
    await deliver([{ ...editTitle, set: { content: "B" } }]);
    const second = feature.capability.agentHighlightOf("t1");
    expect(second).toEqual(expect.any(Number));
    expect(second).not.toBe(first);

    await vi.advanceTimersByTimeAsync(AGENT_HIGHLIGHT_MS - 1);
    expect(feature.capability.agentHighlightOf("t1")).toBe(second);
    await vi.advanceTimersByTimeAsync(1);
    expect(feature.capability.agentHighlightOf("t1")).toBe(null);
  });

  it("outlines nothing for a replaced template", async () => {
    const { feature, deliver } = await openWithAgent();

    await deliver([{ op: "setContent", content: CONTENT }]);

    expect(feature.capability.agentHighlightOf("t1")).toBe(null);
    expect(feature.capability.agentHighlightOf("p1")).toBe(null);
  });

  it("says an agent updated the template when its re-sync arrives, and outlines nothing", async () => {
    const { feature, resync } = await openWithAgent();

    await resync(CLAUDE);

    expect(feature.notices.value).toEqual([
      {
        id: expect.any(Number),
        kind: "agentEdited",
        client: "Claude",
        name: "Ada",
        blocks: 0,
        settings: false,
        templateUpdated: true,
      },
    ]);
    expect(feature.capability.agentHighlightOf("t1")).toBe(null);
  });

  it("folds the batch a re-sync's catch-up brings into the re-sync's notice", async () => {
    const { feature, deliver, resync } = await openWithAgent();

    await resync(CLAUDE);
    const [first] = feature.notices.value;
    await deliver([{ op: "setContent", content: CONTENT }]);

    expect(feature.notices.value).toEqual([first]);
  });

  it("stays quiet for a re-sync by a person, by the API, or by no one it names", async () => {
    const { feature, resync } = await openWithAgent();

    await resync({
      type: "user",
      id: "u-2",
      name: "Grace",
      sessionId: "s-grace-1",
    });
    await resync({ type: "api", id: null, name: "API", sessionId: null });
    await resync();

    expect(feature.notices.value).toEqual([]);
  });

  it("hands onRemoteChange the batch as it arrived", async () => {
    // guard: M8 leaves onRemoteChange as it was
    const onRemoteChange = vi.fn();
    const { deliver } = await openWithAgent(onRemoteChange);

    await deliver([editTitle]);

    expect(onRemoteChange).toHaveBeenCalledWith({
      actor: CLAUDE,
      ops: [editTitle],
    });
  });

  const AI: CollaborationActor = {
    type: "ai",
    id: "u-1",
    name: "Ada",
    sessionId: "s-ada-2",
  };

  it("names an AI batch as the AI acting for its user, outlines its blocks, and leaves it out of undo", async () => {
    const { feature, deliver } = await openWithAgent();

    await deliver([editTitle, moveParagraph], AI);

    expect(feature.notices.value).toEqual([
      {
        id: expect.any(Number),
        kind: "aiEdited",
        name: "Ada",
        blocks: 2,
        settings: false,
        templateUpdated: false,
      },
    ]);
    expect(feature.capability.agentHighlightOf("t1")).toEqual(
      expect.any(Number),
    );
    expect(feature.history.canUndo.value).toBe(false);
  });

  it("applies an AI batch this very editor asked for and only outlines it (D26)", async () => {
    const { feature, editor, deliver } = await openWithAgent();

    await deliver([editTitle], { ...AI, sessionId: feature.core.sessionId });

    expect(editor.content.value.blocks[0]).toMatchObject({ content: "A" });
    expect(feature.notices.value).toEqual([]);
    expect(feature.capability.agentHighlightOf("t1")).toEqual(
      expect.any(Number),
    );
  });

  it("shows no notice for the asker's own AI re-sync either (D26)", async () => {
    const { feature, resync } = await openWithAgent();

    await resync({ ...AI, sessionId: feature.core.sessionId });

    expect(feature.notices.value).toEqual([]);
  });

  it("says the AI updated the template when its re-sync arrives", async () => {
    const { feature, resync } = await openWithAgent();

    await resync(AI);

    expect(feature.notices.value).toEqual([
      {
        id: expect.any(Number),
        kind: "aiEdited",
        name: "Ada",
        blocks: 0,
        settings: false,
        templateUpdated: true,
      },
    ]);
  });

  it("merges the AI's batches within 2 s, apart from an agent's for the same user", async () => {
    const { feature, deliver } = await openWithAgent();

    await deliver([editTitle], AI);
    vi.advanceTimersByTime(AGENT_EDIT_MERGE_MS - 1);
    await deliver([moveParagraph], AI);
    const [merged] = feature.notices.value;
    expect(merged).toMatchObject({ kind: "aiEdited", blocks: 2 });

    await deliver([editTitle], CLAUDE);
    expect(feature.notices.value).toHaveLength(1);
    expect(feature.notices.value[0].id).not.toBe(merged.id);
    expect(feature.notices.value[0]).toMatchObject({
      kind: "agentEdited",
      client: "Claude",
    });
  });

  it("outlines blocks on request, with no notice (the asker's own AI turn)", async () => {
    const { feature } = await openWithAgent();

    feature.outline(["t1"]);

    expect(feature.notices.value).toEqual([]);
    expect(feature.capability.agentHighlightOf("t1")).toEqual(
      expect.any(Number),
    );
    vi.advanceTimersByTime(AGENT_HIGHLIGHT_MS);
    expect(feature.capability.agentHighlightOf("t1")).toBe(null);
  });
});
