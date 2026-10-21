import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed, effectScope } from "@vue/reactivity";
import type {
  Block,
  CollaborationActor,
  CollaborationRemoteChange,
  Operation,
  Template,
  TemplateContent,
  TemplatesProvider,
} from "@templatical/types";
import { CollaborationConflict, safeClone } from "@templatical/types";
import { useEditor } from "../src/editor";
import {
  COLLABORATION_GAP_TIMEOUT_MS,
  COLLABORATION_LOCK_RENEW_MS,
  COLLABORATION_TYPING_DEBOUNCE_MS,
  COLLABORATION_TYPING_MAX_WAIT_MS,
  useCollaboration,
  type CollaborationNotice,
  type UseCollaborationOptions,
} from "../src/collaboration";
import { FakeCollaborationServer } from "./helpers/fake-collaboration-server";

const BASE = {
  blocks: [
    { id: "t1", type: "title", content: "Hi" },
    {
      id: "s1",
      type: "section",
      columns: "2",
      children: [
        [{ id: "p1", type: "paragraph", content: "Left" }],
        [{ id: "b1", type: "button", text: "Go" }],
      ],
    },
    { id: "d1", type: "divider" },
  ],
  settings: { width: 600 },
} as unknown as TemplateContent;

/** Let promise chains and queued microtasks run. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

function ids(content: TemplateContent): string[] {
  return content.blocks.map((block) => block.id);
}

function text(content: TemplateContent, id = "t1"): unknown {
  return (
    content.blocks.find((block) => block.id === id) as unknown as {
      content?: string;
    }
  ).content;
}

async function openClient(
  server: FakeCollaborationServer,
  name: string,
  extra: Partial<
    Pick<
      UseCollaborationOptions,
      "normalizeRemoteOperations" | "loadTemplate" | "onRemoteResync"
    >
  > & { templates?: TemplatesProvider } = {},
) {
  const notices: CollaborationNotice[] = [];
  const remote: CollaborationRemoteChange[] = [];
  const errors: Error[] = [];
  const scope = effectScope();
  const provider = server.provider(name);
  const { editor, collaboration } = scope.run(() => {
    const collaboration = useCollaboration({
      provider,
      loadTemplate: extra.loadTemplate ?? (async () => server.template()),
      normalizeRemoteOperations: extra.normalizeRemoteOperations,
      onRemoteResync: extra.onRemoteResync,
      onNotice: (notice) => notices.push(notice),
      onRemoteChange: (change) => remote.push(change),
      onError: (error) => errors.push(error),
    });
    const editor = useEditor({
      content: safeClone(BASE),
      templates: extra.templates ?? server.templatesProvider(),
      lockedBlocks: collaboration.locks,
    });
    collaboration.attach(editor);
    return { editor, collaboration };
  })!;
  await editor.load(server.templateId);
  await settle();
  return { editor, collaboration, notices, remote, errors, scope, provider };
}

describe("useCollaboration", () => {
  let server: FakeCollaborationServer;

  beforeEach(() => {
    vi.useFakeTimers();
    server = new FakeCollaborationServer(BASE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("sending", () => {
    it("sends a structural change at once and confirms it", async () => {
      const a = await openClient(server, "Ada");

      a.editor.removeBlock("d1");
      await settle();

      expect(server.submits).toBe(1);
      expect(ids(server.content)).toEqual(["t1", "s1"]);
      expect(a.collaboration.revision.value).toBe(1);
      expect(a.collaboration.canUndo.value).toBe(true);
    });

    it("debounces typing into one block into one batch", async () => {
      const a = await openClient(server, "Ada");

      for (const value of ["H", "He", "Hey"]) {
        a.editor.updateBlock("t1", { content: value } as Partial<Block>);
        await settle();
      }
      expect(server.submits).toBe(0);

      await vi.advanceTimersByTimeAsync(COLLABORATION_TYPING_DEBOUNCE_MS);
      await settle();

      expect(server.submits).toBe(1);
      expect(text(server.content)).toBe("Hey");
    });

    it("still sends typing that never pauses", async () => {
      const a = await openClient(server, "Ada");

      for (let ms = 0; ms <= COLLABORATION_TYPING_MAX_WAIT_MS; ms += 100) {
        a.editor.updateBlock("t1", { content: `t${ms}` } as Partial<Block>);
        await settle();
        await vi.advanceTimersByTimeAsync(100);
      }

      expect(server.submits).toBe(1);
    });

    it("sends pending typing when the selection changes", async () => {
      const a = await openClient(server, "Ada");

      a.editor.updateBlock("t1", { content: "Typed" } as Partial<Block>);
      await settle();
      a.editor.selectBlock("d1");
      await settle();

      expect(text(server.content)).toBe("Typed");
    });

    it("keeps one batch in flight and sends the next after it", async () => {
      const a = await openClient(server, "Ada");
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const submit = a.provider.submit.bind(a.provider);
      const spy = vi
        .spyOn(a.provider, "submit")
        .mockImplementation(async (...args) => {
          await gate;
          return submit(...args);
        });

      a.editor.removeBlock("d1");
      await settle();
      a.editor.removeBlock("t1");
      await settle();
      expect(spy).toHaveBeenCalledTimes(1);

      release();
      await settle();

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[1][1].baseRevision).toBe(1);
      expect(ids(server.content)).toEqual(["s1"]);
    });

    it("retries a batch that failed in transit with the same batch id", async () => {
      const a = await openClient(server, "Ada");
      const submit = vi.spyOn(a.provider, "submit");
      server.failNextSubmit = new TypeError("Failed to fetch");

      a.editor.removeBlock("d1");
      await settle();
      expect(server.revision).toBe(0);

      await vi.advanceTimersByTimeAsync(1000);
      await settle();

      expect(server.revision).toBe(1);
      expect(submit.mock.calls[1][1].batchId).toBe(
        submit.mock.calls[0][1].batchId,
      );
    });

    it("settle() resolves once the backend confirmed everything", async () => {
      const a = await openClient(server, "Ada");

      a.editor.updateBlock("t1", { content: "Saved" } as Partial<Block>);
      await a.collaboration.settle();

      expect(text(server.content)).toBe("Saved");
    });
  });

  describe("receiving", () => {
    it("applies a batch the backend made for this session, such as an AI turn's, and keeps it out of undo (guard)", async () => {
      const a = await openClient(server, "Ada");

      server.pushAs(
        {
          type: "ai",
          id: "u-ada",
          name: "Ada",
          sessionId: a.collaboration.sessionId,
        },
        [{ op: "deleteBlock", blockId: "d1" }],
      );
      server.deliverAll();
      await settle();

      expect(ids(a.editor.content.value)).toEqual(["t1", "s1"]);
      expect(a.collaboration.revision.value).toBe(1);
      expect(a.remote).toEqual([
        {
          actor: expect.objectContaining({
            type: "ai",
            sessionId: a.collaboration.sessionId,
          }),
          ops: [{ op: "deleteBlock", blockId: "d1" }],
        },
      ]);
      expect(a.collaboration.canUndo.value).toBe(false);
      expect(a.editor.state.isDirty).toBe(false);
    });

    it("applies another session's batch in place, leaving other blocks' objects alone", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      const untouched = b.editor.content.value.blocks[1];

      a.editor.removeBlock("d1");
      await settle();
      server.deliverAll();
      await settle();

      expect(ids(b.editor.content.value)).toEqual(["t1", "s1"]);
      expect(b.editor.content.value.blocks[1]).toBe(untouched);
      expect(b.collaboration.revision.value).toBe(1);
      expect(b.remote).toEqual([
        {
          actor: expect.objectContaining({ name: "Ada", type: "user" }),
          ops: [{ op: "deleteBlock", blockId: "d1" }],
        },
      ]);
      expect(b.collaboration.canUndo.value).toBe(false);
      expect(b.editor.state.isDirty).toBe(false);
    });

    it("re-renders what a remote updateBlock or updateSettings changes", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      // Each read goes through the canvas's reactive state, as a block
      // component's render does. A computed caches until an effect triggers,
      // so a write that bypasses the reactive proxy leaves it stale.
      const title = computed(() => text(b.editor.content.value));
      const left = computed(
        () =>
          (
            b.editor.content.value.blocks[1] as unknown as {
              children: { content?: string }[][];
            }
          ).children[0][0].content,
      );
      const width = computed(() => b.editor.content.value.settings.width);
      expect([title.value, left.value, width.value]).toEqual([
        "Hi",
        "Left",
        600,
      ]);

      a.editor.updateBlock("t1", { content: "Hello" } as Partial<Block>);
      a.editor.updateBlock("p1", { content: "Right" } as Partial<Block>);
      a.editor.updateSettings({ width: 640 });
      await a.collaboration.settle();
      server.deliverAll();
      await settle();

      expect([title.value, left.value, width.value]).toEqual([
        "Hello",
        "Right",
        640,
      ]);
    });

    it("applies batches strictly by revision", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      a.editor.removeBlock("d1");
      await settle();
      a.editor.removeBlock("t1");
      await settle();

      const [first, second] = server
        .queueFor(b.collaboration.sessionId)
        .splice(0);
      second();
      await settle();
      expect(b.collaboration.revision.value).toBe(0);
      first();
      await settle();

      expect(b.collaboration.revision.value).toBe(2);
      expect(b.editor.content.value).toEqual(server.content);
    });

    it("fetches a gap that isn't filled within a second", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      a.editor.removeBlock("d1");
      await settle();
      a.editor.removeBlock("t1");
      await settle();

      const [, second] = server.queueFor(b.collaboration.sessionId).splice(0);
      second(); // revision 1 never arrives
      await settle();
      await vi.advanceTimersByTimeAsync(COLLABORATION_GAP_TIMEOUT_MS);
      await settle();

      expect(b.collaboration.revision.value).toBe(2);
      expect(b.editor.content.value).toEqual(server.content);
    });

    it("replays its own pending typing on top of another session's batch", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");

      b.editor.updateBlock("t1", { content: "Typing" } as Partial<Block>);
      await settle();
      a.editor.removeBlock("d1");
      await settle();
      server.deliver(b.collaboration.sessionId);
      await settle();

      expect(text(b.editor.content.value)).toBe("Typing");
      expect(ids(b.editor.content.value)).toEqual(["t1", "s1"]);
      await vi.advanceTimersByTimeAsync(COLLABORATION_TYPING_DEBOUNCE_MS);
      await settle();
      expect(text(server.content)).toBe("Typing");
    });

    it("converges when two sessions edit different blocks at once", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");

      a.editor.removeBlock("d1");
      b.editor.removeBlock("t1");
      await settle();
      server.deliverAll();
      await settle();

      expect(ids(server.content)).toEqual(["s1"]);
      expect(a.editor.content.value).toEqual(server.content);
      expect(b.editor.content.value).toEqual(server.content);
    });

    it("recognises its own batch when it is echoed back", async () => {
      const a = await openClient(server, "Ada");
      a.editor.removeBlock("d1");
      await settle();

      // A broadcast that reached its author, as when no socket id was sent.
      server.clients
        .get(a.collaboration.sessionId)!
        .handlers.onBatch(safeClone(server.log[0]));
      await settle();

      expect(a.collaboration.revision.value).toBe(1);
      expect(a.remote).toEqual([]);
    });

    it("reloads when the backend can't bridge the gap", async () => {
      const a = await openClient(server, "Ada");
      server.content = {
        blocks: [{ id: "r1", type: "paragraph" }],
        settings: { width: 600 },
      } as unknown as TemplateContent;
      server.revision = 9;
      vi.spyOn(a.provider, "operationsAfter").mockResolvedValue({
        revision: 9,
        resync: true,
      });

      server.clients.get(a.collaboration.sessionId)!.handlers.onResync(9);
      await settle();

      expect(ids(a.editor.content.value)).toEqual(["r1"]);
      expect(a.collaboration.revision.value).toBe(9);
    });

    it("applies another session's batch to a block this session has locked out", async () => {
      // The old guard dropped remote edits to locked blocks, including the
      // lock holder's own edits as seen by everyone else.
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      a.editor.selectBlock("t1");
      await settle();
      server.deliverAll();
      await settle();
      expect(b.collaboration.locks.value.get("t1")?.holder.name).toBe("Ada");

      a.editor.updateBlock("t1", { content: "Ada's" } as Partial<Block>);
      await vi.advanceTimersByTimeAsync(COLLABORATION_TYPING_DEBOUNCE_MS);
      await settle();
      server.deliverAll();
      await settle();

      expect(text(b.editor.content.value)).toBe("Ada's");
    });
  });

  describe("refusals", () => {
    it("takes back a local edit to a block someone else holds, without a request", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      a.editor.selectBlock("d1");
      await settle();
      server.deliverAll();
      await settle();
      const submitsBefore = server.submits;

      // A canvas drag writes the whole block list, past the editor's guards.
      b.editor.setContent({
        ...b.editor.content.value,
        blocks: b.editor.content.value.blocks.filter(
          (block) => block.id !== "d1",
        ),
      });
      await settle();

      expect(ids(b.editor.content.value)).toEqual(["t1", "s1", "d1"]);
      expect(b.notices).toEqual([
        {
          type: "editRefused",
          code: "lock_held",
          holder: expect.objectContaining({ name: "Ada" }),
        },
      ]);
      expect(server.submits).toBe(submitsBefore);
    });

    it("drops a batch the backend refuses, says so and shows the backend's state", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      a.editor.selectBlock("d1");
      await settle(); // B hasn't heard about the lock yet

      b.editor.setContent({
        ...b.editor.content.value,
        blocks: b.editor.content.value.blocks.filter(
          (block) => block.id !== "d1",
        ),
      });
      await settle();

      expect(b.notices[0]).toEqual({
        type: "editRefused",
        code: "lock_held",
        holder: expect.objectContaining({ name: "Ada" }),
      });
      expect(ids(b.editor.content.value)).toEqual(["t1", "s1", "d1"]);
    });

    it("drops a batch the backend finds too large, says so and sends nothing again", async () => {
      const a = await openClient(server, "Ada");
      server.failNextSubmit = new CollaborationConflict(
        "This batch of edits is too large.",
        {
          code: "content_too_large",
        },
      );

      a.editor.removeBlock("d1");
      await settle();
      await vi.advanceTimersByTimeAsync(30_000);

      expect(a.notices).toEqual([
        { type: "editRefused", code: "content_too_large" },
      ]);
      expect(ids(a.editor.content.value)).toEqual(["t1", "s1", "d1"]);
      expect(server.submits).toBe(1);
      expect(a.errors).toEqual([]);
    });
  });

  describe("undo and redo", () => {
    it("undoes and redoes with inverse batches", async () => {
      const a = await openClient(server, "Ada");
      a.editor.removeBlock("d1");
      await settle();

      a.collaboration.undo();
      await settle();
      expect(ids(server.content)).toEqual(["t1", "s1", "d1"]);
      expect(ids(a.editor.content.value)).toEqual(["t1", "s1", "d1"]);
      expect(a.collaboration.canRedo.value).toBe(true);

      a.collaboration.redo();
      await settle();
      expect(ids(server.content)).toEqual(["t1", "s1"]);
      expect(a.editor.state.isDirty).toBe(true);
    });

    it("skips an undo step someone else's edit overtook, and changes nothing", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      a.editor.updateBlock("t1", { content: "Ada's" } as Partial<Block>);
      a.collaboration.flush();
      await settle();
      server.deliverAll();
      await settle();
      b.editor.updateBlock("t1", { content: "Grace's" } as Partial<Block>);
      b.collaboration.flush();
      await settle();
      server.deliverAll();
      await settle();
      const revision = server.revision;

      a.collaboration.undo();
      await settle();

      expect(a.notices.at(-1)).toEqual({
        type: "undoSkipped",
        code: "precondition_failed",
      });
      expect(server.revision).toBe(revision);
      expect(text(a.editor.content.value)).toBe("Grace's");
      expect(a.collaboration.canUndo.value).toBe(false);
    });

    it("takes back the redo entry of an undo the backend refuses", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      a.editor.updateBlock("t1", { content: "Ada's" } as Partial<Block>);
      a.collaboration.flush();
      await settle();
      b.editor.selectBlock("t1"); // A hasn't heard about this lock
      await settle();

      a.collaboration.undo();
      expect(a.collaboration.canRedo.value).toBe(true);
      await settle();

      expect(a.notices.at(-1)).toEqual({
        type: "undoSkipped",
        code: "lock_held",
      });
      expect(a.collaboration.canRedo.value).toBe(false);
      expect(text(a.editor.content.value)).toBe("Ada's");
    });

    it("clears redo on a new edit and never records remote edits", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      a.editor.removeBlock("d1");
      await settle();
      a.collaboration.undo();
      await settle();
      expect(a.collaboration.canRedo.value).toBe(true);

      a.editor.removeBlock("t1");
      await settle();
      expect(a.collaboration.canRedo.value).toBe(false);

      server.deliverAll();
      await settle();
      expect(b.collaboration.canUndo.value).toBe(false);
    });
  });

  describe("AI batches", () => {
    const AI = { origin: "ai", turn: "turn-1" } as const;
    const greet: Operation[] = [
      { op: "updateBlock", blockId: "t1", set: { content: "Hello" } },
    ];

    it("applies an AI batch here at once and sends it as this session's, with its origin", async () => {
      const a = await openClient(server, "Ada");

      const result = a.collaboration.applyOperations(greet, AI);

      expect(result).toEqual({
        applied: true,
        inverse: [
          {
            op: "updateBlock",
            blockId: "t1",
            set: { content: "Hi" },
            expect: { content: "Hello" },
          },
        ],
      });
      expect(text(a.editor.content.value)).toBe("Hello");
      expect(a.editor.state.isDirty).toBe(true);

      await settle();

      expect(server.submitted.at(-1)).toMatchObject({
        origin: "ai",
        ops: greet,
      });
      expect(server.log.at(-1)?.actor).toEqual({
        type: "ai",
        id: "ada",
        name: "Ada",
        sessionId: a.collaboration.sessionId,
      });
      expect(a.collaboration.revision.value).toBe(1);
    });

    it("keeps a turn's batches in one undo step", async () => {
      const a = await openClient(server, "Ada");

      a.collaboration.applyOperations(greet, AI);
      a.collaboration.applyOperations(
        [{ op: "deleteBlock", blockId: "d1" }],
        AI,
      );
      await settle();
      expect(ids(server.content)).toEqual(["t1", "s1"]);

      a.collaboration.undo();
      await settle();

      expect(ids(server.content)).toEqual(["t1", "s1", "d1"]);
      expect(text(server.content)).toBe("Hi");
      expect(a.collaboration.canUndo.value).toBe(false);
      expect(a.collaboration.canRedo.value).toBe(true);
    });

    it("gives the next turn, or an edit in between, its own undo step", async () => {
      const a = await openClient(server, "Ada");

      a.collaboration.applyOperations(greet, AI);
      a.collaboration.applyOperations([{ op: "deleteBlock", blockId: "d1" }], {
        origin: "ai",
        turn: "turn-2",
      });
      await settle();

      a.collaboration.undo();
      await settle();

      expect(ids(server.content)).toEqual(["t1", "s1", "d1"]);
      expect(text(server.content)).toBe("Hello");
      expect(a.collaboration.canUndo.value).toBe(true);
    });

    it("refuses a batch on a block another session holds, and sends nothing", async () => {
      const a = await openClient(server, "Ada");
      const g = await openClient(server, "Grace");
      g.editor.selectBlock("p1");
      await settle();
      server.deliverAll();
      await settle();
      const sent = server.submits;

      const result = a.collaboration.applyOperations(
        [{ op: "updateBlock", blockId: "p1", set: { content: "Right" } }],
        AI,
      );

      expect(result.applied).toBe(false);
      expect(result.applied ? null : result.error.code).toBe("lock_held");
      expect(result.applied ? null : result.error.opIndex).toBe(0);
      expect(server.submits).toBe(sent);
      expect(a.collaboration.canUndo.value).toBe(false);
    });

    it("doesn't revert the holder's change, when undoing the refused update", async () => {
      const ada = await openClient(server, "Ada");
      const grace = await openClient(server, "Grace");
      ada.editor.selectBlock("t1");
      await settle(); // Grace hasn't heard about the lock

      const result = grace.collaboration.applyOperations(
        [{ op: "updateBlock", blockId: "t1", set: { content: "Bye" } }],
        AI,
      );
      expect(result.applied).toBe(true);
      await settle();

      expect(grace.notices).toEqual([
        {
          type: "editRefused",
          code: "lock_held",
          holder: expect.objectContaining({ name: "Ada" }),
        },
      ]);
      expect(text(grace.editor.content.value)).toBe("Hi");
      expect(grace.collaboration.canUndo.value).toBe(false);

      ada.editor.updateBlock("t1", { content: "Bye" } as Partial<Block>);
      ada.editor.selectBlock(null); // sends it and lets go of t1
      await settle();
      server.deliverAll();
      await settle();
      const sent = server.submits;

      grace.collaboration.undo();
      await settle();

      expect(text(server.content)).toBe("Bye");
      expect(text(grace.editor.content.value)).toBe("Bye");
      expect(server.submits).toBe(sent);
      expect(server.locks.size).toBe(0);
    });

    it("sends an edit with no origin (guard)", async () => {
      const a = await openClient(server, "Ada");

      a.editor.removeBlock("d1");
      await settle();

      expect("origin" in server.submitted.at(-1)!).toBe(false);
      expect(server.log.at(-1)?.actor.type).toBe("user");
    });
  });

  describe("steps over 100 operations", () => {
    const AI = { origin: "ai", turn: "large-turn" } as const;

    function updates(
      blockId: "t1" | "p1",
      start: number,
      count: number,
    ): Operation[] {
      return Array.from({ length: count }, (_, index) => ({
        op: "updateBlock",
        blockId,
        set: { content: `AI ${start + index + 1}` },
        expect: {
          content:
            start + index === 0
              ? blockId === "t1"
                ? "Hi"
                : "Left"
              : `AI ${start + index}`,
        },
      }));
    }

    it("undoes and redoes two 60-operation AI batches as ordered batches of 100 and 20", async () => {
      const a = await openClient(server, "Ada");
      const before = safeClone(a.editor.content.value);

      expect(
        a.collaboration.applyOperations(updates("t1", 0, 60), AI).applied,
      ).toBe(true);
      await a.collaboration.settle();
      expect(
        a.collaboration.applyOperations(updates("t1", 60, 60), AI).applied,
      ).toBe(true);
      await a.collaboration.settle();
      const after = safeClone(a.editor.content.value);
      expect(text(server.content)).toBe("AI 120");
      expect(server.log.map((batch) => batch.ops.length)).toEqual([60, 60]);

      a.collaboration.undo();
      await a.collaboration.settle();

      expect(
        server.submitted.slice(2).map((batch) => batch.ops.length),
      ).toEqual([100, 20]);
      expect(server.log.slice(2).map((batch) => batch.ops.length)).toEqual([
        100, 20,
      ]);
      expect(server.content).toEqual(before);
      expect(a.editor.content.value).toEqual(before);
      expect(a.collaboration.canUndo.value).toBe(false);
      expect(a.collaboration.canRedo.value).toBe(true);

      a.collaboration.redo();
      await a.collaboration.settle();

      expect(
        server.submitted.slice(4).map((batch) => batch.ops.length),
      ).toEqual([100, 20]);
      expect(server.log.slice(4).map((batch) => batch.ops.length)).toEqual([
        100, 20,
      ]);
      expect(server.submitted.map((batch) => batch.baseRevision)).toEqual([
        0, 1, 2, 3, 4, 5,
      ]);
      expect(new Set(server.submitted.map((batch) => batch.batchId)).size).toBe(
        6,
      );
      expect(server.content).toEqual(after);
      expect(a.editor.content.value).toEqual(after);
      expect(text(server.content)).toBe("AI 120");
      expect(a.collaboration.canUndo.value).toBe(true);
      expect(a.collaboration.canRedo.value).toBe(false);
      expect(a.notices).toEqual([]);
    });

    it("sends a local edit adding 150 blocks as batches of 100 and 50", async () => {
      const a = await openClient(server, "Ada");
      const added: Block[] = Array.from({ length: 150 }, (_, index) => ({
        id: `added-${index}`,
        type: "divider",
      })) as Block[];
      const expected = {
        ...safeClone(BASE),
        blocks: [...safeClone(BASE.blocks), ...added],
      };

      a.editor.setContent(expected);
      await a.collaboration.settle();

      expect(server.submitted.map((batch) => batch.ops.length)).toEqual([
        100, 50,
      ]);
      expect(server.log.map((batch) => batch.ops.length)).toEqual([100, 50]);
      expect(server.submitted.map((batch) => batch.baseRevision)).toEqual([
        0, 1,
      ]);
      expect(server.submitted.every((batch) => !("origin" in batch))).toBe(
        true,
      );
      expect(server.content).toEqual(expected);
      expect(a.editor.content.value).toEqual(expected);
      expect(a.collaboration.canUndo.value).toBe(true);
      expect(a.notices).toEqual([]);
    });

    it("keeps the first chunk and drops the rest of a step when its second chunk is refused", async () => {
      const a = await openClient(server, "Ada");
      const g = await openClient(server, "Grace");
      g.editor.selectBlock("p1");
      await settle(); // Ada hasn't heard about the lock

      const result = a.collaboration.applyOperations(
        [
          ...updates("t1", 0, 100),
          ...updates("p1", 0, 100),
          { op: "deleteBlock", blockId: "d1" },
        ],
        AI,
      );
      expect(result.applied).toBe(true);
      await a.collaboration.settle();
      await settle();

      expect(server.submitted.map((batch) => batch.ops.length)).toEqual([
        100, 100,
      ]);
      expect(server.submitted.map((batch) => batch.origin)).toEqual([
        "ai",
        "ai",
      ]);
      expect(server.log.map((batch) => batch.ops.length)).toEqual([100]);
      expect(text(server.content)).toBe("AI 100");
      expect(ids(server.content)).toEqual(["t1", "s1", "d1"]);
      expect(a.editor.content.value).toEqual(server.content);
      expect(a.collaboration.revision.value).toBe(1);
      expect(a.collaboration.canUndo.value).toBe(false);
      expect(a.collaboration.canRedo.value).toBe(false);
      expect(a.notices).toEqual([
        {
          type: "editRefused",
          code: "lock_held",
          holder: expect.objectContaining({ name: "Grace" }),
        },
      ]);

      a.collaboration.undo();
      await vi.advanceTimersByTimeAsync(30_000);
      await a.collaboration.settle();

      expect(server.submits).toBe(2);
      expect(a.editor.content.value).toEqual(server.content);
      expect(a.notices).toHaveLength(1);
    });

    it("retries a chunk with its own batch id and catches up every accepted chunk", async () => {
      const a = await openClient(server, "Ada");
      const g = await openClient(server, "Grace");
      const submit = a.provider.submit.bind(a.provider);
      let calls = 0;
      vi.spyOn(a.provider, "submit").mockImplementation((...args) => {
        if (++calls === 2)
          server.failNextSubmit = new TypeError("Failed to fetch");
        return submit(...args);
      });

      expect(
        a.collaboration.applyOperations(updates("t1", 0, 201), AI).applied,
      ).toBe(true);
      await settle();
      expect(server.revision).toBe(1);
      expect(server.submitted.map((batch) => batch.ops.length)).toEqual([
        100, 100,
      ]);

      await vi.advanceTimersByTimeAsync(1000);
      await a.collaboration.settle();

      expect(server.submitted.map((batch) => batch.ops.length)).toEqual([
        100, 100, 100, 1,
      ]);
      expect(server.submitted[2].batchId).toBe(server.submitted[1].batchId);
      expect(new Set(server.submitted.map((batch) => batch.batchId)).size).toBe(
        3,
      );
      expect(server.submitted.map((batch) => batch.baseRevision)).toEqual([
        0, 1, 1, 2,
      ]);
      expect(server.log.map((batch) => batch.revision)).toEqual([1, 2, 3]);
      expect(text(server.content)).toBe("AI 201");
      expect(a.editor.content.value).toEqual(server.content);

      await g.collaboration.catchUp(); // No live broadcasts were delivered.

      expect(g.collaboration.revision.value).toBe(3);
      expect(g.editor.content.value).toEqual(server.content);
      expect(g.remote.map((change) => change.ops.length)).toEqual([
        100, 100, 1,
      ]);
      expect(a.notices).toEqual([]);
      expect(g.notices).toEqual([]);
    });

    it.each(["accepted", "accepted through catch-up", "refused"] as const)(
      "keeps a dropped group's in-flight chunk pending until it is %s",
      async (outcome) => {
        const a = await openClient(server, "Ada");
        let release!: () => void;
        const gate = new Promise<void>((resolve) => (release = resolve));
        let releaseAnswer!: () => void;
        const answerGate = new Promise<void>(
          (resolve) => (releaseAnswer = resolve),
        );
        const submit = a.provider.submit.bind(a.provider);
        const sent = vi
          .spyOn(a.provider, "submit")
          .mockImplementation(async (...args) => {
            await gate;
            const result = await submit(...args);
            if (outcome === "accepted through catch-up") await answerGate;
            return result;
          });

        expect(
          a.collaboration.applyOperations(
            [
              ...updates("t1", 0, 100),
              ...updates("p1", 0, 100),
              { op: "updateSettings", set: { width: 640 } },
            ],
            AI,
          ).applied,
        ).toBe(true);
        let settledBeforeDrop = false;
        const waitingBeforeDrop = a.collaboration.settle().then(() => {
          settledBeforeDrop = true;
        });

        server.pushAs({ type: "api", id: null, name: "API", sessionId: null }, [
          { op: "deleteBlock", blockId: "p1" },
        ]);
        server.deliverAll();
        await settle();

        let settledAfterDrop = false;
        const waitingAfterDrop = a.collaboration.settle().then(() => {
          settledAfterDrop = true;
        });
        await settle();

        expect([settledBeforeDrop, settledAfterDrop]).toEqual([false, false]);
        expect(sent.mock.calls.map(([, batch]) => batch.ops.length)).toEqual([
          100,
        ]);
        expect(a.notices).toEqual([
          { type: "editRefused", code: "block_missing" },
        ]);
        expect(a.collaboration.canUndo.value).toBe(false);

        if (outcome === "refused") {
          server.failNextSubmit = new CollaborationConflict(
            "This batch was refused.",
            {
              code: "invalid_operation",
            },
          );
        }
        release();
        await settle();
        if (outcome === "accepted through catch-up") {
          // The backend applied it, but its submit response is still gated.
          expect(server.revision).toBe(2);
          expect([settledBeforeDrop, settledAfterDrop]).toEqual([false, false]);
          await a.collaboration.catchUp();
          expect(a.remote.map((change) => change.ops)).toEqual([
            [{ op: "deleteBlock", blockId: "p1" }],
          ]);
        }
        releaseAnswer();
        await Promise.all([waitingBeforeDrop, waitingAfterDrop]);
        await a.collaboration.settle();

        expect([settledBeforeDrop, settledAfterDrop]).toEqual([true, true]);
        expect(sent.mock.calls.map(([, batch]) => batch.ops.length)).toEqual([
          100,
        ]);
        expect(server.submitted.map((batch) => batch.ops.length)).toEqual([
          100,
        ]);
        expect(server.content.settings.width).toBe(600);
        expect(text(server.content)).toBe(
          outcome === "refused" ? "Hi" : "AI 100",
        );
        expect(a.editor.content.value).toEqual(server.content);
        expect(a.collaboration.hasConfirmedBlock("p1")).toBe(false);
        expect(a.collaboration.revision.value).toBe(
          outcome === "refused" ? 1 : 2,
        );
        expect(a.collaboration.canUndo.value).toBe(false);
        expect(a.collaboration.canRedo.value).toBe(false);
        expect(a.notices).toEqual([
          { type: "editRefused", code: "block_missing" },
        ]);
        expect(a.errors).toEqual([]);
      },
    );

    it("drops a queued step's whole group when a remote batch invalidates a later chunk (guard)", async () => {
      const a = await openClient(server, "Ada");
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const submit = a.provider.submit.bind(a.provider);
      vi.spyOn(a.provider, "submit").mockImplementation(async (...args) => {
        await gate;
        return submit(...args);
      });
      a.editor.removeBlock("d1"); // The earlier edit is in flight.
      await settle();

      expect(
        a.collaboration.applyOperations(
          [
            ...updates("t1", 0, 100),
            ...updates("p1", 0, 100),
            { op: "updateSettings", set: { width: 640 } },
          ],
          AI,
        ).applied,
      ).toBe(true);
      server.pushAs({ type: "api", id: null, name: "API", sessionId: null }, [
        { op: "deleteBlock", blockId: "p1" },
      ]);
      server.deliverAll();
      await settle();

      expect(text(a.editor.content.value)).toBe("Hi");
      expect(a.editor.content.value.settings.width).toBe(600);
      expect(a.notices).toEqual([
        { type: "editRefused", code: "block_missing" },
      ]);

      release();
      await a.collaboration.settle();

      expect(server.submitted.map((batch) => batch.ops.length)).toEqual([1]);
      expect(a.editor.content.value).toEqual(server.content);
      expect(a.collaboration.canUndo.value).toBe(true); // The earlier edit only.
      a.collaboration.undo();
      await a.collaboration.settle();
      expect(ids(server.content)).toEqual(["t1", "s1", "d1"]);
      expect(a.collaboration.canUndo.value).toBe(false);
      expect(a.notices).toHaveLength(1);
    });
  });

  describe("locks", () => {
    it("takes a lock on select, renews it, and releases it on deselect", async () => {
      const a = await openClient(server, "Ada");
      const renew = vi.spyOn(a.provider, "renewLock");

      a.editor.selectBlock("p1");
      await settle();
      expect(server.locks.get("p1")?.holder.name).toBe("Ada");

      await vi.advanceTimersByTimeAsync(COLLABORATION_LOCK_RENEW_MS);
      await settle();
      expect(renew).toHaveBeenCalledWith(server.templateId, "p1");

      a.editor.selectBlock(null);
      await settle();
      expect(server.locks.has("p1")).toBe(false);
    });

    it("moves its lock when the selection moves", async () => {
      const a = await openClient(server, "Ada");

      a.editor.selectBlock("p1");
      await settle();
      a.editor.selectBlock("b1");
      await settle();

      expect([...server.locks.keys()]).toEqual(["b1"]);
    });

    it("refuses a selection someone else holds, naming them", async () => {
      const a = await openClient(server, "Ada");
      const c = await openClient(server, "Linus");
      a.editor.selectBlock("p1");
      await settle(); // Linus hasn't heard about the lock

      c.editor.selectBlock("p1");
      await settle();

      expect(c.editor.state.selectedBlockId).toBe(null);
      expect(c.notices).toEqual([
        {
          type: "selectionRefused",
          blockId: "p1",
          holder: expect.objectContaining({ name: "Ada" }),
        },
      ]);
      expect(c.collaboration.locks.value.get("p1")?.holder.name).toBe("Ada");
    });

    it("tracks others' locks, and blocks selecting them", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      a.editor.selectBlock("p1");
      await settle();
      server.deliverAll();
      await settle();

      b.editor.selectBlock("p1");
      expect(b.editor.state.selectedBlockId).toBe(null);

      a.editor.selectBlock(null);
      await settle();
      server.deliverAll();
      await settle();
      expect(b.collaboration.locks.value.has("p1")).toBe(false);
    });

    it("drops the locks of a session that leaves", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      server.deliverAll();
      await settle();
      a.editor.selectBlock("t1");
      await settle();
      server.deliverAll();
      await settle();
      expect(b.collaboration.locks.value.has("t1")).toBe(true);

      a.scope.stop();
      await settle();
      server.deliverAll();
      await settle();

      expect(b.collaboration.locks.value.has("t1")).toBe(false);
      expect(
        b.collaboration.members.value.map((member) => member.name),
      ).toEqual(["Grace"]);
    });

    it("takes no locks when the backend has none", async () => {
      const provider = server.provider("Ada");
      delete provider.acquireLock;
      delete provider.renewLock;
      delete provider.releaseLock;
      const scope = effectScope();
      const editor = scope.run(() => {
        const collaboration = useCollaboration({
          provider,
          loadTemplate: async () => server.template(),
        });
        const editor = useEditor({
          content: safeClone(BASE),
          templates: server.templatesProvider(),
          lockedBlocks: collaboration.locks,
        });
        collaboration.attach(editor);
        return editor;
      })!;
      await editor.load(server.templateId);
      await settle();

      editor.selectBlock("p1");
      await settle();

      expect(editor.state.selectedBlockId).toBe("p1");
      expect(server.locks.size).toBe(0);
    });
  });

  describe("sessions", () => {
    it("loading another template sends nothing to the first", async () => {
      const second = new FakeCollaborationServer(
        {
          blocks: [{ id: "x1", type: "paragraph" }],
          settings: { width: 600 },
        } as unknown as TemplateContent,
        "tpl-2",
      );
      const pick = (templateId: string) =>
        templateId === "tpl-2" ? second : server;
      const providers = {
        [server.templateId]: server.provider("Ada"),
        "tpl-2": second.provider("Ada"),
      };
      const scope = effectScope();
      const editor = scope.run(() => {
        const collaboration = useCollaboration({
          provider: {
            join: (id, session, handlers) =>
              providers[id].join(id, session, handlers),
            submit: (id, batch) => providers[id].submit(id, batch),
            operationsAfter: (id, after) =>
              providers[id].operationsAfter(id, after),
          },
          loadTemplate: async (id) => pick(id).template(),
        });
        const editor = useEditor({
          content: safeClone(BASE),
          templates: {
            load: async (id) => pick(id).template(),
            create: false,
            save: false,
          },
          lockedBlocks: collaboration.locks,
        });
        collaboration.attach(editor);
        return editor;
      })!;
      await editor.load(server.templateId);
      await settle();

      editor.updateBlock("t1", {
        content: "Before the switch",
      } as Partial<Block>);
      await settle();
      await editor.load("tpl-2");
      await settle();
      await vi.advanceTimersByTimeAsync(COLLABORATION_TYPING_DEBOUNCE_MS);
      await settle();

      expect(text(server.content)).toBe("Before the switch");
      expect(ids(server.content)).toEqual(["t1", "s1", "d1"]);
      expect(second.submits).toBe(0);
      expect(ids(editor.content.value)).toEqual(["x1"]);
    });

    it("suspended, holds remote batches off the canvas; resume shows them", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");

      b.collaboration.suspend();
      b.editor.setContent(
        {
          blocks: [{ id: "v1", type: "paragraph" }],
          settings: { width: 600 },
        } as unknown as TemplateContent,
        false,
      );
      await settle();
      a.editor.removeBlock("d1");
      await settle();
      server.deliverAll();
      await settle();
      expect(ids(b.editor.content.value)).toEqual(["v1"]);

      b.collaboration.resume();
      await settle();

      expect(ids(b.editor.content.value)).toEqual(["t1", "s1"]);
      expect(server.revision).toBe(1);
    });

    it("knows which blocks the backend has confirmed", async () => {
      const a = await openClient(server, "Ada");
      server.failNextSubmit = new TypeError("offline");

      a.editor.addBlock({ id: "n1", type: "spacer" } as unknown as Block);
      await settle();
      expect(a.collaboration.hasConfirmedBlock("p1")).toBe(true);
      expect(a.collaboration.hasConfirmedBlock("n1")).toBe(false);

      await vi.advanceTimersByTimeAsync(1000);
      await settle();
      expect(a.collaboration.hasConfirmedBlock("n1")).toBe(true);
    });

    it("re-joins after a reconnect to refresh locks and catch up", async () => {
      const a = await openClient(server, "Ada");
      const join = vi.spyOn(a.provider, "join");
      const handlers = server.clients.get(a.collaboration.sessionId)!.handlers;

      handlers.onConnectionChange("reconnecting");
      expect(a.collaboration.connection.value).toBe("reconnecting");
      handlers.onConnectionChange("connected");
      await settle();

      expect(join).toHaveBeenCalledTimes(1);
      expect(a.collaboration.connection.value).toBe("connected");
    });

    it("deselects when the block to lock is gone", async () => {
      const a = await openClient(server, "Ada");
      vi.spyOn(a.provider, "acquireLock").mockRejectedValueOnce(
        new CollaborationConflict("nope", { code: "block_missing" }),
      );

      a.editor.selectBlock("p1");
      await settle();

      expect(a.editor.state.selectedBlockId).toBe(null);
    });
  });

  describe("batches from elsewhere", () => {
    const AGENT: CollaborationActor = {
      type: "mcp",
      id: "ada",
      name: "Ada",
      sessionId: null,
      client: "Claude",
    };
    const CHIP = '<span data-merge-tag="{{first_name}}">First name</span>';

    /** Stands in for the editor's normalizer: a token in text becomes a tag. */
    function chips(html: string): string {
      return html.replace(/(?<!")\{\{first_name\}\}/g, CHIP);
    }

    function chipNormalizer() {
      return vi.fn((ops: readonly Operation[]): Operation[] =>
        ops.map((op) =>
          op.op === "updateBlock" && typeof op.set?.content === "string"
            ? { ...op, set: { ...op.set, content: chips(op.set.content) } }
            : op,
        ),
      );
    }

    /** The server's template with t1's tokens as tags: what the editor's normalized load gives. */
    function normalizedTemplate(): Template {
      const template = server.template();
      return {
        ...template,
        content: {
          ...template.content,
          blocks: template.content.blocks.map((block) =>
            block.id === "t1"
              ? ({
                  ...block,
                  content: chips((block as { content: string }).content),
                } as Block)
              : block,
          ),
        },
      };
    }

    it("applies another session's batch as the normalizer rewrites it, sends nothing back, and reports it as sent", async () => {
      const normalize = chipNormalizer();
      const a = await openClient(server, "Ada", {
        normalizeRemoteOperations: normalize,
      });
      const ops: Operation[] = [
        {
          op: "updateBlock",
          blockId: "t1",
          set: { content: "Hi {{first_name}}" },
        },
      ];

      server.pushAs(AGENT, ops);
      server.deliverAll();
      await settle();
      await vi.advanceTimersByTimeAsync(COLLABORATION_TYPING_MAX_WAIT_MS);
      await settle();

      expect(text(a.editor.content.value)).toBe(`Hi ${CHIP}`);
      expect(server.submits).toBe(0);
      expect(a.collaboration.revision.value).toBe(1);
      expect(normalize).toHaveBeenCalledWith(
        ops,
        expect.objectContaining({ settings: { width: 600 } }),
      );
      expect(a.remote).toEqual([{ actor: AGENT, ops }]);
    });

    it("rewrites the batches a catch-up brings, too", async () => {
      const a = await openClient(server, "Ada", {
        normalizeRemoteOperations: chipNormalizer(),
      });
      server.deliverAll();
      server.pushAs(AGENT, [
        {
          op: "updateBlock",
          blockId: "t1",
          set: { content: "{{first_name}}" },
        },
      ]);
      server.pushAs(AGENT, [{ op: "deleteBlock", blockId: "d1" }]);
      // Revision 1 never arrives live, so operationsAfter fills the gap.
      server.queueFor(a.collaboration.sessionId).shift();
      server.deliverAll();
      await settle();
      await vi.advanceTimersByTimeAsync(COLLABORATION_GAP_TIMEOUT_MS);
      await settle();

      expect(text(a.editor.content.value)).toBe(CHIP);
      expect(ids(a.editor.content.value)).toEqual(["t1", "s1"]);
      expect(a.collaboration.revision.value).toBe(2);
    });

    it("never passes this session's own batches through it", async () => {
      // guard: own batches came from this canvas and already hold tags
      const normalize = chipNormalizer();
      const a = await openClient(server, "Ada", {
        normalizeRemoteOperations: normalize,
      });

      a.editor.removeBlock("d1");
      await settle();

      expect(server.submits).toBe(1);
      expect(a.collaboration.revision.value).toBe(1);
      expect(normalize).not.toHaveBeenCalled();
    });

    it("applies a batch whose expect names the backend's raw content to this copy's normalized one", async () => {
      server.content = {
        ...safeClone(BASE),
        blocks: [
          { id: "t1", type: "title", content: "Hi {{first_name}}" },
          ...safeClone(BASE).blocks.slice(1),
        ],
      } as TemplateContent;
      const loadTemplate = vi.fn(async () => normalizedTemplate());
      const a = await openClient(server, "Ada", {
        normalizeRemoteOperations: chipNormalizer(),
        loadTemplate,
        templates: {
          load: async () => normalizedTemplate(),
          create: false,
          save: async () => normalizedTemplate(),
        },
      });
      expect(text(a.editor.content.value)).toBe(`Hi ${CHIP}`);

      server.pushAs(AGENT, [
        {
          op: "updateBlock",
          blockId: "t1",
          set: { content: "Bye {{first_name}}" },
          expect: { content: "Hi {{first_name}}" },
        },
      ]);
      server.deliverAll();
      await settle();

      expect(text(a.editor.content.value)).toBe(`Bye ${CHIP}`);
      expect(loadTemplate).not.toHaveBeenCalled();
      expect(a.errors).toEqual([]);
      expect(a.remote).toHaveLength(1);
    });

    it("reports a normalizer that throws and applies the batch as it came", async () => {
      const a = await openClient(server, "Ada", {
        normalizeRemoteOperations: () => {
          throw new Error("The parser broke.");
        },
      });

      server.pushAs(AGENT, [
        {
          op: "updateBlock",
          blockId: "t1",
          set: { content: "Hi {{first_name}}" },
        },
      ]);
      server.deliverAll();
      await settle();

      expect(text(a.editor.content.value)).toBe("Hi {{first_name}}");
      expect(a.errors.map((error) => error.message)).toEqual([
        "The parser broke.",
      ]);
    });

    it("still re-syncs when a remote batch names a block this copy lacks", async () => {
      // guard (X6): only `expect` is skipped; any other refusal means this
      // copy drifted from the backend's, and it starts over from it.
      const loadTemplate = vi.fn(async () => server.template());
      const a = await openClient(server, "Ada", {
        normalizeRemoteOperations: chipNormalizer(),
        loadTemplate,
      });
      // A change this editor never heard about.
      server.content = {
        ...server.content,
        blocks: [
          ...server.content.blocks,
          { id: "x9", type: "paragraph", content: "New" },
        ],
      } as TemplateContent;

      server.pushAs(AGENT, [
        {
          op: "updateBlock",
          blockId: "x9",
          set: { content: "Changed" },
          expect: { content: "New" },
        },
      ]);
      server.deliverAll();
      await settle();

      expect(loadTemplate).toHaveBeenCalledTimes(1);
      expect(text(a.editor.content.value, "x9")).toBe("Changed");
      expect(a.collaboration.revision.value).toBe(1);
      // A reload replaces the content: the batch never reaches onRemoteChange.
      expect(a.remote).toEqual([]);
      expect(a.errors).toEqual([]);
    });
  });

  describe("re-syncs from elsewhere", () => {
    const AGENT: CollaborationActor = {
      type: "mcp",
      id: "ada",
      name: "Ada",
      sessionId: null,
      client: "Claude",
    };
    const REPLACED = {
      blocks: [{ id: "n1", type: "divider" }],
      settings: { width: 600 },
    } as unknown as TemplateContent;

    it("says who re-synced a revision it doesn't have, then catches up", async () => {
      const onRemoteResync = vi.fn();
      const a = await openClient(server, "Ada", { onRemoteResync });
      const catchUp = vi.spyOn(a.provider, "operationsAfter");

      server.resyncAs(AGENT, [{ op: "setContent", content: REPLACED }]);
      server.deliverAll();
      await settle();

      expect(onRemoteResync).toHaveBeenCalledWith({
        revision: 1,
        actor: AGENT,
      });
      expect(onRemoteResync.mock.invocationCallOrder[0]).toBeLessThan(
        catchUp.mock.invocationCallOrder[0],
      );
      expect(ids(a.editor.content.value)).toEqual(["n1"]);
      expect(a.remote).toEqual([
        { actor: AGENT, ops: [{ op: "setContent", content: REPLACED }] },
      ]);
    });

    it("says nothing for a re-sync that names no actor, or a revision it already has", async () => {
      const onRemoteResync = vi.fn();
      const a = await openClient(server, "Ada", { onRemoteResync });
      const handlers = server.clients.get(a.collaboration.sessionId)!.handlers;
      const catchUp = vi.spyOn(a.provider, "operationsAfter");

      handlers.onResync(0, AGENT);
      handlers.onResync(1);
      await settle();

      expect(onRemoteResync).not.toHaveBeenCalled();
      // Only the actorless re-sync names a revision this editor lacks.
      expect(catchUp).toHaveBeenCalledTimes(1);
    });

    it("reports a callback that throws and still catches up", async () => {
      const a = await openClient(server, "Ada", {
        onRemoteResync: () => {
          throw new Error("The notice broke.");
        },
      });

      server.resyncAs(AGENT, [{ op: "setContent", content: REPLACED }]);
      server.deliverAll();
      await settle();

      expect(a.errors.map((error) => error.message)).toEqual([
        "The notice broke.",
      ]);
      expect(ids(a.editor.content.value)).toEqual(["n1"]);
    });
  });
});
