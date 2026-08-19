import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LineBoundaryKeys } from "../src/extensions/LineBoundaryKeys";

type ShortcutHandler = (props: { editor: unknown }) => boolean;

function getShortcuts(): Record<string, ShortcutHandler> {
  return (LineBoundaryKeys.config.addKeyboardShortcuts as Function).call({});
}

interface FakeEditorOptions {
  composing?: boolean;
  hasModify?: boolean;
  rootHasGetSelection?: boolean;
  selectionIsNull?: boolean;
  anchorInsideEditable?: boolean;
}

function makeFakeEditor(options: FakeEditorOptions = {}) {
  const {
    composing = false,
    hasModify = true,
    rootHasGetSelection = true,
    selectionIsNull = false,
    anchorInsideEditable = true,
  } = options;

  const modify = vi.fn();
  const anchorNode = {};
  const selection = selectionIsNull
    ? null
    : {
        anchorNode,
        ...(hasModify ? { modify } : {}),
      };

  const dom = {
    ownerDocument: {
      getSelection: vi.fn(() => selection),
    },
    contains: vi.fn((node: unknown) =>
      anchorInsideEditable ? node === anchorNode : false,
    ),
  };

  const root = rootHasGetSelection
    ? { getSelection: vi.fn(() => selection) }
    : {};

  const editor = { view: { composing, root, dom } };
  return { editor, modify, root, dom };
}

describe("LineBoundaryKeys extension", () => {
  it("is named lineBoundaryKeys", () => {
    expect(LineBoundaryKeys.config.name).toBe("lineBoundaryKeys");
  });

  it("binds exactly plain End and Home — shifted variants stay native", () => {
    const shortcuts = getShortcuts();
    expect(Object.keys(shortcuts).sort()).toEqual(["End", "Home"]);
  });

  it("End moves the selection forward to the line boundary and consumes the key", () => {
    const { editor, modify } = makeFakeEditor();
    const handled = getShortcuts().End({ editor });
    expect(modify).toHaveBeenCalledWith("move", "forward", "lineboundary");
    expect(handled).toBe(true);
  });

  it("Home moves the selection backward to the line boundary and consumes the key", () => {
    const { editor, modify } = makeFakeEditor();
    const handled = getShortcuts().Home({ editor });
    expect(modify).toHaveBeenCalledWith("move", "backward", "lineboundary");
    expect(handled).toBe(true);
  });

  it("does nothing during IME composition", () => {
    const { editor, modify } = makeFakeEditor({ composing: true });
    const handled = getShortcuts().End({ editor });
    expect(handled).toBe(false);
    expect(modify).not.toHaveBeenCalled();
  });

  it("falls back to native handling when Selection.modify is unavailable", () => {
    const { editor, modify } = makeFakeEditor({ hasModify: false });
    const handled = getShortcuts().End({ editor });
    expect(handled).toBe(false);
    expect(modify).not.toHaveBeenCalled();
  });

  it("falls back to native handling when there is no selection", () => {
    const { editor } = makeFakeEditor({ selectionIsNull: true });
    const handled = getShortcuts().End({ editor });
    expect(handled).toBe(false);
  });

  it("falls back to native handling when the selection anchor is outside the editable", () => {
    const { editor, modify } = makeFakeEditor({ anchorInsideEditable: false });
    const handled = getShortcuts().End({ editor });
    expect(handled).toBe(false);
    expect(modify).not.toHaveBeenCalled();
  });

  it("reads the selection from view.root so shadow-DOM mounts resolve their own selection", () => {
    const { editor, root, modify } = makeFakeEditor();
    getShortcuts().End({ editor });
    expect(
      (root as { getSelection: ReturnType<typeof vi.fn> }).getSelection,
    ).toHaveBeenCalledTimes(1);
    expect(modify).toHaveBeenCalledWith("move", "forward", "lineboundary");
  });

  it("falls back to the owner document's selection when the root has no getSelection", () => {
    const { editor, dom, modify } = makeFakeEditor({
      rootHasGetSelection: false,
    });
    const handled = getShortcuts().End({ editor });
    expect(dom.ownerDocument.getSelection).toHaveBeenCalledTimes(1);
    expect(modify).toHaveBeenCalledWith("move", "forward", "lineboundary");
    expect(handled).toBe(true);
  });
});

describe("LineBoundaryKeys wiring", () => {
  const read = (rel: string) =>
    readFileSync(join(__dirname, "..", "src", rel), "utf8");

  it("is exported from the extensions barrel", () => {
    expect(read("extensions/index.ts")).toContain("LineBoundaryKeys");
  });

  it("ParagraphEditor registers it in its extension list", () => {
    const src = read("components/blocks/ParagraphEditor.vue");
    expect(src).toContain("LineBoundaryKeys");
  });

  it("TitleEditor registers it in its extension list", () => {
    const src = read("components/blocks/TitleEditor.vue");
    expect(src).toContain("LineBoundaryKeys");
  });
});
