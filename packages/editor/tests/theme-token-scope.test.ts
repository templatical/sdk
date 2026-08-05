import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Every element carrying the bare `tpl` class must also re-apply `themeStyles`.
 *
 * The base `.tpl` rule in `styles/index.css` declares the full `--tpl-*` token
 * set as `var(--tpl-user-<name>, <default>)`. The `theme` config option, by
 * contrast, is applied as INLINE styles on the editor's root element. Inline
 * specificity beats a class selector on the same element — but a custom
 * property declared on a descendant beats one inherited from an ancestor
 * regardless of specificity. So any nested element that re-matches `.tpl`
 * resets every token to its stock default for its whole subtree, silently
 * dropping the consumer's `theme`.
 *
 * That is issue #487: `TplModal`'s backdrop carries `tpl`, so the saved-blocks
 * browser, the save-block dialog and the test-email dialog all rendered in
 * default colours inside an otherwise themed editor. Two sibling modals
 * (`MergeTagPickerModal`, `LogicTagPickerModal`) had already hit it and each
 * patched itself locally, which is exactly why the next three surfaces
 * reintroduced it — the knowledge lived in two files instead of a rule.
 *
 * The rule this guard enforces:
 *
 *   class="tpl …"  ⇒  the same element binds `:style` with `themeStyles`
 *
 * Two ways to satisfy it when adding UI:
 *
 *   1. Don't add the bare `tpl` class. `tpl:`-prefixed Tailwind utilities and
 *      `tpl-*` component classes are unaffected — only the bare token re-opens
 *      the declaration block. Anything rendered under the editor root (that
 *      includes teleports into `.tpl-popover-root`) inherits the tokens.
 *   2. If the element genuinely needs to re-establish the token block — a
 *      teleport target that can escape the root, or an overlay that must
 *      resolve tokens standalone — inject `THEME_STYLES_KEY` and bind it, as
 *      `TplModal` does.
 *
 * Note this guard only inspects the element that carries the class. Children
 * are covered transitively: they inherit from the nearest declaring ancestor,
 * which this rule keeps correct.
 *
 * Behavioural coverage lives in `tests/tplModal.test.ts` (the binding reaches
 * the backdrop) and `apps/playground/e2e/tests/modal-theming.spec.ts` (the
 * computed colour inside a real dialog matches the configured theme).
 */

const SRC = join(import.meta.dirname, "..", "src");

function listVueFiles(): string[] {
  const entries = readdirSync(SRC, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".vue"))
    .map((entry) =>
      relative(SRC, join(entry.parentPath ?? SRC, entry.name))
        .split(sep)
        .join("/"),
    )
    .sort();
}

/**
 * The full opening tag containing the attribute at `index`.
 *
 * Scans forward from the tag's `<` with a quote-aware cursor rather than
 * regexing to the next `>`, because attribute values legitimately contain one
 * (`v-if="count > 0"`, `:class="{ … }"` with comparisons, arrow functions).
 */
function openingTagAt(source: string, index: number): string {
  const start = source.lastIndexOf("<", index);
  let quote: string | null = null;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return source.slice(start, i + 1);
    }
  }
  return source.slice(start);
}

/** `tpl` as its own class token — not `tpl:flex`, not `tpl-block`. */
const BARE_TPL = /(?:^|\s)tpl(?:$|\s)/;

interface TokenRootSite {
  file: string;
  tag: string;
  appliesThemeStyles: boolean;
}

function findTokenRootSites(): TokenRootSite[] {
  const sites: TokenRootSite[] = [];

  for (const file of listVueFiles()) {
    const source = readFileSync(join(SRC, file), "utf8");

    // Static `class="…"` attributes.
    for (const match of source.matchAll(/\bclass="([^"]*)"/g)) {
      if (!BARE_TPL.test(match[1])) continue;
      const tag = openingTagAt(source, match.index);
      sites.push({
        file,
        tag,
        appliesThemeStyles: /:style="[^"]*themeStyles/.test(tag),
      });
    }

    // Dynamic `:class` bindings that add the bare token as a string literal —
    // `:class="['tpl', …]"`, `:class="{ tpl: … }"`. Same effect, so the guard
    // can't be sidestepped by moving the class into a binding.
    for (const match of source.matchAll(/\b:class="([^"]*)"/g)) {
      if (!/(['"])tpl\1|\{\s*tpl\s*:/.test(match[1])) continue;
      const tag = openingTagAt(source, match.index);
      sites.push({
        file,
        tag,
        appliesThemeStyles: /:style="[^"]*themeStyles/.test(tag),
      });
    }
  }

  return sites;
}

const SITES = findTokenRootSites();

describe("theme token scope", () => {
  it("finds the known token-root elements (sanity check)", () => {
    // Guards against the scanner silently returning [] — a broken walker or a
    // regex that stopped matching would otherwise make every case below pass.
    // The two editor roots plus the shared modal backdrop are the floor.
    const files = new Set(SITES.map((site) => site.file));
    expect(files.has("Editor.vue")).toBe(true);
    expect(files.has("cloud/CloudEditor.vue")).toBe(true);
    expect(files.has("components/TplModal.vue")).toBe(true);
    expect(SITES.length).toBeGreaterThanOrEqual(6);
  });

  it("every element carrying the bare `tpl` class re-applies themeStyles", () => {
    const offenders = SITES.filter((site) => !site.appliesThemeStyles).map(
      (site) => site.file,
    );
    expect(offenders).toEqual([]);
  });

  it("the shared modal backdrop is one of them (issue #487)", () => {
    // Called out by name because it is the one that covers every dialog
    // teleported through it — losing this binding silently unthemes all of
    // them at once, which is how the bug shipped.
    const backdrop = SITES.filter(
      (site) => site.file === "components/TplModal.vue",
    );
    expect(backdrop).toHaveLength(1);
    expect(backdrop[0].appliesThemeStyles).toBe(true);
  });
});
