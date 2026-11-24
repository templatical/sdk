import { afterEach, describe, expect, it, vi } from "vitest";
import { ref, watch } from "@vue/reactivity";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  safeClone,
  type TemplateContent,
} from "@templatical/types";
import {
  useAutoSave,
  useEditor,
  useHistory,
  useHistoryInterceptor,
} from "../src";
import * as diffModule from "../src/diff-content";
import {
  createGenerator,
  randomContent,
  randomEdit,
} from "./helpers/random-content";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function open(content: TemplateContent) {
  const editor = useEditor({ content });
  const history = useHistory({
    content: editor.content,
    setContent: editor.setContent,
    markDirty: editor.markDirty,
  });
  useHistoryInterceptor(editor, history);
  return { editor, history };
}

describe("snapshot history applied in place", () => {
  it("keeps unchanged block and content identities through undo and redo", () => {
    const content = createDefaultTemplateContent();
    content.blocks = ["A", "B", "C"].map((id) =>
      createParagraphBlock({ id, content: `<p>${id}</p>` }),
    );
    const { editor, history } = open(content);
    const live = editor.content.value;
    const [a, b, c] = live.blocks;

    editor.updateBlock("B", { content: "<p>edited</p>" });
    expect((editor.content.value.blocks[1] as typeof b).content).toBe(
      "<p>edited</p>",
    );
    history.undo();
    expect(editor.content.value).toBe(live);
    expect(editor.content.value.blocks[0]).toBe(a);
    expect(editor.content.value.blocks[2]).toBe(c);
    expect(editor.content.value.blocks[1]).toBe(b);
    expect((editor.content.value.blocks[1] as typeof b).content).toBe(
      "<p>B</p>",
    );
    expect(history.canRedo.value).toBe(true);

    history.redo();
    expect(editor.content.value).toBe(live);
    expect(editor.content.value.blocks[0]).toBe(a);
    expect(editor.content.value.blocks[2]).toBe(c);
    expect(editor.content.value.blocks[1]).toBe(b);
    expect((editor.content.value.blocks[1] as typeof b).content).toBe(
      "<p>edited</p>",
    );
    expect(editor.state.isDirty).toBe(true);
    expect(editor.contentReplaced.value).toBe(0);
  });

  it("restores settings, nested children, custom data, and localized layers exactly", () => {
    const content = createDefaultTemplateContent();
    content.settings.locales = ["de"];
    content.blocks = [
      createSectionBlock({
        id: "outer",
        children: [
          [
            createSectionBlock({
              id: "inner",
              children: [
                [
                  createParagraphBlock({
                    id: "localized",
                    content: "<p>Hello</p>",
                    l10n: {
                      de: {
                        text: {
                          content: {
                            value: "<p>Hallo</p>",
                            sourceHash: "12345678",
                          },
                        },
                      },
                    },
                  }),
                ],
              ],
            }),
          ],
        ],
      }),
      {
        id: "custom",
        type: "custom",
        customType: "card",
        fieldValues: { title: "Old" },
      } as TemplateContent["blocks"][number],
    ];
    const { editor, history } = open(content);
    const start = safeClone(editor.content.value);
    const live = editor.content.value;
    history.record();
    editor.content.value.settings.width = 640;
    editor.content.value.settings.locales = ["de", "fr"];
    const inner = (
      editor.content.value.blocks[0] as ReturnType<typeof createSectionBlock>
    ).children[0][0] as ReturnType<typeof createSectionBlock>;
    const localized = inner.children[0][0] as ReturnType<
      typeof createParagraphBlock
    >;
    localized.content = "<p>Changed</p>";
    localized.l10n!.de!.text!.content = {
      value: "<p>Neu</p>",
      sourceHash: "87654321",
    };
    (
      editor.content.value.blocks[1] as { fieldValues: { title: string } }
    ).fieldValues.title = "New";
    const edited = safeClone(editor.content.value);

    history.undo();
    expect(editor.content.value).toBe(live);
    expect(editor.content.value).toEqual(start);
    history.redo();
    expect(editor.content.value).toBe(live);
    expect(editor.content.value).toEqual(edited);
  });

  // 50 seeds take under a second locally and 7 s on a CI runner under
  // coverage, past vitest's 5 s default; fewer seeds would cover less.
  it(
    "round-trips seeded sequences of edits in both directions",
    { timeout: 30_000 },
    () => {
      let inPlaceSeeds = 0;
      for (let seed = 1; seed <= 50; seed++) {
        const gen = createGenerator(seed);
        const content = ref(randomContent(gen));
        const history = useHistory({
          content,
          setContent: (snapshot) => {
            content.value = snapshot;
          },
        });
        const start = safeClone(content.value);
        // A restore past eight operations replaces the content (see the bulk
        // group below), so identity holds only when every step stays under it.
        let withinCap = true;
        for (let step = 0; step < 5; step++) {
          history.record();
          const before = content.value;
          content.value = randomEdit(gen, content.value);
          if (diffModule.diffContent(before, content.value).length > 8) {
            withinCap = false;
          }
        }
        const live = content.value;
        const end = safeClone(content.value);
        for (let step = 0; step < 5; step++) history.undo();
        if (withinCap) {
          expect(content.value, `undo identity seed ${seed}`).toBe(live);
        }
        expect(content.value, `undo seed ${seed}`).toEqual(start);
        for (let step = 0; step < 5; step++) history.redo();
        if (withinCap) {
          expect(content.value, `redo identity seed ${seed}`).toBe(live);
          inPlaceSeeds++;
        }
        expect(content.value, `redo seed ${seed}`).toEqual(end);
        history.destroy();
      }
      expect(inPlaceSeeds).toBeGreaterThanOrEqual(35);
    },
  );

  it("replaces the full snapshot if an operation fails after an earlier write", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createParagraphBlock({ id: "A", content: "<p>old</p>" })];
    const { editor, history } = open(content);
    editor.updateBlock("A", { content: "<p>new</p>" });
    const diff = vi.spyOn(diffModule, "diffContent").mockReturnValueOnce([
      { op: "updateBlock", blockId: "A", set: { content: "<p>partial</p>" } },
      { op: "deleteBlock", blockId: "missing" },
    ]);

    history.undo();
    expect(diff).toHaveBeenCalledOnce();
    expect(
      (
        editor.content.value.blocks[0] as ReturnType<
          typeof createParagraphBlock
        >
      ).content,
    ).toBe("<p>old</p>");
    expect(history.canRedo.value).toBe(true);
    expect(editor.state.isDirty).toBe(true);
  });

  it("keeps a surviving selected block selected", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createParagraphBlock({ id: "A", content: "<p>A</p>" }),
      createParagraphBlock({ id: "B", content: "<p>B</p>" }),
    ];
    const { editor, history } = open(content);
    const live = editor.content.value;
    editor.selectBlock("A");
    const selected = editor.selectedBlock.value;
    editor.updateBlock("B", { content: "<p>edited</p>" });
    history.undo();
    expect(editor.content.value).toBe(live);
    expect(editor.state.selectedBlockId).toBe("A");
    expect(editor.selectedBlock.value).toBe(editor.content.value.blocks[0]);
    expect(editor.selectedBlock.value).toBe(selected);
  });

  it("keeps onChange active after an in-place undo", () => {
    vi.useFakeTimers();
    const content = createDefaultTemplateContent();
    content.blocks = [createParagraphBlock({ id: "A", content: "<p>old</p>" })];
    const { editor, history } = open(content);
    const live = editor.content.value;
    const onChange = vi.fn();
    const autoSave = useAutoSave({
      content: editor.content,
      isDirty: () => editor.state.isDirty,
      onChange,
      debounce: 10,
    });
    editor.updateBlock("A", { content: "<p>new</p>" });
    vi.advanceTimersByTime(10);
    onChange.mockClear();

    history.undo();
    expect(editor.content.value).toBe(live);
    vi.advanceTimersByTime(10);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as TemplateContent).blocks[0]).toEqual(
      createParagraphBlock({ id: "A", content: "<p>old</p>" }),
    );
    autoSave.destroy();
  });

  it("marks each undo and redo dirty after a save, without clearing history", async () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createParagraphBlock({ id: "A", content: "<p>old</p>" })];
    const storage = {
      load: vi.fn(async () => ({
        id: "x",
        name: "x",
        content: safeClone(content),
      })),
      create: false as const,
      save: vi.fn(async (id: string, patch: { content?: TemplateContent }) => ({
        id,
        name: "x",
        content: safeClone(patch.content!),
      })),
    };
    const editor = useEditor({ content, templates: storage });
    const history = useHistory({
      content: editor.content,
      setContent: editor.setContent,
      markDirty: editor.markDirty,
    });
    useHistoryInterceptor(editor, history);
    await editor.load("x");
    const live = editor.content.value;
    editor.updateBlock("A", { content: "<p>new</p>" });
    await editor.save();
    expect(editor.state.isDirty).toBe(false);

    history.undo();
    expect(editor.content.value).toBe(live);
    expect(editor.state.isDirty).toBe(true);
    expect(history.canRedo.value).toBe(true);
    expect(editor.contentReplaced.value).toBe(1);
    await editor.save();
    expect(editor.state.isDirty).toBe(false);

    history.redo();
    expect(editor.content.value).toBe(live);
    expect(editor.state.isDirty).toBe(true);
    expect(history.canUndo.value).toBe(true);
    expect(editor.contentReplaced.value).toBe(1);
  });

  it("falls back when diffing itself throws", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createParagraphBlock({ id: "A", content: "<p>old</p>" })];
    const { editor, history } = open(content);
    editor.updateBlock("A", { content: "<p>new</p>" });
    const diff = vi
      .spyOn(diffModule, "diffContent")
      .mockImplementationOnce(() => {
        throw new Error("diff failed");
      });

    history.undo();
    expect(diff).toHaveBeenCalledOnce();
    expect(
      (
        editor.content.value.blocks[0] as ReturnType<
          typeof createParagraphBlock
        >
      ).content,
    ).toBe("<p>old</p>");
    expect(history.canRedo.value).toBe(true);
  });

  it("falls back if an incomplete diff does not equal the snapshot", () => {
    const content = createDefaultTemplateContent();
    content.blocks = [createParagraphBlock({ id: "A", content: "<p>old</p>" })];
    const { editor, history } = open(content);
    editor.updateBlock("A", { content: "<p>new</p>" });
    const diff = vi.spyOn(diffModule, "diffContent").mockReturnValueOnce([]);

    history.undo();
    expect(diff).toHaveBeenCalledOnce();
    expect(
      (
        editor.content.value.blocks[0] as ReturnType<
          typeof createParagraphBlock
        >
      ).content,
    ).toBe("<p>old</p>");
    expect(history.canRedo.value).toBe(true);
  });
  describe("bulk restores replace the content once", () => {
    function bulkEdit(count: number) {
      const content = createDefaultTemplateContent();
      content.blocks = Array.from({ length: count }, (_, i) =>
        createParagraphBlock({ id: `b${i}`, content: `<p>${i}</p>` }),
      );
      const { editor, history } = open(content);
      const first = editor.content.value.blocks[0];
      let traversals = 0;
      watch(editor.content, () => traversals++, { deep: true });
      history.record();
      for (const block of editor.content.value.blocks) {
        (block as ReturnType<typeof createParagraphBlock>).content =
          "<p>bulk</p>";
      }
      traversals = 0;
      history.undo();
      return { editor, first, traversals: () => traversals };
    }

    it("applies eight changed blocks in place", () => {
      const { editor, first, traversals } = bulkEdit(8);
      expect(editor.content.value.blocks[0]).toBe(first);
      expect(traversals()).toBe(8);
      expect(
        (
          editor.content.value.blocks[7] as ReturnType<
            typeof createParagraphBlock
          >
        ).content,
      ).toBe("<p>7</p>");
    });

    it("replaces the content once past eight operations", () => {
      const { editor, first, traversals } = bulkEdit(9);
      expect(editor.content.value.blocks[0]).not.toBe(first);
      expect(traversals()).toBe(1);
      expect(
        (
          editor.content.value.blocks[8] as ReturnType<
            typeof createParagraphBlock
          >
        ).content,
      ).toBe("<p>8</p>");
    });
  });
});
