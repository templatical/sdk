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
    await sidebarItem.dragTo(target);
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
    // overshoot value. Fallback timeout covers the same-viewport no-op case
    // where no transition runs.
    const settled = this.page.evaluate((testId) => {
      return new Promise<void>((resolve) => {
        const el = document.querySelector(`[data-testid="${testId}"]`);
        if (!el) return resolve();
        const done = () => {
          el.removeEventListener("transitionend", handler);
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
