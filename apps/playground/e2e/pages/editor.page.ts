import type { Locator, Page } from "@playwright/test";
import { SELECTORS, blockByType } from "../helpers/selectors";

export class EditorPage {
  constructor(private page: Page) {}

  async waitForReady() {
    await this.page.waitForSelector(SELECTORS.editorScreen);
    await this.page.waitForSelector(SELECTORS.editorContainer);
  }

  async dismissOverlays() {
    // Prevent onboarding from appearing
    await this.page.evaluate(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });

    // Dismiss feature overlay if present
    const overlay = this.page.locator(SELECTORS.featureOverlay);
    if (await overlay.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.page.keyboard.press("Escape");
      await overlay.waitFor({ state: "hidden", timeout: 2000 });
    }

    // Dismiss onboarding if it started before localStorage was set
    const onboarding = this.page.locator(SELECTORS.onboardingSpotlight);
    if (await onboarding.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.page.keyboard.press("Escape");
      await onboarding.waitFor({ state: "hidden", timeout: 2000 });
    }

    // Dismiss cloud banner if present (bottom floating banner)
    const cloudBanner = this.page.locator(
      ".absolute.bottom-4 button",
    );
    if (await cloudBanner.last().isVisible({ timeout: 500 }).catch(() => false)) {
      // Click the dismiss/close button on the cloud banner
      await cloudBanner.last().click().catch(() => {});
      await this.page.waitForTimeout(300);
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
    await this.page.waitForSelector(SELECTORS.canvasBody, { timeout: 5000 });
    return this.getBlocks().count();
  }

  async selectBlock(index: number): Promise<void> {
    const block = this.getBlocks().nth(index);
    await block.click();
    await this.page
      .locator(SELECTORS.blockSelected)
      .waitFor({ timeout: 2000 });
  }

  async selectBlockByType(type: string): Promise<void> {
    await this.getBlockByType(type).first().click();
    await this.page
      .locator(SELECTORS.blockSelected)
      .waitFor({ timeout: 2000 });
  }

  async deselectBlock(): Promise<void> {
    // Press Escape to deselect current block — most reliable approach
    await this.page.keyboard.press("Escape");
    await this.page.waitForTimeout(100);
  }

  async duplicateSelectedBlock(): Promise<void> {
    const actions = this.page.locator(SELECTORS.blockActions);
    // Duplicate is the second button (after drag handle)
    await actions.locator(".tpl-block-action-btn").nth(1).click();
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

  // --- Sidebar ---

  async hoverSidebar(): Promise<void> {
    // Dismiss any overlay that might block hover
    const onboarding = this.page.locator(SELECTORS.onboardingSpotlight);
    if (await onboarding.isVisible({ timeout: 500 }).catch(() => false)) {
      await this.page.keyboard.press("Escape");
      await onboarding.waitFor({ state: "hidden", timeout: 2000 });
    }
    await this.page.locator(SELECTORS.sidebarRail).hover();
    // Wait for expand animation
    await this.page.waitForTimeout(300);
  }

  async dragBlockFromSidebar(blockLabel: string): Promise<void> {
    await this.hoverSidebar();
    const sidebar = this.page.locator(SELECTORS.sidebarRail);
    const sidebarItem = sidebar.locator(`text=${blockLabel}`).first();
    const canvas = this.page.locator(SELECTORS.canvasBlocks);
    await sidebarItem.dragTo(canvas);
  }

  /**
   * Drag a block from sidebar to a specific position relative to an existing block.
   * @param position "before" drops above the target, "after" drops below
   */
  async dragBlockFromSidebarToPosition(
    blockLabel: string,
    targetBlockIndex: number,
    position: "before" | "after",
  ): Promise<void> {
    await this.hoverSidebar();
    const sidebar = this.page.locator(SELECTORS.sidebarRail);
    const sidebarItem = sidebar.locator(`text=${blockLabel}`).first();
    const targetBlock = this.getBlocks().nth(targetBlockIndex);
    const targetBox = await targetBlock.boundingBox();
    if (!targetBox) throw new Error("Target block not found");

    await sidebarItem.dragTo(targetBlock, {
      force: true,
      targetPosition: {
        x: targetBox.width / 2,
        y: position === "before" ? 2 : targetBox.height - 2,
      },
    });
  }

  /**
   * Drag a block from sidebar into a section column.
   * @param colIndex 0-based column index
   */
  async dragBlockFromSidebarToSection(
    blockLabel: string,
    sectionIndex: number,
    colIndex: number = 0,
  ): Promise<void> {
    await this.hoverSidebar();
    const sidebar = this.page.locator(SELECTORS.sidebarRail);
    const sidebarItem = sidebar.locator(`text=${blockLabel}`).first();

    // Find section blocks and locate the column's draggable zone
    const section = this.page
      .locator(blockByType("section"))
      .nth(sectionIndex);
    // Each column contains a draggable zone with min-h-[60px]
    const columns = section.locator('[class*="tpl:min-h-"]');
    const target = columns.nth(colIndex);
    await sidebarItem.dragTo(target, { force: true });
  }

  /**
   * Reorder a block by dragging its handle to another block's position.
   */
  async reorderBlock(
    fromIndex: number,
    toIndex: number,
  ): Promise<void> {
    const fromBlock = this.getBlocks().nth(fromIndex);
    // Click to select the block first (shows drag handle)
    await fromBlock.click();
    await this.page.waitForTimeout(200);

    const handle = fromBlock.locator(SELECTORS.blockDragHandle);
    const toBlock = this.getBlocks().nth(toIndex);

    await handle.dragTo(toBlock);
  }

  /** Get ordered list of block types currently in canvas */
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

  /** Get block type at specific index */
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
    await this.page.locator(selector).click();
    // Wait for width transition
    await this.page.waitForTimeout(200);
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
    await this.page.waitForSelector(SELECTORS.jsonModal);
  }

  async clickThemeToggle(): Promise<void> {
    await this.page.locator(SELECTORS.themeButton).click();
  }

  async openConfig(): Promise<void> {
    await this.page.locator(SELECTORS.configButton).click();
    await this.page.locator('[role="dialog"]').waitFor({ timeout: 2000 });
  }

  async openExportMenu(): Promise<void> {
    await this.page.locator(SELECTORS.exportButton).click();
    await this.page.locator(SELECTORS.exportMenu).waitFor({ timeout: 2000 });
  }

  getEditorContainer(): Locator {
    return this.page.locator(SELECTORS.editorContainer);
  }
}
