import { test, expect } from "../fixtures/editor.fixture";
import {
  SELECTORS,
  paletteByType,
  blockByType,
} from "../helpers/selectors";

/**
 * Drag-and-drop fallback-mode regression suite.
 *
 * Every test in this file guards a specific bug discovered during a long
 * Chrome-vs-Firefox drag debugging cycle. All three `<VueDraggable>`
 * instances (sidebar palette, canvas top-level, section column inner)
 * run with `:force-fallback="true"` — Sortable uses pointer events
 * instead of native HTML5 drag. That mode is load-bearing for several
 * reasons (see CLAUDE.md "Drag-and-drop architecture") and these tests
 * pin the contract.
 *
 * Why mouse-step drag everywhere: Playwright's `dragTo` emits HTML5
 * `dragstart`/`drop` events. Sortable in fallback mode doesn't listen
 * to those. We drive the mouse manually with `page.mouse.down() →
 * mouse.move(...steps) → mouse.up()` so Sortable's pointermove polling
 * resolves the drop the same way it does in real user interaction.
 */
test.describe("Drag fallback-mode regression suite", () => {
  test("sidebar palette → canvas: drop creates a new block (force-fallback path)", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Regression: this drop flow ONLY works when canvas + sidebar are in
    // the same Sortable mode. The user's reported "ghost tracks but
    // nothing drops" symptom appeared when sidebar was reverted to HTML5
    // while canvas stayed on fallback — Sortable only binds dragover on
    // its `el` in HTML5 mode, so cross-mode HTML5→fallback drops are
    // dropped on the floor. This test catches a re-introduction of that
    // mode mismatch.
    await editorPage.hoverSidebar();
    const countBefore = await editorPage.getBlockCount();

    const sidebarItem = page
      .locator(SELECTORS.sidebarRail)
      .locator(paletteByType("spacer"));
    const canvas = page.locator(SELECTORS.canvasBlocks);
    await sidebarItem.scrollIntoViewIfNeeded();
    const fromBox = await sidebarItem.boundingBox();
    const toBox = await canvas.boundingBox();
    if (!fromBox || !toBox) {
      throw new Error("Sidebar→canvas bounds unavailable");
    }

    const startX = fromBox.x + fromBox.width / 2;
    const startY = fromBox.y + fromBox.height / 2;
    const endX = toBox.x + toBox.width / 2;
    // Aim near the bottom of the canvas list so we drop after existing
    // blocks rather than overlap with one.
    const endY = toBox.y + toBox.height - 24;

    // Sortable.js gates drag-start on a small initial movement; drive
    // a tiny nudge first, then interpolate across many intermediate
    // moves so pointermove polling has time to fire.
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 4, startY + 4);
    await page.mouse.move(endX, endY, { steps: 30 });
    // Settle frames — Sortable's emulated dragover loop runs at 50ms.
    await page.mouse.move(endX, endY);
    await page.mouse.move(endX, endY);
    await page.mouse.up();

    await expect
      .poll(() => editorPage.getBlockCount(), { timeout: 5000 })
      .toBe(countBefore + 1);
    expect(await editorPage.getBlockTypes()).toContain("spacer");
  });

  test("`.sortable-fallback` element appears during sidebar drag with `transition: none`", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Regression: the `.sortable-fallback` ghost is a clone of the
    // dragged palette button and inherits Tailwind's
    // `tpl:transition-all tpl:duration-[120ms]` from the button's class
    // list. Without our override (`transition: none !important` in
    // styles/index.css), every pointermove-driven transform animates
    // over 120ms and the ghost lags behind a fast-moving cursor. This
    // test holds the drag mid-flight and asserts the CSS override is
    // in effect.
    await editorPage.hoverSidebar();
    const sidebarItem = page
      .locator(SELECTORS.sidebarRail)
      .locator(paletteByType("divider"));
    const canvas = page.locator(SELECTORS.canvasBlocks);
    const fromBox = await sidebarItem.boundingBox();
    const toBox = await canvas.boundingBox();
    if (!fromBox || !toBox) {
      throw new Error("Sidebar→canvas bounds unavailable");
    }

    const startX = fromBox.x + fromBox.width / 2;
    const startY = fromBox.y + fromBox.height / 2;
    const midX = toBox.x + toBox.width / 2;
    const midY = toBox.y + toBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Drive halfway, then HOLD — Sortable's force-fallback ghost is now
    // mounted to the DOM and we can inspect its computed style.
    await page.mouse.move(startX + 4, startY + 4);
    await page.mouse.move(midX, midY, { steps: 20 });

    try {
      // The fallback ghost is appended to the sidebar's VueDraggable
      // element (Sortable's `rootEl`, NOT `document.body` since
      // `fallback-on-body` is off). It carries the `sortable-fallback`
      // class which Sortable applies inline at append-ghost time.
      // `getComputedStyle` runs in page context — the ghost lives
      // inside the editor's shadow root.
      const styles = await page.evaluate(() => {
        const editor = document.querySelector(
          '[data-testid="editor-container"]',
        );
        const root = editor?.shadowRoot ?? document;
        const ghost = root.querySelector(".sortable-fallback");
        if (!ghost) return null;
        const cs = getComputedStyle(ghost as HTMLElement);
        return {
          transition: cs.transitionProperty + " " + cs.transitionDuration,
          animation: cs.animationName + " " + cs.animationDuration,
          position: cs.position,
        };
      });

      expect(styles, "Sortable fallback ghost not found mid-drag").not.toBeNull();
      // `transition: none` resolves to `transitionProperty: all` (or
      // `none`) + `transitionDuration: 0s`. The duration of 0s is the
      // important part — that's what makes the transform jump
      // instantly to each new pointer-driven position. Without our
      // override the duration would be `0.12s` (120ms) from Tailwind.
      expect(styles!.transition).toMatch(/\b0s\b/);
      // Same logic for animation: name resolves to `none` and duration
      // to `0s` with our `animation: none !important` rule.
      expect(styles!.animation).toMatch(/\b0s\b/);
      // Position must be `fixed` — `absolute` would anchor the ghost
      // to a positioned ancestor (e.g. sidebar's `position: absolute`),
      // not the viewport, and ghost coords would resolve wrong as the
      // cursor moves.
      expect(styles!.position).toBe("fixed");
    } finally {
      // Always release the mouse — leaving a button held breaks
      // every subsequent test in the file.
      await page.mouse.up();
    }
  });

  test("sidebar source dragEl uses `visibility: hidden`, NOT `display: none`, during drag", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Regression: Sortable's `_dragStarted` applies the `ghostClass`
    // (`tpl-ghost`) to the source `dragEl` BEFORE `_appendGhost` reads
    // its `getBoundingClientRect()` to stamp the cursor-following
    // ghost's initial position. If our CSS rule forces `display: none`
    // on `.tpl-sidebar-rail .tpl-ghost`, the rect returns zeros and the
    // ghost ends up offset from the cursor by the source's Y position.
    // `visibility: hidden` keeps the element in layout so the rect is
    // valid. THIS WAS THE FINAL FIX in a multi-hour debugging cycle.
    await editorPage.hoverSidebar();
    const sidebarItem = page
      .locator(SELECTORS.sidebarRail)
      .locator(paletteByType("title"));
    const canvas = page.locator(SELECTORS.canvasBlocks);
    const fromBox = await sidebarItem.boundingBox();
    const toBox = await canvas.boundingBox();
    if (!fromBox || !toBox) {
      throw new Error("Sidebar→canvas bounds unavailable");
    }

    const startX = fromBox.x + fromBox.width / 2;
    const startY = fromBox.y + fromBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 4, startY + 4);
    await page.mouse.move(
      toBox.x + toBox.width / 2,
      toBox.y + toBox.height / 2,
      { steps: 20 },
    );

    try {
      const sourceVisibility = await page.evaluate(() => {
        const editor = document.querySelector(
          '[data-testid="editor-container"]',
        );
        const root = editor?.shadowRoot ?? document;
        // The dragEl is the palette button with the `tpl-ghost` class
        // applied. The button itself does NOT have visibility: hidden
        // declared inline — it inherits the rule from the CSS selector
        // `.tpl-sidebar-rail .tpl-ghost { visibility: hidden }`.
        const dragEl = root.querySelector(
          ".tpl-sidebar-rail .tpl-ghost",
        ) as HTMLElement | null;
        if (!dragEl) return null;
        const cs = getComputedStyle(dragEl);
        const rect = dragEl.getBoundingClientRect();
        return {
          display: cs.display,
          visibility: cs.visibility,
          // The rect MUST be non-zero — `_appendGhost` reads this exact
          // call to position the ghost. Zero rect = wrong ghost position.
          width: rect.width,
          height: rect.height,
        };
      });

      expect(sourceVisibility, "Source dragEl with .tpl-ghost not found").not.toBeNull();
      expect(sourceVisibility!.display).not.toBe("none");
      expect(sourceVisibility!.visibility).toBe("hidden");
      expect(sourceVisibility!.width).toBeGreaterThan(0);
      expect(sourceVisibility!.height).toBeGreaterThan(0);
    } finally {
      await page.mouse.up();
    }
  });

  test("sidebar stays expanded during a drag (no collapse-mid-drag rect corruption)", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Regression: the rail auto-hides 200px → 48px on `mouseleave`.
    // Without the `isDragging` guard, the cursor leaving the sidebar at
    // drag start triggers the width transition BEFORE Sortable's
    // `_appendGhost` reads the source rect — captured mid-transition,
    // ghost stamped with a half-shrunk width, visibly offset from
    // cursor. `@choose` (fires on pointerdown) flips `isDragging` so
    // `handleSidebarLeave` early-returns. This test verifies the rail
    // stays at 200px while a drag is in progress, even with the cursor
    // outside the sidebar.
    await editorPage.hoverSidebar();
    const sidebar = page.locator(SELECTORS.sidebarRail);
    const expandedWidth = await sidebar.evaluate(
      (el) => (el as HTMLElement).getBoundingClientRect().width,
    );
    // Sanity: rail should be expanded after hoverSidebar.
    expect(expandedWidth).toBeGreaterThan(150);

    const sidebarItem = page
      .locator(SELECTORS.sidebarRail)
      .locator(paletteByType("paragraph"));
    const canvas = page.locator(SELECTORS.canvasBlocks);
    const fromBox = await sidebarItem.boundingBox();
    const toBox = await canvas.boundingBox();
    if (!fromBox || !toBox) {
      throw new Error("Sidebar→canvas bounds unavailable");
    }

    const startX = fromBox.x + fromBox.width / 2;
    const startY = fromBox.y + fromBox.height / 2;
    const endX = toBox.x + toBox.width / 2;
    const endY = toBox.y + toBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 4, startY + 4);
    await page.mouse.move(endX, endY, { steps: 30 });
    // Wait past the rail's 200ms width-transition window so a
    // collapse, if it were going to happen, would have settled.
    await page.waitForTimeout(250);

    try {
      const widthDuringDrag = await sidebar.evaluate(
        (el) => (el as HTMLElement).getBoundingClientRect().width,
      );
      // Allow ~1px tolerance for sub-pixel rounding.
      expect(widthDuringDrag).toBeGreaterThan(expandedWidth - 1);
    } finally {
      await page.mouse.up();
    }
  });

  test("sidebar palette → section column: drop creates a child block", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Regression: cross-list drops between Sortable instances rely on
    // shared mode (fallback↔fallback). When sidebar was HTML5 and
    // section was fallback, this drop silently failed because Sortable
    // only binds native dragover on HTML5-mode els. The drop indicator
    // never appeared and nothing landed.
    const sections = page.locator(blockByType("section"));
    if ((await sections.count()) === 0) {
      test.skip();
      return;
    }

    await editorPage.hoverSidebar();
    const sidebarItem = page
      .locator(SELECTORS.sidebarRail)
      .locator(paletteByType("paragraph"));
    const column = editorPage.getSectionColumn(0, 0);
    const before = (await editorPage.getSectionColumnBlockIds(0, 0)).length;

    const fromBox = await sidebarItem.boundingBox();
    const toBox = await column.boundingBox();
    if (!fromBox || !toBox) {
      throw new Error("Sidebar→section bounds unavailable");
    }

    const startX = fromBox.x + fromBox.width / 2;
    const startY = fromBox.y + fromBox.height / 2;
    const endX = toBox.x + toBox.width / 2;
    const endY = toBox.y + toBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 4, startY + 4);
    await page.mouse.move(endX, endY, { steps: 30 });
    await page.mouse.move(endX, endY);
    await page.mouse.move(endX, endY);
    await page.mouse.up();

    await expect
      .poll(
        async () =>
          (await editorPage.getSectionColumnBlockIds(0, 0)).length,
        { timeout: 5000 },
      )
      .toBe(before + 1);
  });

  test("dragging a block's grip inside a section reorders the column (Chrome inner-section fix)", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Regression: with HTML5 nested Sortables, Chrome silently refuses
    // to fire `dragstart` from a child block's grip inside a section
    // column. The mousedown sets `dragEl.draggable = true` and
    // everything looks ready, but the browser never initiates drag.
    // Firefox fires it fine. Force-fallback bypasses native drag.
    const sections = page.locator(blockByType("section"));
    if ((await sections.count()) === 0) {
      test.skip();
      return;
    }

    // Need at least two children in column 0 to test reorder.
    const idsBefore = await editorPage.getSectionColumnBlockIds(0, 0);
    if (idsBefore.length < 2) {
      test.skip();
      return;
    }

    await editorPage.reorderBlockWithinSection(0, 0, 0, 1);

    const idsAfter = await editorPage.getSectionColumnBlockIds(0, 0);
    expect(idsAfter[0]).toBe(idsBefore[1]);
    expect(idsAfter[1]).toBe(idsBefore[0]);
  });
});
