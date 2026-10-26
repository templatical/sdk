import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "@vue/reactivity";
import { safeClone } from "@templatical/types";
import { useEditor } from "../src/editor";
import { useCollaboration } from "../src/collaboration";
import { BASE, ids, openClient, settle } from "./helpers/collaboration-harness";
import { FakeCollaborationServer } from "./helpers/fake-collaboration-server";

describe("collaboration explicit moves", () => {
  const scopes: ReturnType<typeof effectScope>[] = [];
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop());
    vi.useRealTimers();
  });

  async function open({ load = true, snapshotOnly = false } = {}) {
    const server = new FakeCollaborationServer(BASE);
    const scope = effectScope();
    scopes.push(scope);
    const result = scope.run(() => {
      const errors: Error[] = [];
      const collaboration = useCollaboration({
        provider: server.provider("Ada"),
        loadTemplate: async () => server.template(),
        onError: (error) => errors.push(error),
      });
      const editor = useEditor({
        content: safeClone(BASE),
        templates: server.templatesProvider(),
      });
      const originalMove = editor.moveBlock;
      collaboration.attach(
        snapshotOnly
          ? {
              state: editor.state,
              content: editor.content,
              selectBlock: editor.selectBlock,
              setContent: editor.setContent,
              markDirty: editor.markDirty,
            }
          : editor,
      );
      return { editor, collaboration, originalMove, errors };
    })!;
    if (load) {
      await result.editor.load(server.templateId);
      await settle();
    }
    return { ...result, server };
  }

  it("flushes preceding typing before the explicit move and undoes them separately", async () => {
    const { editor, collaboration, server, errors } = await open();
    editor.updateBlock("t1", { content: "Typed before dragging" });
    editor.moveBlock("d1", 0);
    await collaboration.settle();

    expect(server.submitted.map((batch) => batch.ops)).toEqual([
      [
        {
          op: "updateBlock",
          blockId: "t1",
          set: { content: "Typed before dragging" },
        },
      ],
      [{ op: "moveBlock", blockId: "d1", parent: null, after: null }],
    ]);
    expect(ids(server.content)).toEqual(["d1", "t1", "s1"]);
    expect(editor.content.value).toEqual(server.content);
    collaboration.undo();
    await collaboration.settle();
    expect(ids(server.content)).toEqual(ids(BASE));
    expect(server.content.blocks[0]).toMatchObject({
      content: "Typed before dragging",
    });
    collaboration.undo();
    await collaboration.settle();
    expect(server.content).toEqual(BASE);
    expect(errors).toEqual([]);
  });

  it("captures section destinations and the exact preceding sibling", async () => {
    const { editor, collaboration, server, errors } = await open();
    editor.moveBlock("d1", 1, "s1", 0);
    await collaboration.settle();
    expect(server.submitted[0].ops).toEqual([
      {
        op: "moveBlock",
        blockId: "d1",
        parent: { sectionId: "s1", column: 0 },
        after: "p1",
      },
    ]);
    editor.moveBlock("t1", 0, "s1", 1);
    await collaboration.settle();
    expect(server.submitted[1].ops).toEqual([
      {
        op: "moveBlock",
        blockId: "t1",
        parent: { sectionId: "s1", column: 1 },
        after: null,
      },
    ]);
    expect(server.content.blocks[0]).toMatchObject({
      id: "s1",
      children: [
        [{ id: "p1" }, { id: "d1" }],
        [{ id: "t1" }, { id: "b1" }],
      ],
    });
    expect(editor.content.value).toEqual(server.content);
    expect(errors).toEqual([]);
  });

  it("does not submit unchanged or missing-block moves", async () => {
    const { editor, collaboration, server } = await open();
    editor.moveBlock("t1", 0);
    editor.moveBlock("missing", 0);
    await collaboration.settle();
    expect(server.submitted).toEqual([]);
    expect(editor.content.value).toEqual(BASE);
    expect(collaboration.canUndo.value).toBe(false);
  });

  it("moves the dragged section rather than its locked neighbour in an adjacent swap", async () => {
    const { editor, collaboration, server, errors } = await open();
    const peer = await openClient(server, "Grace");
    scopes.push(peer.scope);
    peer.editor.selectBlock("d1");
    await settle();
    server.deliverAll();
    await settle();
    expect(collaboration.locksOf("d1")).toHaveLength(1);
    editor.moveBlock("s1", 2);
    await collaboration.settle();
    expect(server.submitted.map((batch) => batch.ops)).toEqual([
      [{ op: "moveBlock", blockId: "s1", parent: null, after: "d1" }],
    ]);
    expect(ids(server.content)).toEqual(["t1", "d1", "s1"]);
    expect(editor.content.value).toEqual(server.content);
    expect(errors).toEqual([]);
  });

  it("leaves pre-load moves local and captures later moves after joining", async () => {
    const { editor, collaboration, server } = await open({ load: false });
    editor.moveBlock("d1", 0);
    await settle();
    expect(ids(editor.content.value)).toEqual(["d1", "t1", "s1"]);
    expect(server.submitted).toEqual([]);
    await editor.load(server.templateId);
    await settle();
    editor.moveBlock("d1", 0);
    await collaboration.settle();
    expect(server.submitted).toHaveLength(1);
    expect(server.submitted[0].ops).toEqual([
      { op: "moveBlock", blockId: "d1", parent: null, after: null },
    ]);
  });

  it("does not capture preview moves while suspended and restores the confirmed view on resume", async () => {
    const { editor, collaboration, server } = await open();
    collaboration.suspend();
    editor.moveBlock("d1", 0);
    await settle();
    expect(ids(editor.content.value)).toEqual(["d1", "t1", "s1"]);
    expect(server.submitted).toEqual([]);
    collaboration.resume();
    expect(editor.content.value).toEqual(BASE);
    expect(collaboration.canUndo.value).toBe(false);
  });

  it.each([false, true])(
    "preserves snapshot capture when destination lookup is unavailable (%s)",
    async (snapshotOnly) => {
      const { editor, collaboration, server, errors } = await open({
        snapshotOnly,
      });
      if (!snapshotOnly)
        vi.spyOn(editor, "findBlockLocation").mockReturnValue(null);
      editor.moveBlock("d1", 0);
      await settle();
      await collaboration.settle();
      expect(ids(server.content)).toEqual(["d1", "t1", "s1"]);
      expect(editor.content.value).toEqual(server.content);
      expect(server.submitted).toHaveLength(1);
      collaboration.undo();
      await collaboration.settle();
      expect(server.content).toEqual(BASE);
      expect(errors).toEqual([]);
    },
  );

  it.each([false, true])(
    "teardown restores the original move unless a later wrapper owns it (%s)",
    async (replace) => {
      const { editor, collaboration, originalMove, server } = await open();
      expect(editor.moveBlock).not.toBe(originalMove);
      const replacement = (...args: Parameters<typeof originalMove>) =>
        originalMove(...args);
      if (replace) editor.moveBlock = replacement;
      collaboration.destroy();
      expect(editor.moveBlock).toBe(replace ? replacement : originalMove);
      editor.moveBlock("d1", 0);
      await settle();
      expect(ids(editor.content.value)).toEqual(["d1", "t1", "s1"]);
      expect(server.submitted).toEqual([]);
    },
  );
});
