import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TextAlign } from "@tiptap/extension-text-align";

const TOOLBAR_SRC = readFileSync(
  resolve(__dirname, "../src/components/blocks/ParagraphToolbar.vue"),
  "utf-8",
);

const EDITOR_SRC = readFileSync(
  resolve(__dirname, "../src/components/blocks/ParagraphEditor.vue"),
  "utf-8",
);

const ALIGNMENTS = ["left", "center", "right", "justify"] as const;

describe("ParagraphToolbar alignment controls", () => {
  it("renders a button for all four alignments", () => {
    for (const alignment of ALIGNMENTS) {
      expect(TOOLBAR_SRC).toContain(
        `@click="editor.chain().focus().setTextAlign('${alignment}').run()"`,
      );
    }
  });

  it("marks each alignment button active from the matching textAlign attr", () => {
    for (const alignment of ALIGNMENTS) {
      expect(TOOLBAR_SRC).toContain(
        `:active="editor.isActive({ textAlign: '${alignment}' })"`,
      );
    }
  });

  it("labels each alignment button from i18n, never a hardcoded string", () => {
    for (const key of [
      "alignLeft",
      "alignCenter",
      "alignRight",
      "alignJustify",
    ]) {
      expect(TOOLBAR_SRC).toContain(`:label="t.paragraphEditor.${key}"`);
    }
  });

  it("orders the group left, center, right, justify", () => {
    const positions = ALIGNMENTS.map((alignment) =>
      TOOLBAR_SRC.indexOf(`setTextAlign('${alignment}')`),
    );
    expect(positions.every((index) => index >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("uses the dedicated AlignJustify icon", () => {
    expect(TOOLBAR_SRC).toContain("AlignJustify");
    expect(TOOLBAR_SRC).toContain(':icon="AlignJustify"');
  });
});

describe("ParagraphEditor TextAlign wiring", () => {
  it("registers TextAlign for the paragraph type", () => {
    expect(EDITOR_SRC).toContain(
      'TextAlign.configure({ types: ["paragraph"] })',
    );
  });

  it("relies on a TipTap default that still permits justify", () => {
    expect(TextAlign.options.alignments).toContain("justify");
  });
});
