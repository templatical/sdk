import { describe, expect, it, vi } from "vitest";
import { ref } from "@vue/reactivity";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  safeClone,
  type Block,
  type TemplateContent,
} from "@templatical/types";
import { useEditor } from "../src/editor";
import { useHistory } from "../src/history";
import { useHistoryInterceptor } from "../src/history-interceptor";
import type { UseEditorReturn } from "../src/editor";
import type { UseHistoryReturn } from "../src/history";

function createMockEditor(): UseEditorReturn {
  return {
    addBlock: vi.fn(),
    removeBlock: vi.fn(),
    moveBlock: vi.fn(),
    updateBlock: vi.fn(),
    updateSettings: vi.fn(),
    isBlockLocked: vi.fn(() => false),
  } as unknown as UseEditorReturn;
}

function createMockHistory(): UseHistoryReturn {
  return {
    record: vi.fn(),
    recordDebounced: vi.fn(),
  } as unknown as UseHistoryReturn;
}

describe("useHistoryInterceptor", () => {
  it("calls history.record() before editor.addBlock()", () => {
    const editor = createMockEditor();
    const history = createMockHistory();
    const originalAddBlock = editor.addBlock;
    useHistoryInterceptor(editor, history);

    const callOrder: string[] = [];
    vi.mocked(history.record).mockImplementation(() => {
      callOrder.push("record");
    });
    (originalAddBlock as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callOrder.push("addBlock");
    });

    const block = { id: "b1", type: "title" } as Parameters<
      typeof editor.addBlock
    >[0];
    editor.addBlock(block, "section-1", 0, 2);

    expect(history.record).toHaveBeenCalledOnce();
    expect(originalAddBlock).toHaveBeenCalledWith(block, "section-1", 0, 2);
    expect(callOrder).toEqual(["record", "addBlock"]);
  });

  it("calls history.record() before editor.removeBlock()", () => {
    const editor = createMockEditor();
    const history = createMockHistory();
    useHistoryInterceptor(editor, history);

    editor.removeBlock("block-1");

    expect(history.record).toHaveBeenCalledOnce();
  });

  it("calls history.record() before editor.moveBlock()", () => {
    const editor = createMockEditor();
    const history = createMockHistory();
    const originalMoveBlock = editor.moveBlock;
    useHistoryInterceptor(editor, history);

    editor.moveBlock("block-1", 3, "section-2", 1);

    expect(history.record).toHaveBeenCalledOnce();
    expect(originalMoveBlock).toHaveBeenCalledWith(
      "block-1",
      3,
      "section-2",
      1,
    );
  });

  it("calls history.recordDebounced() for editor.updateBlock()", () => {
    const editor = createMockEditor();
    const history = createMockHistory();
    const originalUpdateBlock = editor.updateBlock;
    useHistoryInterceptor(editor, history);

    editor.updateBlock("block-1", { content: "new" } as Parameters<
      typeof editor.updateBlock
    >[1]);

    expect(history.recordDebounced).toHaveBeenCalledWith("block-1");
    expect(history.record).not.toHaveBeenCalled();
    expect(originalUpdateBlock).toHaveBeenCalledWith("block-1", {
      content: "new",
    });
  });

  it("calls history.record() before editor.updateSettings()", () => {
    const editor = createMockEditor();
    const history = createMockHistory();
    const originalUpdateSettings = editor.updateSettings;
    useHistoryInterceptor(editor, history);

    const updates = { backgroundColor: "#fff" } as Parameters<
      typeof editor.updateSettings
    >[0];
    editor.updateSettings(updates);

    expect(history.record).toHaveBeenCalledOnce();
    expect(originalUpdateSettings).toHaveBeenCalledWith(updates);
  });

  describe("does not pollute history when the underlying op is a no-op", () => {
    it("skips recording when updateBlock targets a locked block", () => {
      const content = createDefaultTemplateContent();
      content.blocks = [createParagraphBlock({ content: "<p>locked</p>" })];
      const lockedId = content.blocks[0].id;
      const lockedBlocks = ref(new Map([[lockedId, { id: "peer" }]]));
      const editor = useEditor({ content, lockedBlocks });
      const history = useHistory({
        content: editor.content,
        setContent: editor.setContent,
      });
      const recordSpy = vi.spyOn(history, "recordDebounced");
      useHistoryInterceptor(editor, history);

      editor.updateBlock(lockedId, { content: "<p>changed</p>" } as any);

      expect(recordSpy).not.toHaveBeenCalled();
      expect(history.canUndo.value).toBe(false);
    });

    it("skips recording when removeBlock targets a locked block", () => {
      const content = createDefaultTemplateContent();
      content.blocks = [createParagraphBlock()];
      const lockedId = content.blocks[0].id;
      const lockedBlocks = ref(new Map([[lockedId, { id: "peer" }]]));
      const editor = useEditor({ content, lockedBlocks });
      const history = useHistory({
        content: editor.content,
        setContent: editor.setContent,
      });
      const recordSpy = vi.spyOn(history, "record");
      useHistoryInterceptor(editor, history);

      editor.removeBlock(lockedId);

      expect(recordSpy).not.toHaveBeenCalled();
      expect(history.canUndo.value).toBe(false);
    });

    it("skips recording when moveBlock targets a locked block", () => {
      const content = createDefaultTemplateContent();
      content.blocks = [
        createParagraphBlock({ content: "<p>locked</p>" }),
        createParagraphBlock({ content: "<p>other</p>" }),
      ];
      const lockedId = content.blocks[0].id;
      const lockedBlocks = ref(new Map([[lockedId, { id: "peer" }]]));
      const editor = useEditor({ content, lockedBlocks });
      const history = useHistory({
        content: editor.content,
        setContent: editor.setContent,
      });
      const recordSpy = vi.spyOn(history, "record");
      useHistoryInterceptor(editor, history);

      editor.moveBlock(lockedId, 1);

      expect(recordSpy).not.toHaveBeenCalled();
      expect(history.canUndo.value).toBe(false);
    });

    it("skips recording when addBlock targets a locked section", () => {
      const content = createDefaultTemplateContent();
      const lockedSection = createSectionBlock({ columns: "1" });
      content.blocks = [lockedSection];
      const lockedBlocks = ref(new Map([[lockedSection.id, { id: "peer" }]]));
      const editor = useEditor({ content, lockedBlocks });
      const history = useHistory({
        content: editor.content,
        setContent: editor.setContent,
      });
      const recordSpy = vi.spyOn(history, "record");
      useHistoryInterceptor(editor, history);

      editor.addBlock(createParagraphBlock(), lockedSection.id, 0);

      expect(recordSpy).not.toHaveBeenCalled();
      expect(history.canUndo.value).toBe(false);
    });
  });

  it("passes all arguments through to original methods", () => {
    const editor = createMockEditor();
    const history = createMockHistory();
    const originals = {
      addBlock: editor.addBlock,
      removeBlock: editor.removeBlock,
      moveBlock: editor.moveBlock,
      updateBlock: editor.updateBlock,
      updateSettings: editor.updateSettings,
    };

    useHistoryInterceptor(editor, history);

    const block = { id: "b1", type: "image" } as Parameters<
      typeof editor.addBlock
    >[0];
    editor.addBlock(block, "s1", 0, 5);
    expect(originals.addBlock).toHaveBeenCalledWith(block, "s1", 0, 5);

    editor.removeBlock("b2");
    expect(originals.removeBlock).toHaveBeenCalledWith("b2");

    editor.moveBlock("b3", 2, "s2", 1);
    expect(originals.moveBlock).toHaveBeenCalledWith("b3", 2, "s2", 1);

    editor.updateBlock("b4", { content: "x" } as Parameters<
      typeof editor.updateBlock
    >[1]);
    expect(originals.updateBlock).toHaveBeenCalledWith("b4", { content: "x" });

    const settings = { backgroundColor: "red" } as Parameters<
      typeof editor.updateSettings
    >[0];
    editor.updateSettings(settings);
    expect(originals.updateSettings).toHaveBeenCalledWith(settings);
  });
});

function unregisteredAdapter(seed: TemplateContent, locked: Set<string>) {
  const content = ref(seed);
  const activeLocale = ref<string | null>(null);
  function findBlockLocation(id: string) {
    const index = content.value.blocks.findIndex((block) => block.id === id);
    if (index !== -1) return { index };
    for (const section of content.value.blocks)
      if (section.type === "section") {
        for (const [columnIndex, column] of section.children.entries()) {
          const index = column.findIndex((block) => block.id === id);
          if (index !== -1)
            return { index, targetSectionId: section.id, columnIndex };
        }
      }
    return null;
  }
  const findBlock = (id: string) =>
    content.value.blocks
      .flatMap((block) =>
        block.type === "section" ? [block, ...block.children.flat()] : [block],
      )
      .find((block) => block.id === id) ?? null;
  const list = (sectionId?: string, columnIndex = 0) => {
    const section = sectionId ? findBlock(sectionId) : null;
    return section?.type === "section"
      ? section.children[columnIndex]
      : content.value.blocks;
  };
  return {
    content,
    activeLocale,
    findBlock,
    findBlockLocation,
    canEdit: () => activeLocale.value !== "de",
    setActiveLocale: (locale: string | null) => {
      activeLocale.value = locale;
    },
    setContent: (value: TemplateContent) => {
      content.value = value;
    },
    isBlockLocked: (id: string) => locked.has(id),
    addBlock: (block: Block, sectionId?: string, columnIndex?: number) => {
      list(sectionId, columnIndex).push(block);
    },
    removeBlock: (id: string) => {
      const location = findBlockLocation(id);
      if (location)
        list(location.targetSectionId, location.columnIndex).splice(
          location.index,
          1,
        );
    },
    moveBlock: () => {},
    updateBlock: () => {},
    updateSettings: () => {},
  };
}

describe("ref-backed history adapters", () => {
  it("preserves redo when a legacy layer-action adapter targets a locked block", () => {
    const content = createDefaultTemplateContent();
    content.settings.locales = ["de"];
    content.blocks = [createParagraphBlock({ id: "copy" })];
    const locks = ref(new Map<string, unknown>());
    const editor = useEditor({ content, lockedBlocks: locks });
    editor.setActiveLocale("de");
    // This adapter wraps the action rather than inheriting core's preflight.
    const adapter = {
      ...editor,
      setBlockHidden: (id: string, hidden: boolean) =>
        editor.setBlockHidden(id, hidden),
    };
    const history = useHistory({
      content: editor.content,
      setContent: editor.setContent,
    });
    useHistoryInterceptor(adapter, history);
    adapter.updateSettings({ width: 650 });
    adapter.updateSettings({ width: 700 });
    history.undo();
    locks.value.set("copy", {
      blockId: "copy",
      locale: "de",
      holder: { sessionId: "peer" },
    });
    const before = safeClone(editor.content.value);
    const record = vi.spyOn(history, "record");
    adapter.setBlockHidden("copy", true);
    expect(editor.content.value).toEqual(before);
    expect(record).not.toHaveBeenCalled();
    expect(history.canUndo.value).toBe(true);
    expect(history.canRedo.value).toBe(true);
    history.redo();
    expect(editor.content.value.settings.l10n?.de.set?.width).toBe(700);
    history.destroy();
  });

  it.each(["spread", "unregistered"])(
    "inserts, removes and refuses locked edits through a %s adapter",
    (kind) => {
      const seed = createDefaultTemplateContent();
      seed.settings.locales = ["de", "fr"];
      seed.blocks = [
        createParagraphBlock({ id: "base" }),
        createSectionBlock({ id: "section", children: [[]] }),
      ];
      const locked = new Set<string>();
      const peerLocks = ref(new Map<string, unknown>());
      const adapter =
        kind === "spread"
          ? {
              ...useEditor({
                content: seed,
                localization: { locales: ["fr"] },
                lockedBlocks: peerLocks,
              }),
            }
          : unregisteredAdapter(seed, locked);
      const history = useHistory({
        content: adapter.content,
        setContent: adapter.setContent,
      });
      useHistoryInterceptor(adapter, history);
      try {
        const child = createParagraphBlock({
          id: "inserted",
          content: "<p>Inserted</p>",
        });
        const children = () =>
          (
            adapter.content.value.blocks[1] as Extract<
              Block,
              { type: "section" }
            >
          ).children[0];
        expect(() => adapter.addBlock(child, "section", 0)).not.toThrow();
        expect(children().map((block) => block.id)).toEqual(["inserted"]);
        history.undo();
        expect(children()).toEqual([]);
        history.redo();
        expect(children().map((block) => block.id)).toEqual(["inserted"]);
        adapter.removeBlock("inserted");
        expect(children()).toEqual([]);
        history.undo();
        expect(children().map((block) => block.id)).toEqual(["inserted"]);
        expect(history.canUndo.value).toBe(true);
        expect(history.canRedo.value).toBe(true);
        for (const id of ["inserted", "section"]) {
          locked.add(id);
          peerLocks.value.set(id, {
            blockId: id,
            locale: "fr",
            holder: { sessionId: "peer" },
          });
        }
        const before = safeClone(adapter.content.value);
        const record = vi.spyOn(history, "record");
        adapter.removeBlock("inserted");
        expect(() =>
          adapter.addBlock(
            createParagraphBlock({ id: "refused" }),
            "section",
            0,
          ),
        ).not.toThrow();
        expect(adapter.content.value).toEqual(before);
        expect(record).not.toHaveBeenCalled();
        locked.clear();
        peerLocks.value.clear();
        adapter.setActiveLocale("de");
        adapter.addBlock(createParagraphBlock({ id: "readonly" }));
        expect(adapter.content.value).toEqual(before);
        expect(record).not.toHaveBeenCalled();
        expect(history.canUndo.value).toBe(true);
        expect(history.canRedo.value).toBe(true);
        history.redo();
        expect(children()).toEqual([]);
        history.undo();
        expect(children().map((block) => block.id)).toEqual(["inserted"]);
      } finally {
        history.destroy();
      }
    },
  );
});
