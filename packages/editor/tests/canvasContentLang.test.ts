// Structural: the browser's spellchecker and hyphenation read `lang` off the
// nearest ancestor that carries one. With none anywhere under the editor, the
// canvas inherits the HOST page's language, so German copy is spellchecked as
// English (every word underlined) and hyphenated by English rules. Only the
// template knows what language its content is in.
//
// Structural rather than behavioural because neither happy-dom nor Playwright
// exposes spellcheck decisions — what is testable is that the attribute is bound
// to the template's own locale and travels with it.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "vue/compiler-sfc";

const SRC = join(__dirname, "../src");

function template(file: string): string {
  const source = readFileSync(join(SRC, file), "utf8");
  const { descriptor, errors } = parse(source);
  expect(errors).toEqual([]);
  return descriptor.template?.content ?? "";
}

describe("the canvas declares the template's content language", () => {
  it("binds lang on the editing canvas", () => {
    expect(template("components/Canvas.vue")).toContain(':lang="contentLang"');
  });

  // Every surface that renders blocks, not just the editing canvas: the
  // test-email dialog and the saved-block previews render the same rich text and
  // would otherwise be spellchecked in the host's language too.
  it("binds lang on the shared preview canvas", () => {
    expect(template("components/BlockPreviewCanvas.vue")).toContain(
      ':lang="contentLang"',
    );
  });

  it.each(["components/Canvas.vue", "components/BlockPreviewCanvas.vue"])(
    "derives it from the template settings, never from config.locale: %s",
    (file) => {
      const source = readFileSync(join(SRC, file), "utf8");
      const match = source.match(/const contentLang = computed\([^;]*?\);/s);
      expect(match).not.toBeNull();
      const decl = match![0];
      expect(decl).toContain("settings");
      expect(decl).toContain("locale");
      // `config.locale` is the chrome's language. Using it here would declare a
      // German-authored English email as German.
      expect(decl).not.toContain("config.");
    },
  );

  // An empty `lang=""` is worse than none: it explicitly declares "unknown
  // language", which suppresses spellcheck instead of falling back.
  it.each(["components/Canvas.vue", "components/BlockPreviewCanvas.vue"])(
    "resolves to undefined rather than an empty string: %s",
    (file) => {
      const source = readFileSync(join(SRC, file), "utf8");
      const decl = source.match(/const contentLang = computed\([^;]*?\);/s)![0];
      expect(decl).toContain("undefined");
      expect(decl).not.toMatch(/\?\?\s*["'`]["'`]/);
    },
  );
});

describe("the canvas declares the template's writing direction", () => {
  it("binds dir on the editing canvas", () => {
    expect(template("components/Canvas.vue")).toContain(':dir="contentDir"');
  });

  it("binds dir on the shared preview canvas", () => {
    expect(template("components/BlockPreviewCanvas.vue")).toContain(
      ':dir="contentDir"',
    );
  });

  it.each(["components/Canvas.vue", "components/BlockPreviewCanvas.vue"])(
    "derives it from resolveContentDirection(settings), never from config.locale: %s",
    (file) => {
      const source = readFileSync(join(SRC, file), "utf8");
      expect(source).toContain("resolveContentDirection");
      const match = source.match(/const contentDir = computed\([^;]*?\);/s);
      expect(match).not.toBeNull();
      const decl = match![0];
      expect(decl).toContain("settings");
      expect(decl).not.toContain("config.");
      // Empty dir would inherit the host and undo isolation. Always a token.
      expect(decl).not.toContain("undefined");
    },
  );

  // `flex-direction: row` follows the inline axis, so canvas `dir="rtl"`
  // already puts column 0 on the right. A `tpl:flex-row-reverse` class would
  // (a) ship in every LTR session's CSS because Tailwind scans the Vue
  // source, and (b) double-reverse the columns on an RTL canvas.
  it("does not reverse section columns with an extra flex utility", () => {
    expect(template("components/blocks/SectionBlock.vue")).not.toContain(
      "flex-row-reverse",
    );
    expect(template("components/blocks/PreviewSectionBlock.vue")).not.toContain(
      "flex-row-reverse",
    );
  });

  it.each([
    "components/blocks/SectionBlock.vue",
    "components/blocks/PreviewSectionBlock.vue",
  ])(
    "inherits writing direction from the canvas, never re-derives it: %s",
    (file) => {
      const source = readFileSync(join(SRC, file), "utf8");
      expect(source).not.toContain("resolveContentDirection");
      expect(source).not.toMatch(/\bisRtl\b/);
    },
  );
});
