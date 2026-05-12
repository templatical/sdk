import { expect, type Locator, type Page } from "@playwright/test";
import { SELECTORS, blockByType, paletteByType } from "../helpers/selectors";

export class EditorPage {
  constructor(private page: Page) {}

  /**
   * Wait for the editor screen + SDK container to mount and hydrate.
   * Hydration = at least one block rendered OR the empty-state placeholder.
   */
  async waitForReady(): Promise<void> {
    await this.page.locator(SELECTORS.editorScreen).waitFor();
    await this.page.locator(SELECTORS.editorContainer).waitFor();
    await this.page
      .locator(`${SELECTORS.block}, ${SELECTORS.canvasEmpty}`)
      .first()
      .waitFor();
  }

  /**
   * Dismiss any visible overlays (feature showcase, onboarding, cloud banner).
   * Idempotent — safe to call multiple times.
   */
  async dismissOverlays(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });

    const featureClose = this.page.locator(SELECTORS.featureOverlayClose);
    if (await featureClose.isVisible()) {
      await featureClose.click();
      await this.page
        .locator(SELECTORS.featureOverlay)
        .waitFor({ state: "hidden" });
    }

    const onboarding = this.page.locator(SELECTORS.onboardingSpotlight);
    if (await onboarding.isVisible()) {
      const skip = this.page.locator(SELECTORS.onboardingSkip);
      if (await skip.isVisible()) {
        await skip.click();
      } else {
        await this.page.keyboard.press("Escape");
      }
      await onboarding.waitFor({ state: "hidden" });
    }
  }

  // --- Block operations ---

  getBlocks(): Locator {
    return this.page.locator(SELECTORS.block);
  }

  getBlockByType(type: string): Locator {
    return this.page.locator(blockByType(type));
  }

  async getBlockCount(): Promise<number> {
    await this.page
      .locator(`${SELECTORS.canvasBody}, ${SELECTORS.canvasEmpty}`)
      .first()
      .waitFor();
    return this.getBlocks().count();
  }

  /** Collect all block IDs currently rendered on the canvas. */
  async getBlockIds(): Promise<string[]> {
    const blocks = this.getBlocks();
    const count = await blocks.count();
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = await blocks.nth(i).getAttribute("data-block-id");
      if (id) ids.push(id);
    }
    return ids;
  }

  async selectBlock(index: number): Promise<void> {
    await this.getBlocks().nth(index).click();
    await this.page.locator(SELECTORS.blockSelected).waitFor();
  }

  async selectBlockByType(type: string): Promise<void> {
    await this.getBlockByType(type).first().click();
    await this.page.locator(SELECTORS.blockSelected).waitFor();
  }

  async deselectBlock(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.page.locator(SELECTORS.blockSelected)).toHaveCount(0);
  }

  async duplicateSelectedBlock(): Promise<void> {
    const actions = this.page.locator(SELECTORS.blockActions);
    await actions.getByRole("button", { name: /duplicate/i }).click();
  }

  async deleteSelectedBlock(): Promise<void> {
    await this.page.locator(SELECTORS.blockDeleteBtn).click();
  }

  async doubleClickBlock(type: string): Promise<void> {
    await this.getBlockByType(type).first().dblclick();
  }

  // --- Text editing ---

  getTextToolbar(): Locator {
    return this.page.locator(SELECTORS.textToolbar);
  }

  /**
   * Return the editable TipTap contenteditable inside a block of the given
   * type. Clicking this element focuses the ProseMirror editor so keyboard
   * input (select-all, typing) lands in the document — clicking the outer
   * wrapper sometimes doesn't propagate focus.
   */
  getEditableFor(blockType: string): Locator {
    return this.page
      .locator(
        `${blockByType(blockType)} [contenteditable="true"], ${blockByType(blockType)} .tiptap`,
      )
      .first();
  }

  // --- Sidebar ---

  async hoverSidebar(): Promise<void> {
    await this.dismissOverlays();
    const rail = this.page.locator(SELECTORS.sidebarRail);
    await rail.hover();
    // Wait for expand — palette items become visible when rail is wide enough
    // to show labels. We don't assert text since a block-type attribute is
    // always present, so just let the rail settle for the hover transition.
    await expect(rail).toBeVisible();
  }

  /**
   * Drag a block from the sidebar palette onto the canvas.
   * Resolves when the canvas block count increases by one.
   */
  async dragBlockFromSidebar(blockType: string): Promise<void> {
    await this.hoverSidebar();
    const countBefore = await this.getBlocks().count();
    const sidebarItem = this.page
      .locator(SELECTORS.sidebarRail)
      .locator(paletteByType(blockType));
    const canvas = this.page.locator(SELECTORS.canvasBlocks);
    await sidebarItem.dragTo(canvas);
    await expect
      .poll(() => this.getBlocks().count(), { timeout: 5000 })
      .toBe(countBefore + 1);
  }

  /**
   * Drag a block from sidebar to before/after a specific existing block.
   * Resolves when the canvas block count increases by one.
   */
  async dragBlockFromSidebarToPosition(
    blockType: string,
    targetBlockIndex: number,
    position: "before" | "after",
  ): Promise<void> {
    await this.hoverSidebar();
    const countBefore = await this.getBlocks().count();
    const sidebarItem = this.page
      .locator(SELECTORS.sidebarRail)
      .locator(paletteByType(blockType));
    const targetBlock = this.getBlocks().nth(targetBlockIndex);
    const targetBox = await targetBlock.boundingBox();
    if (!targetBox) throw new Error(`Target block #${targetBlockIndex} not found`);

    await sidebarItem.dragTo(targetBlock, {
      targetPosition: {
        x: targetBox.width / 2,
        y:
          position === "before"
            ? Math.max(4, targetBox.height * 0.1)
            : targetBox.height - Math.max(4, targetBox.height * 0.1),
      },
    });
    await expect
      .poll(() => this.getBlocks().count(), { timeout: 5000 })
      .toBe(countBefore + 1);
  }

  /** Drag a block from sidebar into a section column. */
  async dragBlockFromSidebarToSection(
    blockType: string,
    sectionIndex: number,
    colIndex: number = 0,
  ): Promise<void> {
    await this.hoverSidebar();
    const sidebarItem = this.page
      .locator(SELECTORS.sidebarRail)
      .locator(paletteByType(blockType));
    const section = this.page.locator(blockByType("section")).nth(sectionIndex);
    const columns = section.locator('[class*="tpl:min-h-"]');
    const target = columns.nth(colIndex);
    const countBefore = await section.locator(SELECTORS.block).count();
    // Section's draggable runs with `invertSwap: true` + `invertedSwapThreshold:
    // 0.65`, so swap zones are the outer ~17.5% of each existing block.
    // Aiming at the COLUMN's bottom 10% can land in column whitespace below
    // the last item (column has `min-h-[60px]`, items may not fill it), which
    // misses every swap zone. Aim at the last item's bottom 10% instead; for
    // an empty column, aim at the column center where `emptyInsertThreshold`
    // applies.
    const existingBlocks = this.getSectionColumnBlocks(sectionIndex, colIndex);
    const existingCount = await existingBlocks.count();
    if (existingCount > 0) {
      const lastBlock = existingBlocks.last();
      const lastBox = await lastBlock.boundingBox();
      if (!lastBox)
        throw new Error(
          `Section ${sectionIndex} col ${colIndex} last block bounding box unavailable`,
        );
      await sidebarItem.dragTo(lastBlock, {
        targetPosition: {
          x: lastBox.width / 2,
          y: lastBox.height - Math.max(4, lastBox.height * 0.1),
        },
      });
    } else {
      const targetBox = await target.boundingBox();
      if (!targetBox)
        throw new Error(
          `Section ${sectionIndex} col ${colIndex} bounding box unavailable`,
        );
      await sidebarItem.dragTo(target, {
        targetPosition: {
          x: targetBox.width / 2,
          y: targetBox.height / 2,
        },
      });
    }
    await expect
      .poll(() => section.locator(SELECTORS.block).count(), { timeout: 5000 })
      .toBe(countBefore + 1);
  }

  /**
   * Reorder a block by dragging its handle onto another block.
   *
   * Sortable.js on the canvas listens to pointer events, not native HTML5
   * drag, and needs multiple intermediate mousemove events to trigger a
   * swap. Playwright's `dragTo` emits only two moves, which isn't enough —
   * so we drive the mouse manually in steps.
   */
  async reorderBlock(fromIndex: number, toIndex: number): Promise<void> {
    const fromBlock = this.getBlocks().nth(fromIndex);
    await fromBlock.click();
    await this.page.locator(SELECTORS.blockSelected).waitFor();

    const fromId = await fromBlock.getAttribute("data-block-id");
    if (!fromId) throw new Error(`Block #${fromIndex} has no data-block-id`);

    const handle = fromBlock.locator(SELECTORS.blockDragHandle).first();
    await handle.waitFor();

    const handleBox = await handle.boundingBox();
    const toBox = await this.getBlocks().nth(toIndex).boundingBox();
    if (!handleBox || !toBox) throw new Error("Drag bounds unavailable");

    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    const endX = toBox.x + toBox.width / 2;
    // Aim past the target's center so Sortable swaps in the intended direction.
    const endY =
      toIndex > fromIndex
        ? toBox.y + toBox.height - 4
        : toBox.y + 4;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    const steps = 20;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await this.page.mouse.move(
        startX + (endX - startX) * t,
        startY + (endY - startY) * t,
      );
    }
    await this.page.mouse.up();

    await expect
      .poll(
        async () => (await this.getBlockIds()).indexOf(fromId),
        { timeout: 5000 },
      )
      .toBe(toIndex);
  }

  /**
   * Top-level blocks on the canvas (excludes section children). The
   * `.tpl-block` selector matches recursively, but the canvas's draggable
   * wraps each top-level item in `div > div.tpl:relative > .tpl-block`, so
   * the grandchild path under `.tpl-canvas-blocks` yields the top-level set
   * exclusively.
   */
  getTopLevelBlocks(): Locator {
    return this.page.locator(
      `${SELECTORS.canvasBlocks} > div > div > ${SELECTORS.block}`,
    );
  }

  /** Block IDs of top-level canvas blocks, in order. */
  async getTopLevelBlockIds(): Promise<string[]> {
    const blocks = this.getTopLevelBlocks();
    const count = await blocks.count();
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = await blocks.nth(i).getAttribute("data-block-id");
      if (id) ids.push(id);
    }
    return ids;
  }

  /** Block types of top-level canvas blocks, in order. */
  async getTopLevelBlockTypes(): Promise<string[]> {
    const blocks = this.getTopLevelBlocks();
    const count = await blocks.count();
    const types: string[] = [];
    for (let i = 0; i < count; i++) {
      const type = await blocks.nth(i).getAttribute("data-block-type");
      if (type) types.push(type);
    }
    return types;
  }

  /**
   * Locate the column containers of a section block. Each column is the
   * direct flex child of `tpl:flex tpl:gap-0` inside the section and is sized
   * by an inline `width` style; matching the `tpl:min-h-` class lets us pick
   * the column without depending on Tailwind's escaped width classes.
   */
  getSectionColumn(sectionIndex: number, colIndex: number): Locator {
    // Columns are direct flex grandchildren of the section root: the
    // `section.tpl:w-full > div.tpl:flex.tpl:gap-0 > div` path. Anchoring on
    // the flex container's `>` direct-child relation excludes nested
    // sections' own columns, which a recursive `[class*="tpl:min-h-"]`
    // descendant query would also match.
    return this.page
      .locator(blockByType("section"))
      .nth(sectionIndex)
      .locator('div[class*="tpl:flex"][class*="tpl:gap-0"] > div')
      .nth(colIndex);
  }

  /** Direct child blocks of a single column (excludes deeper nesting). */
  getSectionColumnBlocks(sectionIndex: number, colIndex: number): Locator {
    return this.getSectionColumn(sectionIndex, colIndex).locator(
      SELECTORS.block,
    );
  }

  /** Block IDs in a single section column, in order. */
  async getSectionColumnBlockIds(
    sectionIndex: number,
    colIndex: number,
  ): Promise<string[]> {
    const blocks = this.getSectionColumnBlocks(sectionIndex, colIndex);
    const count = await blocks.count();
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = await blocks.nth(i).getAttribute("data-block-id");
      if (id) ids.push(id);
    }
    return ids;
  }

  /**
   * Manual-mouse pointer drive between two locators. Sortable.js listens to
   * pointer events, not native HTML5 drag, and needs multiple intermediate
   * mousemove events to register the swap — `dragTo` only emits two and is
   * insufficient for in-editor moves (canvas reorder, section reorder,
   * cross-container drops).
   *
   * `targetEdge` aims past a target's center so Sortable swaps in the
   * intended direction; `"center"` is the right default for empty/cross
   * container drops.
   */
  private async pointerDrive(
    sourceBox: { x: number; y: number; width: number; height: number },
    targetBox: { x: number; y: number; width: number; height: number },
    targetEdge: "top" | "bottom" | "center" = "center",
  ): Promise<void> {
    const startX = sourceBox.x + sourceBox.width / 2;
    const startY = sourceBox.y + sourceBox.height / 2;
    const endX = targetBox.x + targetBox.width / 2;
    // Section's and canvas's draggables both run with `invertSwap: true` +
    // `invertedSwapThreshold: 0.65`, so the swap zone is the outer ~17.5%
    // of each edge (inner 65% is a dead zone). Aiming at 10% / 90% lands
    // squarely in the active zone and lets Sortable fire the swap reliably.
    const endY =
      targetEdge === "top"
        ? targetBox.y + targetBox.height * 0.1
        : targetEdge === "bottom"
          ? targetBox.y + targetBox.height * 0.9
          : targetBox.y + targetBox.height / 2;

    // Sortable.js gates drag-start on a small initial movement (>1px) and
    // wires its `_onDragOver` hit-test to `pointermove`. Driving with
    // `mouse.move({ steps: N })` interpolates Playwright's native event
    // emission across N intermediate moves, giving Sortable enough frames
    // to register drag-start, evaluate target containers (including nested
    // section columns), and animate the swap before mouseup commits.
    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    // Tiny initial nudge so Sortable.js's threshold check fires before the
    // long-distance interpolated move.
    await this.page.mouse.move(startX + 4, startY + 4);
    await this.page.mouse.move(endX, endY, { steps: 30 });
    // Settle frames at the destination — Sortable's animation needs a
    // couple ticks to land the dropped item before mouseup.
    await this.page.mouse.move(endX, endY);
    await this.page.mouse.move(endX, endY);
    await this.page.mouse.up();
  }

  /**
   * Reorder a block WITHIN a single section column by dragging child N onto
   * child M. Section's draggable has no `handle` attribute, so any pointerdown
   * on the child block initiates the drag.
   */
  async reorderBlockWithinSection(
    sectionIndex: number,
    colIndex: number,
    fromChildIndex: number,
    toChildIndex: number,
  ): Promise<void> {
    const blocks = this.getSectionColumnBlocks(sectionIndex, colIndex);
    const fromBlock = blocks.nth(fromChildIndex);
    const toBlock = blocks.nth(toChildIndex);
    const fromId = await fromBlock.getAttribute("data-block-id");
    if (!fromId)
      throw new Error(
        `Section ${sectionIndex} col ${colIndex} child ${fromChildIndex} has no data-block-id`,
      );
    await fromBlock.scrollIntoViewIfNeeded();
    await toBlock.scrollIntoViewIfNeeded();
    const fromBox = await fromBlock.boundingBox();
    if (!fromBox) throw new Error("Section reorder source bounds unavailable");

    // Sortable replaces the dragged element with a zero-height ghost
    // (`.tpl-ghost { height: 0 }`), so once the drag starts, the column
    // collapses and the target block shifts up by the source's height.
    // Pre-drag `toBox` coordinates would aim past the target's new position
    // — drive the mouse to drag-start first, re-query `toBox`, then
    // interpolate to the up-to-date target location.
    const targetEdge = toChildIndex > fromChildIndex ? "bottom" : "top";
    const startX = fromBox.x + fromBox.width / 2;
    const startY = fromBox.y + fromBox.height / 2;
    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    // Tiny nudge so Sortable's drag-start threshold fires and the ghost
    // is inserted into the DOM, collapsing the column.
    await this.page.mouse.move(startX + 4, startY + 4);

    const toBox = await toBlock.boundingBox();
    if (!toBox) {
      await this.page.mouse.up();
      throw new Error("Section reorder target bounds unavailable after drag start");
    }
    const endX = toBox.x + toBox.width / 2;
    const endY =
      targetEdge === "top"
        ? toBox.y + toBox.height * 0.1
        : toBox.y + toBox.height * 0.9;

    await this.page.mouse.move(endX, endY, { steps: 30 });
    await this.page.mouse.move(endX, endY);
    await this.page.mouse.move(endX, endY);
    await this.page.mouse.up();

    await expect
      .poll(
        async () =>
          (await this.getSectionColumnBlockIds(sectionIndex, colIndex)).indexOf(
            fromId,
          ),
        { timeout: 5000 },
      )
      .toBe(toChildIndex);
  }

  /**
   * Move a top-level canvas block INTO a section column. Canvas-level
   * draggable requires `handle=".tpl-block-btn"`, which only renders on the
   * floating action bar of a selected block (see BlockWrapper.vue) — so the
   * helper selects first to materialize the handle, then drives the pointer
   * from that handle to the section column drop area.
   */
  async moveBlockFromCanvasToSection(
    canvasBlockIndex: number,
    sectionIndex: number,
    colIndex: number = 0,
  ): Promise<void> {
    const canvasBlock = this.getTopLevelBlocks().nth(canvasBlockIndex);
    const blockId = await canvasBlock.getAttribute("data-block-id");
    if (!blockId)
      throw new Error(`Canvas block #${canvasBlockIndex} has no data-block-id`);

    await canvasBlock.scrollIntoViewIfNeeded();
    await canvasBlock.click();
    await this.page.locator(SELECTORS.blockSelected).waitFor();
    const handle = canvasBlock.locator(SELECTORS.blockDragHandle).first();
    await handle.waitFor();

    const targetCol = this.getSectionColumn(sectionIndex, colIndex);
    await targetCol.scrollIntoViewIfNeeded();
    // Target scroll may have shifted source out of view. Re-scroll source so
    // both endpoints lie inside the viewport for the manual mouse drive.
    await canvasBlock.scrollIntoViewIfNeeded();
    const handleBox = await handle.boundingBox();
    const targetBox = await targetCol.boundingBox();
    if (!handleBox || !targetBox)
      throw new Error("Canvas→section drag bounds unavailable");

    const sectionColCountBefore = await this.getSectionColumnBlocks(
      sectionIndex,
      colIndex,
    ).count();

    // Aim near the top of the column. SectionBlock.vue's draggable is
    // configured with `:empty-insert-threshold="20"`, so the drop is more
    // reliable when the cursor settles near a column edge than dead-center.
    await this.pointerDrive(handleBox, targetBox, "top");

    await expect
      .poll(
        async () =>
          (await this.getSectionColumnBlockIds(sectionIndex, colIndex)).includes(
            blockId,
          ),
        { timeout: 5000 },
      )
      .toBe(true);
    expect(
      await this.getSectionColumnBlocks(sectionIndex, colIndex).count(),
    ).toBe(sectionColCountBefore + 1);
  }

  /**
   * Move a child block OUT of a section column to the canvas top-level,
   * landing before/after a specific top-level block. Section's draggable
   * has no `handle`, so pointerdown on the child block element starts the
   * drag.
   */
  async moveBlockFromSectionToCanvas(
    sectionIndex: number,
    colIndex: number,
    childIndex: number,
    targetCanvasIndex: number,
    position: "before" | "after" = "after",
  ): Promise<void> {
    const fromBlock = this.getSectionColumnBlocks(sectionIndex, colIndex).nth(
      childIndex,
    );
    const blockId = await fromBlock.getAttribute("data-block-id");
    if (!blockId)
      throw new Error(
        `Section ${sectionIndex} col ${colIndex} child ${childIndex} has no data-block-id`,
      );
    await fromBlock.scrollIntoViewIfNeeded();
    const targetBlock = this.getTopLevelBlocks().nth(targetCanvasIndex);
    await targetBlock.scrollIntoViewIfNeeded();
    await fromBlock.scrollIntoViewIfNeeded();
    const fromBox = await fromBlock.boundingBox();
    const targetBox = await targetBlock.boundingBox();
    if (!fromBox || !targetBox)
      throw new Error("Section→canvas drag bounds unavailable");

    await this.pointerDrive(
      fromBox,
      targetBox,
      position === "before" ? "top" : "bottom",
    );

    await expect
      .poll(async () => (await this.getTopLevelBlockIds()).includes(blockId), {
        timeout: 5000,
      })
      .toBe(true);
  }

  /**
   * Move a child block between two columns of the SAME section. Pointerdown
   * on the child block element starts the drag (no handle on section's
   * draggable). Asserts the block's id leaves the source column and lands in
   * the target column.
   */
  async moveBlockBetweenColumns(
    sectionIndex: number,
    fromColIndex: number,
    fromChildIndex: number,
    toColIndex: number,
  ): Promise<void> {
    const fromBlock = this.getSectionColumnBlocks(
      sectionIndex,
      fromColIndex,
    ).nth(fromChildIndex);
    const blockId = await fromBlock.getAttribute("data-block-id");
    if (!blockId)
      throw new Error(
        `Section ${sectionIndex} col ${fromColIndex} child ${fromChildIndex} has no data-block-id`,
      );
    const toCol = this.getSectionColumn(sectionIndex, toColIndex);
    await fromBlock.scrollIntoViewIfNeeded();
    await toCol.scrollIntoViewIfNeeded();
    await fromBlock.scrollIntoViewIfNeeded();
    const fromBox = await fromBlock.boundingBox();
    const toBox = await toCol.boundingBox();
    if (!fromBox || !toBox)
      throw new Error("Cross-column drag bounds unavailable");

    await this.pointerDrive(fromBox, toBox, "top");

    await expect
      .poll(
        async () =>
          (await this.getSectionColumnBlockIds(sectionIndex, toColIndex)).includes(
            blockId,
          ),
        { timeout: 5000 },
      )
      .toBe(true);
    expect(
      await this.getSectionColumnBlockIds(sectionIndex, fromColIndex),
    ).not.toContain(blockId);
  }

  /**
   * Move a child block from one section's column into a DIFFERENT section's
   * column. Same source mechanics as cross-column move.
   */
  async moveBlockBetweenSections(
    fromSectionIndex: number,
    fromColIndex: number,
    fromChildIndex: number,
    toSectionIndex: number,
    toColIndex: number = 0,
  ): Promise<void> {
    const fromBlock = this.getSectionColumnBlocks(
      fromSectionIndex,
      fromColIndex,
    ).nth(fromChildIndex);
    const blockId = await fromBlock.getAttribute("data-block-id");
    if (!blockId)
      throw new Error(
        `Section ${fromSectionIndex} col ${fromColIndex} child ${fromChildIndex} has no data-block-id`,
      );
    const toCol = this.getSectionColumn(toSectionIndex, toColIndex);
    await fromBlock.scrollIntoViewIfNeeded();
    await toCol.scrollIntoViewIfNeeded();
    await fromBlock.scrollIntoViewIfNeeded();
    const fromBox = await fromBlock.boundingBox();
    const toBox = await toCol.boundingBox();
    if (!fromBox || !toBox)
      throw new Error("Cross-section drag bounds unavailable");

    await this.pointerDrive(fromBox, toBox, "top");

    await expect
      .poll(
        async () =>
          (await this.getSectionColumnBlockIds(toSectionIndex, toColIndex)).includes(
            blockId,
          ),
        { timeout: 5000 },
      )
      .toBe(true);
    expect(
      await this.getSectionColumnBlockIds(fromSectionIndex, fromColIndex),
    ).not.toContain(blockId);
  }

  /** Ordered list of block types currently on the canvas. */
  async getBlockTypes(): Promise<string[]> {
    const blocks = this.getBlocks();
    const count = await blocks.count();
    const types: string[] = [];
    for (let i = 0; i < count; i++) {
      const type = await blocks.nth(i).getAttribute("data-block-type");
      if (type) types.push(type);
    }
    return types;
  }

  /** Block type at a specific index. */
  async getBlockTypeAt(index: number): Promise<string | null> {
    return this.getBlocks().nth(index).getAttribute("data-block-type");
  }

  // --- Viewport & toggles ---

  async switchViewport(name: "Desktop" | "Tablet" | "Mobile"): Promise<void> {
    const selector =
      name === "Desktop"
        ? SELECTORS.viewportDesktop
        : name === "Tablet"
          ? SELECTORS.viewportTablet
          : SELECTORS.viewportMobile;
    // Arm a transitionend listener before the click so we catch the exact
    // settled frame. Canvas.vue animates `width` with a 300ms spring-bounce
    // curve — polling for "width changed" fires mid-flight and returns an
    // overshoot value. The wrapper lives inside the editor's shadow root
    // when shadowDom is enabled, so look through every container's shadow
    // root first; fall back to a document query for light-DOM mounts.
    // Fallback timeout covers the same-viewport no-op case where no
    // transition runs (and the listener never fires).
    const settled = this.page.evaluate((testId) => {
      return new Promise<void>((resolve) => {
        let el: Element | null = document.querySelector(
          `[data-testid="${testId}"]`,
        );
        if (!el) {
          // Walk every host element with an open shadow root looking for
          // the wrapper. Avoids hard-coding the editor container's
          // testid in this helper.
          const hosts = Array.from(document.querySelectorAll("*")).filter(
            (n): n is HTMLElement =>
              n instanceof HTMLElement && !!n.shadowRoot,
          );
          for (const host of hosts) {
            const inside = host.shadowRoot!.querySelector(
              `[data-testid="${testId}"]`,
            );
            if (inside) {
              el = inside;
              break;
            }
          }
        }
        if (!el) return resolve();
        const done = () => {
          el!.removeEventListener("transitionend", handler);
          resolve();
        };
        const handler = (e: Event) => {
          if ((e as TransitionEvent).propertyName === "width") done();
        };
        el.addEventListener("transitionend", handler);
        setTimeout(done, 600);
      });
    }, "canvas-wrapper");
    await this.page.locator(selector).click();
    await settled;
  }

  async toggleDarkMode(): Promise<void> {
    await this.page.locator(SELECTORS.darkModeToggle).click();
  }

  async togglePreview(): Promise<void> {
    await this.page.locator(SELECTORS.previewToggle).click();
  }

  async getCanvasWrapperWidth(): Promise<number> {
    const wrapper = this.page.locator(SELECTORS.canvasWrapper);
    const box = await wrapper.boundingBox();
    return box?.width ?? 0;
  }

  // --- Toolbar actions ---

  async clickBack(): Promise<void> {
    await this.page.locator(SELECTORS.backButton).click();
  }

  async openJson(): Promise<void> {
    await this.page.locator(SELECTORS.jsonButton).click();
    await this.page.locator(SELECTORS.jsonModal).waitFor();
  }

  async clickThemeToggle(): Promise<void> {
    await this.page.locator(SELECTORS.themeButton).click();
  }

  async openConfig(): Promise<void> {
    await this.page.locator(SELECTORS.configButton).click();
    await this.page.locator('[role="dialog"]').first().waitFor();
  }

  async openExportMenu(): Promise<void> {
    await this.page.locator(SELECTORS.exportButton).click();
    await this.page.locator(SELECTORS.exportMenu).waitFor();
  }

  getEditorContainer(): Locator {
    return this.page.locator(SELECTORS.editorContainer);
  }
}
