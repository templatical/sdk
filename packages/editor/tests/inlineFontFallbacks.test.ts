// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import { mount } from "@vue/test-utils";
import { resolveFontStack } from "@templatical/types";
import { inlineFontFallbackExtension } from "../src/utils/inlineFontFallbackExtension";
import { vInlineFontFallbacks } from "../src/utils/inlineFontFallbacks";

const resolve = (family: string) =>
  resolveFontStack(family, {
    customFonts: [
      {
        name: "Inter",
        url: "https://fonts.example.com/inter.css",
        fallback: "Helvetica, sans-serif",
      },
    ],
    defaultFallback: "Georgia, serif",
  });

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

function makeEditor(content: string): Editor {
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: [
      StarterKit,
      TextStyle,
      FontFamily,
      inlineFontFallbackExtension(resolve),
    ],
    content,
  });
  editors.push(editor);
  return editor;
}

describe("inline font fallbacks in edit mode", () => {
  it.each([
    ["Inter", "Inter, Helvetica, sans-serif"],
    ["Georgia", "Georgia, serif"],
  ])("paints an existing %s font with the email fallback", (font, expected) => {
    const editor = makeEditor(
      `<p><span style="font-family: ${font}">Hello</span></p>`,
    );
    const decorated =
      editor.view.dom.querySelectorAll<HTMLElement>("span[style]");
    expect(
      [...decorated].some((span) => span.style.fontFamily.includes(expected)),
    ).toBe(true);
    expect(editor.getHTML()).toContain(`font-family: ${font}`);
    expect(editor.getHTML()).not.toContain("Helvetica, sans-serif");
  });

  it("paints a newly selected font without storing the fallback", () => {
    const editor = makeEditor("<p>Hello</p>");
    editor.commands.selectAll();
    editor.commands.setFontFamily("Inter");
    const decorated =
      editor.view.dom.querySelectorAll<HTMLElement>("span[style]");
    expect(
      [...decorated].some((span) =>
        span.style.fontFamily.includes("Helvetica, sans-serif"),
      ),
    ).toBe(true);
    expect(editor.getHTML()).toContain("font-family: Inter");
    expect(editor.getHTML()).not.toContain("Helvetica, sans-serif");
  });
});

describe("inline font fallbacks on the canvas", () => {
  it("keeps an inline !important priority when adding a fallback", () => {
    const wrapper = mount({
      template:
        '<div v-inline-font-fallbacks="resolve"><span style="font-family: Inter !important">Hi</span></div>',
      directives: { inlineFontFallbacks: vInlineFontFallbacks },
      setup: () => ({ resolve }),
    });
    const span = wrapper.get("span").element as HTMLElement;
    expect(span.style.fontFamily).toBe("Inter, Helvetica, sans-serif");
    expect(span.style.getPropertyPriority("font-family")).toBe("important");
    wrapper.unmount();
  });
});
