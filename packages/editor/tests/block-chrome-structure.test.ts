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

  it("`.sortable-fallback` ghost has `transition: none` to track cursor 1:1", () => {
    // Sortable's force-fallback ghost is a clone of the drag source. The
    // sidebar palette buttons carry Tailwind's `transition-all
    // duration-120ms` so the cloned ghost inherits it — every
    // pointermove-driven `transform` update animates over 120ms instead
    // of jumping, and the ghost visibly lags behind a moving cursor.
    // The `.sortable-fallback` class is Sortable's default
    // `fallbackClass` applied to the ghost; this rule forces `transition`
    // and `animation` off so the ghost tracks 1:1.
    expect(styles).toMatch(
      /\.sortable-fallback\s*\{[^}]*transition:\s*none\s*!important/,
    );
    expect(styles).toMatch(
      /\.sortable-fallback\s*\{[^}]*animation:\s*none\s*!important/,
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

describe("section drag + cycle defenses", () => {
  const sectionBlock = readFileSync(
    join(SRC, "components/blocks/SectionBlock.vue"),
    "utf8",
  );
  const canvas = readFileSync(join(SRC, "components/Canvas.vue"), "utf8");
  const sidebar = readFileSync(join(SRC, "components/Sidebar.vue"), "utf8");
  const blockWrapper = readFileSync(
    join(SRC, "components/blocks/BlockWrapper.vue"),
    "utf8",
  );

  it("all three Sortables use force-fallback", () => {
    // ALL THREE Sortables (sidebar, canvas, section column) MUST use
    // `:force-fallback="true"`. Two reasons compose:
    //   1. Chrome's HTML5 native-drag mode silently fails to initiate
    //      drag from a child block's grip inside a SECTION column
    //      (nested Sortable case). Sortable's `_prepareDragStart` runs
    //      and sets `dragEl.draggable = true`, but Chrome refuses to
    //      fire `dragstart`. Firefox fires it fine — presents as
    //      "works in FF, not Chrome". Removing every `draggable="false"`
    //      ancestor doesn't help; Chrome's refusal is independent and
    //      isolated to deeply nested HTML5-mode Sortable scenarios.
    //      Fallback mode bypasses native drag entirely.
    //   2. Sortable.js binds `dragover`/`dragenter` listeners on its
    //      `el` ONLY when `nativeDraggable=true` (HTML5 mode). Mixing
    //      modes (e.g. HTML5 sidebar + fallback canvas) breaks
    //      cross-list DROPS: the fallback target never receives drag-
    //      over events from the HTML5 source. The "Drop here"
    //      insertion indicator never appears and the block never lands.
    //      Putting ALL Sortables in fallback mode means they coordinate
    //      drag-over via Sortable's own pointer-event polling
    //      (`_emulateDragOver`), which works cross-instance regardless
    //      of which one is the source.
    //
    // Known visual quirk: in shadow-DOM mode the fallback ghost (a
    // cloned DOM element positioned via inline transforms) can appear
    // visually offset from the cursor for the SIDEBAR source. The drop
    // indicator and actual drop ARE registered correctly on the
    // target — the misalignment is cosmetic on the source side.
    // Trade-off accepted: functional cross-list drops beat perfect
    // ghost tracking. Switching the sidebar back to HTML5 fixes the
    // ghost but kills the drop coordination.
    //
    // Playwright trade-off: `dragTo` emits HTML5 drag events only and
    // cannot drive a fallback-mode Sortable. E2E tests that depend on
    // dragTo for drops are `test.fixme()`'d with a Playwright/Sortable
    // interop note.
    expect(canvas).toMatch(/:force-fallback="true"/);
    expect(sidebar).toMatch(/:force-fallback="true"/);
    expect(sectionBlock).toMatch(/:force-fallback="true"/);

    // Both canvas + section Sortables retain `handle=".tpl-block-btn"`.
    // In fallback mode the handle still gates drag initiation; without
    // it, accidental pointer-drags from non-grip clicks (text, images)
    // would also start a Sortable drag.
    expect(sectionBlock).toMatch(
      /<VueDraggable[\s\S]*?handle="\.tpl-block-btn"[\s\S]*?<\/VueDraggable>/,
    );
    expect(canvas).toMatch(
      /<VueDraggable[\s\S]*?handle="\.tpl-block-btn"[\s\S]*?<\/VueDraggable>/,
    );

    // Canvas restricts sortable items to `.tpl-block-item` so the
    // empty-state placeholder rendered inside the VueDraggable isn't
    // treated as a drag item. SectionBlock doesn't need this — its
    // VueDraggable has only sortable children.
    expect(canvas).toMatch(/:draggable="'\.tpl-block-item'"/);
    expect(canvas).toMatch(/v-for=[\s\S]*?class="tpl-block-item"/);

    // No `draggable="false"` anywhere on BlockWrapper. With fallback
    // mode in use this attribute has no effect on Sortable drag
    // initiation, but historically it was the cause of multiple drag
    // regressions in Chrome. Keep it absent so future maintainers don't
    // reintroduce it on the assumption that it gates anything.
    expect(blockWrapper).not.toMatch(/draggable="false"/);
  });

  it("`setColumnBlocks` deep-clones each block before writing to state", () => {
    // vue-draggable-plus's emit can carry a back-reference (e.g. a Sortable
    // expando on a DOM element) that ends up reachable from state.content.
    // The deep clone here strips any non-Block fields before the array
    // lands in editor state, preventing later `history.cloneContent` /
    // JSON.stringify calls from hitting a cycle. Pair with the
    // cycle-safe `cloneContent` in @templatical/core/history.ts.
    expect(sectionBlock).toMatch(
      /function setColumnBlocks[\s\S]*?JSON\.parse\(JSON\.stringify\(b\)\)[\s\S]*?editor\.updateBlock/,
    );
  });

});
