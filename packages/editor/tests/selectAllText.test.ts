// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import { SelectAllText } from "../src/extensions/SelectAllText";

const styled =
  '<p style="text-align:center"><span style="font-family:Georgia"><strong>Book your bird</strong></span></p>';

let editor: Editor | undefined;

function makeEditor(
  extensions: unknown[] = [SelectAllText],
  content: string = styled,
): Editor {
  editor = new Editor({
    element: document.body.appendChild(document.createElement("div")),
    extensions: [
      StarterKit,
      TextStyle,
      FontFamily,
      TextAlign.configure({ types: ["paragraph"] }),
      ...(extensions as never[]),
    ],
    content,
  });
  return editor;
}

// The real key path: ProseMirror resolves Mod to Meta on a Mac and Ctrl
// elsewhere, so the event has to match whichever this runtime reports.
function pressModA(e: Editor): void {
  const mac = /Mac|iP(hone|[oa]d)/.test(navigator.platform);
  press(
    e,
    new KeyboardEvent("keydown", { key: "a", metaKey: mac, ctrlKey: !mac }),
  );
}

function press(e: Editor, event: KeyboardEvent): void {
  e.view.someProp("handleKeyDown", (f) => f(e.view, event));
}

// Typing over a selection: ProseMirror's default text input path.
function type(e: Editor, text: string): void {
  e.view.dispatch(e.state.tr.insertText(text));
}

afterEach(() => editor?.destroy());

describe("SelectAllText", () => {
  it("keeps the text's marks and the paragraph's alignment when typing over Mod-a", () => {
    const e = makeEditor();
    pressModA(e);
    type(e, "Hello");

    expect(e.getHTML()).toBe(
      '<p style="text-align: center;"><span style="font-family: Georgia;"><strong>Hello</strong></span></p>',
    );
  });

  it("still selects every word", () => {
    const e = makeEditor();
    pressModA(e);

    expect(
      e.state.doc.textBetween(e.state.selection.from, e.state.selection.to),
    ).toBe("Book your bird");
  });

  // Without it, Mod-a is an AllSelection and the typed text inherits nothing.
  it("is what the default select-all loses", () => {
    const e = makeEditor([]);
    pressModA(e);
    type(e, "Hello");

    expect(e.getHTML()).toBe("<p>Hello</p>");
  });

  it("spans every paragraph, from the first to the last", () => {
    const e = makeEditor([SelectAllText], "<p>One</p><p>Two</p>");
    pressModA(e);

    expect(
      e.state.doc.textBetween(
        e.state.selection.from,
        e.state.selection.to,
        "|",
      ),
    ).toBe("One|Two");
    expect(e.state.selection.$from.parent.isTextblock).toBe(true);
  });

  it("reaches the paragraphs inside a list", () => {
    const e = makeEditor(
      [SelectAllText],
      "<ul><li><p>One</p></li><li><p>Two</p></li></ul>",
    );
    pressModA(e);

    expect(
      e.state.doc.textBetween(
        e.state.selection.from,
        e.state.selection.to,
        "|",
      ),
    ).toBe("One|Two");
    expect(e.state.selection.$from.parent.isTextblock).toBe(true);
  });

  // The selection spans the whole document, so TipTap's clearDocument resets
  // it to a bare paragraph, as the default select-all and a mouse selection
  // over every word both do.
  it("clears a list to an empty paragraph when Delete follows Mod-a", () => {
    const e = makeEditor(
      [SelectAllText],
      "<ul><li><p>One</p></li><li><p>Two</p></li></ul>",
    );
    pressModA(e);
    press(e, new KeyboardEvent("keydown", { key: "Delete" }));

    expect(e.getHTML()).toBe("<p></p>");
  });
});
