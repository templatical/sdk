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
