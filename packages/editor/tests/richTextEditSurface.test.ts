import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A title or paragraph enters editing in place (#930): the edit surface takes
 * no layout space of its own, so the text keeps its width, position and line
 * breaks. The ring that marks editing is an outline, which is painted outside
 * the box without moving anything.
 */

const src = (path: string) =>
  readFileSync(resolve(__dirname, "../src", path), "utf8");

/** Declarations of the first rule whose selector is exactly `selector`. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1];
}

/** Every class attribute on an element carrying `tpl-text-editable`. */
function editableClassLists(template: string): string[] {
  return [...template.matchAll(/class="([^"]*\btpl-text-editable\b[^"]*)"/g)].map(
    (m) => m[1],
  );
}

const LAYOUT_UTILITY =
  /\btpl:(?:p[xytrbl]?|border(?:-[trblxy])?|min-h)(?:-|\[|\b)/;

describe("rich-text edit surface", () => {
  const css = src("styles/index.css");
  const template = src("components/blocks/RichTextEditorContent.vue");

  it("draws its ring as an outline and declares no box of its own", () => {
    const body = ruleBody(css, ".tpl-text-editable");
    expect(body).toMatch(/outline:\s*1px dashed var\(--tpl-primary\);/);
    expect(body).toMatch(/outline-offset:\s*4px;/);
    expect(body).not.toMatch(/\b(?:padding|border|min-height)\b/);
    expect(body).not.toMatch(LAYOUT_UTILITY);
  });

  it("keeps the editor and loading states free of padding, border and min-height", () => {
    const lists = editableClassLists(template);
    // Loading, error, and the TipTap surface.
    expect(lists).toHaveLength(3);
    const contentBearing = lists.filter((list) => !list.includes("--error"));
    expect(contentBearing).toEqual(["tpl-text-editable", "tpl-text-editable"]);
  });

  it("marks the error state by outline colour, not a border", () => {
    const error = editableClassLists(template).find((list) =>
      list.includes("tpl-text-editable--error"),
    );
    expect(error).toBeDefined();
    expect(error).not.toMatch(/\btpl:border/);
    expect(ruleBody(css, ".tpl-text-editable--error")).toMatch(
      /outline-color:\s*var\(--tpl-danger\);/,
    );
  });
});
