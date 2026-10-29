import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { compileStyle, parse } from "vue/compiler-sfc";

/**
 * Every selector a `<style scoped>` block compiles to must keep its scope.
 *
 * Vue's scoped compiler turns a selector that starts with `:global(…)` into
 * the global part alone and leaves `:global(` inside `:has()` as literal text.
 * `:global(.tpl-block--selected) > .tpl-locale-chip .tpl-locale-chip-label`
 * once compiled to `.tpl-block--selected { display: inline }`, which restyled
 * every selected and hovered block in every editor on the page. A selector
 * that belongs to another component goes in `styles/index.css` instead.
 *
 * File paths are relative to `packages/editor/src/`, POSIX-style.
 */

const SRC = join(import.meta.dirname, "..", "src");
const SCOPE = "data-v-audit";

function vueFiles(): string[] {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".vue"))
    .map((entry) =>
      relative(SRC, join(entry.parentPath ?? SRC, entry.name))
        .split(sep)
        .join("/"),
    )
    .sort();
}

/** Selector lists of every style rule, keyframe steps excluded. */
function selectors(css: string): string[] {
  const found: string[] = [];
  const stack: boolean[] = [];
  let prelude = "";
  for (const char of css.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (char === "{") {
      const head = prelude.trim();
      const keyframes = stack.at(-1) === true;
      if (!head.startsWith("@") && !keyframes) found.push(head);
      stack.push(/^@(-\w+-)?keyframes\b/.test(head));
      prelude = "";
    } else if (char === "}") {
      stack.pop();
      prelude = "";
    } else if (char === ";") prelude = "";
    else prelude += char;
  }
  return found.flatMap(splitList);
}

/** Splits `a, b:is(c, d)` at its top-level commas. */
function splitList(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of list) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += char;
  }
  return [...parts, current.trim()];
}

function unscopedSelectors(file: string): string[] {
  const { descriptor } = parse(readFileSync(join(SRC, file), "utf8"), {
    filename: file,
  });
  return descriptor.styles
    .filter((style) => style.scoped)
    .flatMap((style) => {
      const result = compileStyle({
        source: style.content,
        filename: file,
        id: SCOPE,
        scoped: true,
      });
      expect(result.errors, file).toEqual([]);
      return selectors(result.code);
    })
    .filter(
      (selector) =>
        !selector.includes(`[${SCOPE}`) || /:global\(/.test(selector),
    )
    .map((selector) => `${file}: ${selector}`);
}

describe("scoped style audit", () => {
  it("finds the scoped style blocks (sanity check)", () => {
    const scoped = vueFiles().filter((file) =>
      /<style[^>]*\bscoped\b/.test(readFileSync(join(SRC, file), "utf8")),
    );
    expect(scoped.length).toBeGreaterThan(10);
    expect(
      selectors(".a, .b:is(.c, .d) { x: 1 } @keyframes k { 0% { y: 1 } }"),
    ).toEqual([".a", ".b:is(.c, .d)"]);
  });

  it("keeps every scoped selector scoped to its component", () => {
    expect(vueFiles().flatMap(unscopedSelectors)).toEqual([]);
  });
});
