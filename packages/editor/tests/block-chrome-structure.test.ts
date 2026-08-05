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

  it("padding + backgroundColor live on `.tpl-block-content`; `.tpl-block` carries no inline spacing", () => {
    // Block bg has to sit INSIDE the filter region — moving it back onto
    // `.tpl-block` makes the dark-preview filter invert text-only, leaving
    // inverted (white) text on an un-inverted (white) section bg = invisible.
    expect(blockWrapper).toMatch(
      /contentStyle\s*=\s*computed\(\(\)\s*=>\s*\{[\s\S]*padding[\s\S]*backgroundColor/,
    );
    // `.tpl-block` carries no inline style; spacing lives only on the content
    // layer. Guards against reintroducing a wrapper-level spacing style.
    expect(blockWrapper).not.toMatch(/wrapperStyle/);
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
    //
    // Regression: dropping !important from either declaration lets the
    // inherited `transition-property: all; transition-duration: 120ms`
    // from `.tpl\\:transition-all` win, and the ghost lags behind the
    // cursor by ~120ms (visible as a noticeable trail when dragging
    // fast). The `animation: none` covers a parallel case where the
    // source has a keyframe animation (e.g. `tpl-fade-in`) that would
    // also play on the cloned ghost.
    expect(styles).toMatch(
      /\.sortable-fallback\s*\{[^}]*transition:\s*none\s*!important/,
    );
    expect(styles).toMatch(
      /\.sortable-fallback\s*\{[^}]*animation:\s*none\s*!important/,
    );
  });

  it("no `.tpl-sidebar-rail .tpl-ghost` override exists (regression: #268 palette block vanished during drag)", () => {
    // The sidebar palette Sortable no longer sets `ghost-class="tpl-ghost"`
    // (see Sidebar.vue), so its `dragEl` keeps Sortable's default unstyled
    // `sortable-ghost` and stays visible in the palette during drag.
    //
    // The old code applied `tpl-ghost` to the palette `dragEl` and then hid
    // it with `.tpl-sidebar-rail .tpl-ghost { visibility: hidden }`, which
    // made the source palette button disappear mid-drag (#268).
    // Reintroducing ANY `.tpl-sidebar-rail .tpl-ghost` rule re-couples the
    // palette to that styling, so guard against it.
    expect(styles).not.toMatch(/\.tpl-sidebar-rail\s+\.tpl-ghost/);
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
  const saveDialog = readFileSync(
    join(SRC, "components/SaveBlockDialog.vue"),
    "utf8",
  );

  it("all four Sortables use force-fallback", () => {
    // ALL FOUR Sortables (sidebar, canvas, section column, and the save
    // dialog's reorder list) MUST use `:force-fallback="true"`. Two reasons
    // compose:
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
    expect(saveDialog).toMatch(/:force-fallback="true"/);

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

  it("section's `put` predicate rejects nested section blocks (palette + canvas)", () => {
    // Section blocks must never accept another section as a child — a
    // nested section would create a column-inside-column layout that
    // MJML rejects (`mj-section` inside `mj-column`), so the renderer
    // silently drops it on export (#292), and it's a hazard for the
    // history cycle defender. The `put` callback delegates to
    // `canDropInSectionColumn`, which rejects a section dragged from
    // EITHER the canvas (`data-block-type`) or the sidebar palette
    // (`data-palette-type`). The palette case is the hole that shipped
    // #292; behavioral coverage lives in tests/sectionColumnDrop.test.ts.
    // Don't change this without updating the renderer + history defenses.
    expect(sectionBlock).toMatch(
      /import\s*\{\s*canDropInSectionColumn\s*\}\s*from\s*["']\.\.\/\.\.\/utils\/sectionColumnDrop["']/,
    );
    expect(sectionBlock).toMatch(
      /put:\s*\([^)]*\)\s*=>\s*\n?\s*canDropInSectionColumn\(el\)/,
    );
  });

  it('canvas + section Sortables wire `ghost-class="tpl-ghost"`; the source-only palette does NOT', () => {
    // Canvas + section-column Sortables share the `tpl-ghost`
    // drop-insertion indicator (`.tpl-ghost` dotted line + ::before
    // "Drop here" badge in `styles/index.css`). Diverging the class name
    // BETWEEN canvas and section would break their shared indicator, so
    // both must keep `tpl-ghost`.
    //
    // The sidebar palette is drag-source-only (`put: false`) and MUST NOT
    // wire `ghost-class="tpl-ghost"`. At drag start Sortable applies the
    // source ghostClass to `dragEl` — which, in the palette, IS the
    // palette button itself — and the old `.tpl-sidebar-rail .tpl-ghost
    // { visibility: hidden }` rule then hid that button mid-drag (#268).
    // Leaving the palette on Sortable's default unstyled `sortable-ghost`
    // keeps the button visible while dragging. The cross-list "Drop here"
    // indicator is unaffected: Sortable's `_onDragOver` swaps in the
    // TARGET list's ghostClass when `dragEl` is dragged over the
    // canvas/section, so that indicator comes from their class, not the
    // sidebar's.
    expect(canvas).toMatch(/ghost-class="tpl-ghost"/);
    expect(sectionBlock).toMatch(/ghost-class="tpl-ghost"/);
    expect(sidebar).not.toMatch(/ghost-class=/);
  });

  it("the save dialog's reorder list declares no `group`", () => {
    // The canvas and section-column Sortables share `group="blocks"`, which is
    // what lets a block move between them. The dialog's list reorders a
    // throwaway array of already-picked blocks and must never exchange items
    // with a live canvas list — a drop from the canvas into it would insert a
    // block the pick session never chose, and a drop out of it would put a
    // block on the canvas from inside a modal. Omitting `group` leaves Sortable
    // on a private auto-generated one, which cannot pair with any other list.
    const dialogSortable = saveDialog.match(
      /<VueDraggable[\s\S]*?>/,
    )?.[0] as string;
    expect(dialogSortable).toBeTypeOf("string");
    expect(dialogSortable).not.toMatch(/\bgroup=/);
  });

  it("the save dialog's reorder list drags only from its grip handle", () => {
    // Without a handle the whole row is a drag target, and the row is mostly a
    // live block preview — pointer-drags meant as clicks on the preview would
    // start reordering. The handle class must match the button that renders it.
    expect(saveDialog).toMatch(/handle="\.tpl-saved-block-reorder-handle"/);
    expect(
      readFileSync(join(SRC, "components/SavedBlockPreviewRow.vue"), "utf8"),
    ).toMatch(/class="tpl-saved-block-reorder-handle/);
  });
});

describe("saved blocks: picked state cannot be hidden by a block's own fill", () => {
  const blockWrapper = read("components/blocks/BlockWrapper.vue");

  /* Regression: the picked state was a background tint on `.tpl-block`. But each
     block paints its own background on the INNER `.tpl-block-content`
     (`getBlockWrapperStyle` → `backgroundColor || "transparent"`), which covers
     the parent. Blocks with a colour set showed no tint; transparent ones showed
     it — so picking looked different block to block within one template.

     `outline` and a non-inset `box-shadow` draw on `.tpl-block`'s border box,
     outside the content's paint area, so they're immune to the block's own fill.
     Anything conveying picked-ness must use those, never a fill. */
  function pickedRule(): string {
    const m = blockWrapper.match(/\.tpl-block--picked\s*\{([^}]*)\}/);
    expect(m).not.toBe(null);
    return m![1];
  }

  it("does NOT convey picked via background-color", () => {
    expect(pickedRule()).not.toMatch(/background(-color)?\s*:/);
  });

  it("conveys picked via outline + a non-inset box-shadow ring", () => {
    const rule = pickedRule();
    expect(rule).toMatch(/outline:\s*2px solid/);
    expect(rule).toContain("box-shadow:");
    // `inset` would paint inside the border box and be covered like a fill.
    expect(rule).not.toContain("inset");
  });

  it("stays distinguishable from idle by line style, not colour alone", () => {
    const idle = blockWrapper.match(/\.tpl-block--idle\s*\{([^}]*)\}/);
    expect(idle).not.toBe(null);
    // idle is dashed, picked is solid — a non-colour differentiator, so the
    // state survives without colour perception.
    expect(idle![1]).toMatch(/outline:\s*[\d.]+px dashed/);
    expect(pickedRule()).toMatch(/outline:\s*[\d.]+px solid/);
  });
});

describe("saved blocks: pick session stays lazily loaded", () => {
  const panels = read("components/SavedBlocksPanels.vue");
  const ossEditor = read("Editor.vue");
  const cloudEditor = read("cloud/CloudEditor.vue");

  /* Cost has to track usage: a consumer with no `SavedBlocksProvider` must
     download none of this. Both editors lazy-load `SavedBlocksPanels` behind a
     `v-if` on availability, and every piece of saved-blocks UI hangs off that
     wrapper — including the pick bar. Importing the bar directly from an editor
     would pull it into the main entry for everyone. */
  it("the pick bar is lazily imported by SavedBlocksPanels", () => {
    expect(panels).toMatch(
      /defineAsyncComponent\(\s*\(\) => import\("\.\/SavedBlocksPickBar\.vue"\)/,
    );
  });

  it("neither editor references the pick bar directly", () => {
    expect(ossEditor).not.toContain("SavedBlocksPickBar");
    expect(cloudEditor).not.toContain("SavedBlocksPickBar");
  });

  it("every saved-blocks surface is async and gated on its own state", () => {
    for (const name of [
      "SavedBlocksPickBar",
      "SaveBlockDialog",
      "SavedBlocksBrowserModal",
    ]) {
      expect(panels).toContain(`import("./${name}.vue")`);
    }
    // Rendered only while a session runs / a dialog is open, so the chunk fetch
    // is deferred to first actual use rather than to mount.
    expect(panels).toContain('v-if="feature.isPicking.value"');
    expect(panels).toContain('v-if="feature.isSaveDialogOpen.value"');
    expect(panels).toContain('v-if="feature.isBrowserOpen.value"');
  });

  /* The save dialog's preview rows pull in the block preview components, which
     is the heaviest thing saved blocks touch. They're allowed to ride along in
     the dialog's own async chunk, but nothing outside it may reference them —
     a static import from either editor would hoist the whole preview tree into
     the main entry for consumers who never configure a provider. */
  it("preview rows are reachable only through the async save dialog", () => {
    const saveDialog = read("components/SaveBlockDialog.vue");
    expect(saveDialog).toContain('from "./SavedBlockPreviewRow.vue"');

    for (const src of [ossEditor, cloudEditor, panels]) {
      expect(src).not.toContain("SavedBlockPreviewRow");
      expect(src).not.toContain("BlockPreviewCanvas");
    }
  });
});

describe("chrome tokens survive the email-content override", () => {
  const styles = read("styles/index.css");
  const blockWrapper = read("components/blocks/BlockWrapper.vue");
  const sectionBlock = read("components/blocks/SectionBlock.vue");

  /* `.tpl[data-tpl-theme="dark"] .tpl-block-content` re-declares these tokens so
     email content renders light. A section's children render INSIDE that
     wrapper, so chrome referencing the raw token inherits the light value and
     stops matching the dark editor UI (the near-white nested action bar). The
     `--tpl-chrome-*` aliases are declared on `.tpl`, where substitution happens,
     so a descendant redefinition cannot reach them. */
  const SHADOWED = [
    "bg-elevated",
    "border-light",
    "text-muted",
    "text-dim",
    "primary-light",
    "primary-hover",
  ];

  /** The real rule body — `indexOf` would match the selector inside a comment. */
  function overrideBody(): string {
    const m = styles.match(
      /^\.tpl\[data-tpl-theme="dark"\]\s+\.tpl-block-content\s*\{([^}]*)\}/m,
    );
    expect(m).not.toBe(null);
    return m![1];
  }

  it("declares a chrome alias for every token the content override shadows", () => {
    const override = overrideBody();

    for (const name of [...SHADOWED, "text"]) {
      // Each token the override shadows...
      expect(override).toContain(`--tpl-${name}:`);
      // ...has a chrome alias pointing back at the un-shadowed source.
      expect(styles).toContain(`--tpl-chrome-${name}: var(--tpl-${name});`);
    }
  });

  it("declares the chrome aliases OUTSIDE the override (or they'd be shadowed too)", () => {
    // The whole mechanism depends on the aliases being substituted at `.tpl`.
    // Declaring one inside the override would defeat it.
    expect(overrideBody()).not.toContain("--tpl-chrome-");
    expect(styles).toContain("--tpl-chrome-bg-elevated: var(--tpl-bg-elevated);");
  });

  it("block chrome never references a shadowed token directly", () => {
    // Every reference to these tokens inside BlockWrapper/SectionBlock is
    // chrome — email content is styled from block data via inline styles — so
    // any raw usage here is the regression.
    for (const src of [blockWrapper, sectionBlock]) {
      for (const name of [...SHADOWED, "text"]) {
        expect(src).not.toContain(`var(--tpl-${name})`);
      }
    }
  });

  it("the action bar and nested placeholders use chrome tokens", () => {
    expect(blockWrapper).toContain("var(--tpl-chrome-bg-elevated)");
    expect(blockWrapper).toContain("var(--tpl-chrome-text-muted)");
    expect(sectionBlock).toContain("var(--tpl-chrome-text-dim)");
  });
});

describe("saved blocks: section children are not savable", () => {
  const blockWrapper = read("components/blocks/BlockWrapper.vue");
  const sectionBlock = read("components/blocks/SectionBlock.vue");

  // Regression: the bookmark rendered on section children too, but the save
  // dialog only lists top-level blocks — so the pre-selected id matched
  // nothing, Save still enabled, and it persisted an EMPTY saved block.
  // Insertion is top-level-only, so a nested block could never round-trip
  // back into its column anyway; save the whole section instead.
  it("SectionBlock marks its column children as `nested`", () => {
    const childWrapper = sectionBlock.slice(
      sectionBlock.indexOf("<BlockWrapper"),
      sectionBlock.indexOf(">", sectionBlock.indexOf("<BlockWrapper")),
    );
    expect(childWrapper).toContain(':block="childBlock"');
    expect(childWrapper).toMatch(/\bnested\b/);
  });

  it("BlockWrapper gates the save action on NOT being nested", () => {
    expect(blockWrapper).toContain("nested?: boolean");
    // The gate must include the nested check, not just capability presence.
    expect(blockWrapper).toMatch(
      /canSaveAsBlock = computed\(\s*\(\) =>\s*!props\.nested &&/,
    );
  });

  it("Canvas does NOT mark top-level blocks as nested", () => {
    const canvasSrc = read("components/Canvas.vue");
    const topWrapper = canvasSrc.slice(
      canvasSrc.indexOf("<BlockWrapper"),
      canvasSrc.indexOf(">", canvasSrc.indexOf("<BlockWrapper")),
    );
    expect(topWrapper).toContain(':block="block"');
    expect(topWrapper).not.toMatch(/\bnested\b/);
  });
});

describe("sidebar drag-during-collapse rect-capture defense", () => {
  const sidebar = readFileSync(join(SRC, "components/Sidebar.vue"), "utf8");

  it("declares an `isDragging` ref to guard mid-drag layout shifts", () => {
    // The auto-hide rail collapses 200px → 48px on `mouseleave`. Without
    // a guard, the cursor leaving the sidebar (toward the canvas) flips
    // `isExpanded` and the rail's width transition starts BEFORE
    // Sortable's `_appendGhost` reads `dragEl.getBoundingClientRect()`.
    // The captured rect is mid-transition → ghost initially stamped at
    // wrong width/position, visibly offset from the cursor. The
    // `isDragging` ref locks `isExpanded` while a drag is in flight.
    expect(sidebar).toMatch(/const\s+isDragging\s*=\s*ref\(false\)/);
  });

  it("`handleSidebarLeave` early-returns when `isDragging.value` is true", () => {
    // The `@mouseleave` is wired to `handleSidebarLeave` (not directly
    // to `isExpanded = false`) so the guard takes effect. Reverting to
    // `@mouseleave="isExpanded = false"` re-opens the rect-capture race.
    expect(sidebar).toMatch(
      /function\s+handleSidebarLeave\s*\([^)]*\)[^{]*\{\s*[^}]*if\s*\(\s*isDragging\.value\s*\)\s*return/,
    );
    expect(sidebar).toMatch(/@mouseleave="handleSidebarLeave"/);
  });

  it("VueDraggable wires `@choose` (NOT `@start`) to flip the drag guard", () => {
    // `choose` fires synchronously inside Sortable's `_onTapStart` on
    // pointerdown. `start` fires only after the threshold-move
    // dispatches `_dragStarted` — by which time the cursor has likely
    // already left the sidebar and `mouseleave` has fired. Hooking
    // `@start` re-opens the collapse race we're trying to close.
    // Don't swap to `@start`.
    expect(sidebar).toMatch(/@choose="handleDragChoose"/);
    expect(sidebar).toMatch(
      /function\s+handleDragChoose\s*\([^)]*\)[^{]*\{[^}]*isDragging\.value\s*=\s*true/,
    );
  });

  it("VueDraggable wires `@end` to clear `isDragging`", () => {
    // Without `@end`, `isDragging` would latch true after the first
    // drag and the sidebar would never collapse again. `end` fires
    // regardless of drop success or cancellation.
    expect(sidebar).toMatch(/@end="handleDragEnd"/);
    expect(sidebar).toMatch(
      /function\s+handleDragEnd\s*\([^)]*\)[^{]*\{[^}]*isDragging\.value\s*=\s*false/,
    );
  });
});

describe("preview-mode visibility gate", () => {
  const blockWrapper = readFileSync(
    join(SRC, "components/blocks/BlockWrapper.vue"),
    "utf8",
  );
  const sectionBlock = readFileSync(
    join(SRC, "components/blocks/SectionBlock.vue"),
    "utf8",
  );

  it("BlockWrapper gates its root on `isHiddenInPreview` (only previewMode hides)", () => {
    // The block must disappear in preview mode when hidden on the current
    // viewport (parity with exported MJML), but stay rendered + dimmed in
    // edit mode so it remains selectable. Behavior is covered by
    // blockWrapperVisibility.test.ts; this locks the wiring so the v-if
    // can't be dropped or rebound to `isHiddenOnViewport` (which would
    // also hide it mid-edit).
    expect(blockWrapper).toMatch(
      /const\s+isHiddenInPreview\s*=\s*computed\([\s\S]*?previewMode[\s\S]*?isHiddenOnViewport/,
    );
    expect(blockWrapper).toMatch(/v-if="!isHiddenInPreview"/);
  });

  it("SectionBlock forwards previewMode to child BlockWrappers", () => {
    // Section children only receive previewMode through this binding —
    // SectionBlock reads it off the injected editor state. Drop it and
    // nested blocks hidden on a viewport would still show in preview.
    expect(sectionBlock).toMatch(/:preview-mode="editor\.state\.previewMode"/);
  });
});

describe("a resolver owns the display-condition filter", () => {
  /**
   * The hand-toggled condition filter must step aside while a configured
   * `resolvePreview` owns the preview: the resolver evaluated each condition
   * against real data, so a manual hide layered on top vetoes the answer that
   * was asked for — and leaves the restore button asserting blocks are hidden
   * when the preview shows them.
   *
   * The rule lives in `useEditorCore` and is *injected* everywhere else. That
   * is the invariant with teeth: a component that re-derived it from
   * `previewMode` + `isConfigured` locally is exactly how the two halves drift
   * apart, which is the lesson already learned with `USE_MERGE_TAG_SAMPLES_KEY`.
   */
  const core = read("composables/useEditorCore.ts");
  const canvas = read("components/Canvas.vue");
  const sectionBlock = read("components/blocks/SectionBlock.vue");
  const editor = read("Editor.vue");
  const cloudEditor = read("cloud/CloudEditor.vue");
  const previewCanvas = read("components/BlockPreviewCanvas.vue");
  const testEmailModal = read("components/TestEmailModal.vue");

  it("useEditorCore owns the rule and folds in both halves", () => {
    expect(core).toMatch(
      /const\s+appliesConditionFilter\s*=\s*computed\([\s\S]{0,200}?previewMode[\s\S]{0,120}?previewResolution\.isConfigured/,
    );
    expect(core).toMatch(
      /provide\(APPLIES_CONDITION_FILTER_KEY,\s*appliesConditionFilter\)/,
    );
  });

  it("suppresses rather than resetting, so leaving the preview restores the simulation", () => {
    // `reset()` would discard the user's hand-hides on a mere view toggle, and
    // would discard them even when the resolve then fails and the *unresolved*
    // template is what renders. Nothing may clear the set on preview enter.
    expect(core).not.toMatch(/previewMode[\s\S]{0,200}?conditionPreview\.reset/);
  });

  it("Canvas and SectionBlock inject the rule instead of re-deriving it", () => {
    for (const [label, src] of [
      ["Canvas", canvas],
      ["SectionBlock", sectionBlock],
    ] as const) {
      expect(src, label).toMatch(
        /inject\(APPLIES_CONDITION_FILTER_KEY,\s*null\)/,
      );
      // No local copy of the rule.
      expect(src, label).not.toMatch(
        /appliesConditionFilter\s*=\s*computed\(/,
      );
      expect(src, label).toMatch(
        /appliesConditionFilter === false \|\|\s*!conditionPreview\?\.isHidden/,
      );
    }
  });

  it("both editors gate the restore button on the same rule", () => {
    // Otherwise the button outlives the filter it controls — the reported bug.
    for (const [label, src] of [
      ["Editor", editor],
      ["CloudEditor", cloudEditor],
    ] as const) {
      expect(src, label).toMatch(
        /hasHiddenBlocks\.value &&\s*core\.appliesConditionFilter\.value/,
      );
    }
  });

  it("the test-email preview takes the rule as a prop, not an injection", () => {
    // That dialog builds its own resolution instance keyed to the selected
    // recipient, so injecting the shared canvas instance would consult the
    // wrong one.
    expect(previewCanvas).toMatch(/applyConditionFilter\?:\s*boolean/);
    expect(previewCanvas).toMatch(/applyConditionFilter:\s*true/);
    expect(previewCanvas).not.toMatch(/APPLIES_CONDITION_FILTER_KEY/);
    expect(testEmailModal).toMatch(
      /:apply-condition-filter="!previewResolution\.isConfigured"/,
    );
  });
});

describe("countdown resolves only through the block registry", () => {
  /**
   * `countdown` is the one Cloud-only block (its animated GIF is rendered
   * server-side), so `useEditorCore` registers it as a lazy
   * `defineAsyncComponent` to keep it out of the OSS payload.
   *
   * Regression this guards: `Canvas.vue` also listed it in its static
   * `blockComponentMap`. That entry was unreachable at runtime — the registry is
   * checked first — but its static `import` put the module in the entry's
   * static-import closure, so the CDN bundle shipped it eagerly and the
   * `defineAsyncComponent` bought nothing. The fallback maps are for surfaces
   * without a registry; countdown deliberately isn't in any of them.
   */
  const FALLBACK_MAP_SURFACES = [
    "components/Canvas.vue",
    "components/blocks/SectionBlock.vue",
    "components/BlockPreviewCanvas.vue",
    "components/blocks/PreviewSectionBlock.vue",
  ];

  it.each(FALLBACK_MAP_SURFACES)(
    "%s does not statically import CountdownBlock.vue",
    (relPath) => {
      const source = read(relPath);
      // A static import — `import X from "..."`. The lazy form lives only in
      // useEditorCore and is `import("...")`, which this pattern won't match.
      expect(source).not.toMatch(/^\s*import\s+[^(\n]*CountdownBlock\.vue/m);
    },
  );

  it.each(FALLBACK_MAP_SURFACES)(
    "%s has no countdown entry in its fallback component map",
    (relPath) => {
      expect(read(relPath)).not.toMatch(/^\s*countdown:/m);
    },
  );

  it("useEditorCore still registers countdown, lazily", () => {
    const core = read("composables/useEditorCore.ts");
    // The registry is the single source for the component, so losing this would
    // make countdown blocks silently stop rendering everywhere.
    expect(core).toMatch(/countdown:\s*CountdownBlockComponent/);
    expect(core).toMatch(
      /CountdownBlockComponent\s*=\s*defineAsyncComponent\(\s*\(\)\s*=>\s*import\(/,
    );
  });
});
