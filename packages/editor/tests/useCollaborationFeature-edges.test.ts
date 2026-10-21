import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { useEditor } from "@templatical/core";
import type {
  BlockLock,
  BlockLockHolder,
  CollaborationActor,
  CollaborationMember,
  CollaborationProvider,
  EditorUser,
  Operation,
  TemplateContent,
} from "@templatical/types";
import { CollaborationConflict, safeClone } from "@templatical/types";
import {
  AGENT_HIGHLIGHT_MS,
  COLLABORATION_NOTICE_MS,
  summarizeAgentEdit,
  useCollaborationFeature,
} from "../src/composables/useCollaborationFeature";

/**
 * The notices for a change the controller took back or an undo step it
 * dropped, the bar's people in the cases the main suite doesn't reach, agents'
 * batches that name less than usual, and the feature's timers once its editor
 * is gone.
 */

const CONTENT = {
  blocks: [
    { id: "t1", type: "title", content: "Hi" },
    { id: "p1", type: "paragraph", content: "Body" },
  ],
  settings: { width: 600 },
} as unknown as TemplateContent;

const GRACE: BlockLockHolder = {
  sessionId: "s-grace",
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
const GRACE_ACTOR: CollaborationActor = {
  type: "user",
  id: "u-2",
  name: "Grace",
  sessionId: "s-grace",
};
const CLAUDE: CollaborationActor = {
  type: "mcp",
  id: "u-1",
  name: "Ada",
  sessionId: null,
  client: "Claude",
};

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

async function open(
  options: {
    locks?: BlockLock[];
    members?: CollaborationMember[];
    submit?: CollaborationProvider["submit"];
    user?: EditorUser | null;
  } = {},
) {
  const provider: CollaborationProvider = {
    join: vi.fn(async () => ({
      revision: 0,
      locks: options.locks ?? [],
      members: options.members ?? [],
      leave: () => {},
    })),
    submit: options.submit ?? vi.fn(async () => ({ revision: 1 })),
    operationsAfter: vi.fn(async () => ({ revision: 0, batches: [] })),
  };
  const content = () => safeClone(CONTENT);
  const scope = effectScope();
  const { feature, editor } = scope.run(() => {
    const feature = useCollaborationFeature({
      provider,
      loadTemplate: async (id) => ({ id, revision: 0, content: content() }),
      user:
        options.user === null
          ? undefined
          : (options.user ?? { id: "u-1", name: "Ada" }),
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
  const handlers = vi.mocked(provider.join).mock.calls[0][2];
  return { feature, editor, provider, scope, handlers };
}

/** Remove p1 the way a canvas drag does: past the editor's own lock guard. */
function removeParagraph(editor: Awaited<ReturnType<typeof open>>["editor"]) {
  editor.setContent({
    ...editor.content.value,
    blocks: editor.content.value.blocks.filter((block) => block.id !== "p1"),
  });
}

describe("useCollaborationFeature — refused changes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["a person", GRACE, { name: "Grace", isGuest: false }],
    ["a guest", GUEST, { name: "Guest", isGuest: true }],
  ])(
    "names %s holding a block a change touched, when the change is taken back",
    async (_label, holder, named) => {
      const { feature, editor, provider } = await open({
        locks: [
          { blockId: "p1", holder, expiresAt: "2026-10-19T12:00:30.000Z" },
        ],
      });

      removeParagraph(editor);
      await settle();

      expect(feature.notices.value).toStrictEqual([
        { id: 1, kind: "editRefused", code: "lock_held", ...named },
      ]);
      expect(editor.content.value.blocks.map((block) => block.id)).toEqual([
        "t1",
        "p1",
      ]);
      expect(provider.submit).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(COLLABORATION_NOTICE_MS);
      expect(feature.notices.value).toEqual([]);
    },
  );

  it("names no one when the backend refuses a change without saying who", async () => {
    const { feature, editor } = await open({
      submit: vi.fn(async () => {
        throw new CollaborationConflict("Too large.", {
          code: "content_too_large",
        });
      }),
    });

    removeParagraph(editor);
    await settle();

    expect(feature.notices.value).toStrictEqual([
      { id: 1, kind: "editRefused", code: "content_too_large" },
    ]);
  });

  it("says an undo step no longer applies", async () => {
    const { feature, editor, handlers } = await open();
    editor.updateBlock("t1", { content: "Mine" } as never);
    feature.core.flush();
    await settle();
    handlers.onBatch({
      revision: 2,
      batchId: "grace-1",
      actor: GRACE_ACTOR,
      ops: [{ op: "deleteBlock", blockId: "t1" }],
    });
    await settle();

    feature.history.undo();
    await settle();

    expect(feature.notices.value).toStrictEqual([
      { id: 1, kind: "undoSkipped" },
    ]);
    expect(feature.history.canUndo.value).toBe(false);
  });
});

describe("useCollaborationFeature — people and notices", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function member(
    sessionId: string,
    userId: string | null,
    name: string,
    avatarUrl?: string,
  ): CollaborationMember {
    return {
      sessionId,
      userId,
      name,
      type: userId === null ? "guest" : "user",
      color: "#3b82f6",
      ...(avatarUrl ? { avatarUrl } : {}),
    };
  }

  it("shows a member's avatar", async () => {
    const { feature } = await open({
      members: [
        member("s-grace", "u-2", "Grace", "https://example.com/grace.png"),
        member("g-1", null, "Guest"),
      ],
    });

    expect(feature.people.value).toEqual([
      {
        key: "user:u-2",
        type: "user",
        name: "Grace",
        avatarUrl: "https://example.com/grace.png",
        color: "#3b82f6",
      },
      { key: "guest:g-1", type: "guest", name: "Guest", color: "#3b82f6" },
    ]);
  });

  it("without a user and before its own session is listed, shows everyone", async () => {
    const { feature } = await open({
      user: null,
      members: [
        member("s-ada-2", "u-1", "Ada"),
        member("s-grace", "u-2", "Grace"),
      ],
    });

    expect(feature.people.value.map((person) => person.key)).toEqual([
      "user:u-1",
      "user:u-2",
    ]);
  });

  it("changes nothing when a notice is dismissed twice, or one that isn't shown", async () => {
    const { feature } = await open();
    feature.reportReplaceRefused([GRACE]);

    feature.dismissNotice(1);
    feature.dismissNotice(1);
    feature.dismissNotice(99);
    expect(feature.notices.value).toEqual([]);

    feature.reportReplaceRefused([GUEST]);
    feature.dismissNotice(99);
    expect(feature.notices.value.map((notice) => notice.id)).toEqual([2]);
  });

  it("counts no block for an added block without an id", () => {
    expect(
      summarizeAgentEdit([
        {
          op: "addBlock",
          block: { type: "divider" },
          parent: null,
          after: null,
        } as unknown as Operation,
        { op: "deleteBlock", blockId: "t1" },
      ]),
    ).toEqual({ blockIds: ["t1"], settings: false, templateUpdated: false });
  });

  it("names an agent that acts for no user", async () => {
    const { feature, handlers } = await open();

    handlers.onBatch({
      revision: 1,
      batchId: "agent-1",
      actor: { ...CLAUDE, id: null, name: "Automation" },
      ops: [{ op: "deleteBlock", blockId: "p1" }],
    });
    await settle();

    expect(feature.notices.value).toEqual([
      {
        id: 1,
        kind: "agentEdited",
        client: "Claude",
        name: "Automation",
        blocks: 1,
        settings: false,
        templateUpdated: false,
      },
    ]);
  });
});

describe("useCollaborationFeature — teardown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("leaves no notice or outline timer running once its editor is gone", async () => {
    const { feature, scope, handlers } = await open();
    handlers.onBatch({
      revision: 1,
      batchId: "agent-1",
      actor: CLAUDE,
      ops: [{ op: "updateBlock", blockId: "t1", set: { content: "New" } }],
    });
    await settle();
    expect(feature.notices.value).toHaveLength(1);
    expect(feature.capability.agentHighlightOf("t1")).toBe(1);

    scope.stop();

    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(
      Math.max(COLLABORATION_NOTICE_MS, AGENT_HIGHLIGHT_MS),
    );
    // Nothing fired after teardown: what was on screen stays as it was.
    expect(feature.notices.value).toHaveLength(1);
    expect(feature.capability.agentHighlightOf("t1")).toBe(1);
  });

  it("can be built outside an effect scope without Vue warning about it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const feature = useCollaborationFeature({
      provider: {
        join: vi.fn(),
        submit: vi.fn(),
        operationsAfter: vi.fn(),
      },
      loadTemplate: vi.fn(),
    });
    feature.reportReplaceRefused([GRACE]);

    expect(feature.notices.value).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
    feature.core.destroy();
    warn.mockRestore();
  });
});
