import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const root = join(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

it.each(["", "de/"])(
  "%s documents layout projection and missing-locale fallback",
  (language) => {
    expect(read(`apps/docs/${language}api/types.md`)).toContain(
      'missing: "default"',
    );
    for (const page of [
      "api/editor.md",
      "api/renderer-typescript.md",
      "guide/localized-templates.md",
    ]) {
      const text = read(`apps/docs/${language}${page}`);
      expect(text).toContain('missing: "default"');
      expect(text).not.toMatch(/aren't localizable|nicht lokalisierbar/);
    }
  },
);

it("the skill routes layout localization to its contract", () => {
  const text = read("skills/templatical/reference/localize.md");
  expect(text).toContain('missing: "default"');
  expect(text).not.toContain("aren't localizable");
});
