import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Structural invariants for block chrome + canvas dark-mode preview.
 *
 * These rules govern how email content and editor chrome are separated so
 * the canvas dark-preview filter inverts the email visual without trapping
 * chrome (action bar, indicators) in a filtered stacking context. Each
 * invariant has a known regression path that does NOT show up in unit
 * tests — touching the wrong CSS selector or moving padding/bg between
 * `.tpl-block` and `.tpl-block-content` silently breaks dark-preview text
 * legibility, the action bar's theme, or the editor's shadow-DOM popover.
 *
 * If you intentionally change one of these, update the assertion in the
 * same PR — that paper trail is the point.
 */

const SRC = join(import.meta.dirname, "..", "src");

function read(relPath: string): string {
  return readFileSync(join(SRC, relPath), "utf8");
}

describe("block chrome structure", () => {
  const blockWrapper = read("components/blocks/BlockWrapper.vue");
  const canvas = read("components/Canvas.vue");
  const styles = read("styles/index.css");

  it("BlockWrapper wraps the slot in `.tpl-block-content`", () => {
    // The `.tpl-block-content` wrapper is the canvas-dark-preview filter
    // target. If the slot is rendered directly (without wrapper), dark
    // preview stops inverting block content + section bg.
    expect(blockWrapper).toMatch(
      /<div\s+class="tpl-block-content"[^>]*>\s*<slot\s*\/>\s*<\/div>/,
    );
  });

  it("padding + backgroundColor live on `.tpl-block-content`, not `.tpl-block`", () => {
    // Block bg has to sit INSIDE the filter region — moving it back onto
    // `.tpl-block` makes the dark-preview filter invert text-only, leaving
    // inverted (white) text on an un-inverted (white) section bg = invisible.
    expect(blockWrapper).toMatch(
      /contentStyle\s*=\s*computed\(\(\)\s*=>\s*\{[\s\S]*padding[\s\S]*backgroundColor/,
    );
    expect(blockWrapper).toMatch(
      /wrapperStyle\s*=\s*computed\(\(\)\s*=>\s*\(\{\s*margin:/,
    );
  });

  it("Canvas renders `.tpl-canvas-bg` sibling with conditional invert filter", () => {
    // The bg layer carries the email backgroundColor + dark-preview filter.
    // Filter lives on this leaf div (no descendants) so it never creates a
    // containing block that would trap block chrome inside the wrapper.
    expect(canvas).toMatch(/class="tpl-canvas-bg/);
    expect(canvas).toMatch(
      /darkMode\s*\?\s*\{\s*filter:\s*'invert\(1\)\s+hue-rotate\(180deg\)'/,
    );
  });

  it("Canvas does NOT apply `filter` directly on `.tpl-canvas-wrapper`", () => {
    // Filter on canvas-wrapper traps fixed-positioned chrome (action bar)
    // inside a stacking context that the right sidebar's z-40 wins against,
    // AND forces a counter-filter on chrome that flickers on toggle.
    // The bg layer was introduced specifically to take this off the wrapper.
    const wrapperStyleBlock =
      canvas.match(/class="tpl-canvas-wrapper[\s\S]*?\}\s*"/)?.[0] ?? "";
    expect(wrapperStyleBlock).not.toMatch(/filter:/);
  });

  it("dark-preview filter targets only top-level `.tpl-block-content` (no nesting compound)", () => {
    // `.tpl-block-content` nests inside section blocks. Applying filter to
    // every level compounds (invert ∘ invert = identity) and leaves nested
    // blocks looking un-inverted. The `:not(...)` excludes nested wrappers.
    expect(canvas).toMatch(
      /\.tpl-canvas--dark-mode\s+:deep\(\.tpl-block-content:not\(\.tpl-block-content\s+\*\)\)/,
    );
  });

  it("light-theme variable override is scoped to `.tpl-block-content`, not `.tpl-canvas-wrapper`", () => {
    // Email content needs light-theme vars (designed for white bg), but
    // chrome (action bar, indicators) lives OUTSIDE `.tpl-block-content`
    // and must follow the editor's UI theme. Putting the override back on
    // `.tpl-canvas-wrapper` forces chrome to read as light even in dark UI.
    expect(styles).toMatch(
      /\.tpl\[data-tpl-theme="dark"\]\s+\.tpl-block-content\s*\{/,
    );
    expect(styles).not.toMatch(
      /\.tpl\[data-tpl-theme="dark"\]\s+\.tpl-canvas-wrapper\s*\{[^}]*--tpl-bg-elevated/,
    );
  });

  it("`.tpl-popover-root` uses a LITERAL z-index (not `var(--z-modal)`)", () => {
    // `@theme inline` emits `--z-modal` on `:root`, which is unreachable
    // from inside a shadow root. Reverting to `var(--z-modal)` drops the
    // popover-root's stacking context in shadow-DOM mode and the tiptap
    // text toolbar disappears behind the right sidebar.
    const popoverBlock =
      styles.match(/\.tpl-popover-root\s*\{[^}]*\}/)?.[0] ?? "";
    expect(popoverBlock).toMatch(/z-index:\s*10000\s*;/);
    expect(popoverBlock).not.toMatch(/z-index:\s*var\(--z-modal\)/);
  });
});
