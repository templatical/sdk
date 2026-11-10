import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  type Template,
  type TemplateContent,
  type TemplatesProvider,
} from "@templatical/types";
import { useEditor, useHistory, useHistoryInterceptor } from "../src";

function content(text: string): TemplateContent {
  const result = createDefaultTemplateContent();
  result.blocks = [
    createParagraphBlock({ id: "paragraph", content: `<p>${text}</p>` }),
  ];
  return result;
}

function template(id: string, text: string): Template {
  return { id, name: id, content: content(text) };
}

function open(provider: TemplatesProvider) {
  const editor = useEditor({ content: content("draft"), templates: provider });
  const history = useHistory({
    content: editor.content,
    setContent: editor.setContent,
  });
  useHistoryInterceptor(editor, history);
  const text = () =>
    (editor.content.value.blocks[0] as ReturnType<typeof createParagraphBlock>)
      .content;
  const edit = (value: string) =>
    editor.updateBlock("paragraph", { content: `<p>${value}</p>` });
  return { editor, history, text, edit };
}

function provider(
  overrides: Partial<TemplatesProvider> = {},
): TemplatesProvider {
  return {
    load: vi.fn(async (id: string) => template(id, id === "x" ? "X1" : "Y1")),
    create: vi.fn(async (input) => ({
      id: "new",
      name: input.name ?? "new",
      content: input.content,
    })),
    save: vi.fn(async (id, patch) => ({
      id,
      name: patch.name ?? id,
      content: patch.content!,
    })),
    ...overrides,
  };
}

afterEach(() => vi.useRealTimers());

describe("headless history after document replacement", () => {
  it("load clears X history so undo cannot save X content into Y", async () => {
    const storage = provider();
    const { editor, history, text, edit } = open(storage);
    await editor.load("x");
    edit("X2");
    expect(history.canUndo.value).toBe(true);

    await editor.load("y");
    expect(editor.state.template?.id).toBe("y");
    expect(text()).toBe("<p>Y1</p>");
    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(false);
    history.undo();
    expect(text()).toBe("<p>Y1</p>");
    await editor.save();
    expect(storage.save).toHaveBeenCalledWith("y", {
      name: "y",
      content: editor.content.value,
    });
    expect(
      (
        vi.mocked(storage.save as Exclude<TemplatesProvider["save"], false>)
          .mock.calls[0][1].content!.blocks[0] as ReturnType<
          typeof createParagraphBlock
        >
      ).content,
    ).toBe("<p>Y1</p>");
  });

  it("create with content clears stale snapshots of the previous document", async () => {
    const { editor, history, text, edit } = open(provider());
    edit("A1");
    edit("A2");
    expect(history.canUndo.value).toBe(true);

    await editor.create({ content: content("B1") });
    expect(text()).toBe("<p>B1</p>");
    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(false);
    history.undo();
    expect(text()).toBe("<p>B1</p>");
  });

  it("create without input keeps the current edit undoable, then a content replacement clears it", async () => {
    const { editor, history, text, edit } = open(provider());
    edit("draft edit");
    await editor.create();
    expect(history.canUndo.value).toBe(true);
    history.undo();
    expect(text()).toBe("<p>draft</p>");
    history.redo();
    expect(text()).toBe("<p>draft edit</p>");

    await editor.create({ content: content("replacement") });
    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(false);
  });

  it("create with only a name keeps the edit undoable, then a content replacement clears it", async () => {
    const { editor, history, text, edit } = open(provider());
    edit("draft edit");
    await editor.create({ name: "Copy" });
    expect(history.canUndo.value).toBe(true);
    history.undo();
    expect(text()).toBe("<p>draft</p>");
    history.redo();
    expect(text()).toBe("<p>draft edit</p>");

    await editor.create({ content: content("replacement") });
    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(false);
  });

  it("load clears a pending typing debounce before it can leave an old snapshot", async () => {
    vi.useFakeTimers();
    const { editor, history, text, edit } = open(provider());
    edit("typing");
    expect(history.canUndo.value).toBe(true);

    await editor.load("y");
    await vi.advanceTimersByTimeAsync(301);
    expect(text()).toBe("<p>Y1</p>");
    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(false);
    history.undo();
    expect(text()).toBe("<p>Y1</p>");
  });

  it("a refused load keeps history until a later applied load clears it", async () => {
    const { editor, history, text, edit } = open(provider());
    edit("draft edit");
    const result = await editor.load("y", () => false);
    expect(result.id).toBe("y");
    expect(text()).toBe("<p>draft edit</p>");
    expect(history.canUndo.value).toBe(true);
    history.undo();
    expect(text()).toBe("<p>draft</p>");
    expect(history.canRedo.value).toBe(true);
    history.redo();
    expect(text()).toBe("<p>draft edit</p>");
    history.undo();
    expect(history.canRedo.value).toBe(true);

    await editor.load("y", () => true);
    expect(text()).toBe("<p>Y1</p>");
    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(false);
  });
});
