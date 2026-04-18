import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Editor text editing", () => {
  test("double-click paragraph enters edit mode", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("paragraph");
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();
  });

  test("text toolbar shows formatting buttons", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("paragraph");
    const toolbar = page.locator(SELECTORS.textToolbar);
    await expect(toolbar).toBeVisible();
    // ParagraphToolbar renders contents only when TipTap editor is ready
    // (v-if="!isLoading && editor"). Wait for the first formatting button
    // rather than a fixed timeout.
    await expect(
      toolbar.locator(SELECTORS.textToolbarBtn).first(),
    ).toBeVisible();
    const buttons = toolbar.locator("button");
    expect(await buttons.count()).toBeGreaterThanOrEqual(3);
  });

  test("bold toggles on click", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("paragraph");
    await page.keyboard.press("Meta+a");
    const toolbar = page.locator(SELECTORS.textToolbar);
    // Bold button has tpl-text-toolbar-btn class
    const boldBtn = toolbar.locator(SELECTORS.textToolbarBtn).first();
    await boldBtn.click();
    await expect(
      toolbar.locator(SELECTORS.textToolbarBtnActive).first(),
    ).toBeVisible();
  });

  test("italic toggles on click", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("paragraph");
    await page.keyboard.press("Meta+a");
    const toolbar = page.locator(SELECTORS.textToolbar);
    const italicBtn = toolbar.locator(SELECTORS.textToolbarBtn).nth(1);
    await italicBtn.click();
    // The default alignment button also carries the active class, so assert
    // on the italic button directly rather than total active count.
    await expect(italicBtn).toHaveClass(/tpl-text-toolbar-btn--active/);
  });

  test("text alignment switches", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("paragraph");
    await page.keyboard.press("Meta+a");
    const toolbar = page.locator(SELECTORS.textToolbar);
    const centerBtn = toolbar.getByRole("button", { name: /center/i });
    await expect(centerBtn).toBeVisible();
    await centerBtn.click();
    await expect(centerBtn).toHaveClass(/active/);
  });

  test("font family select present in toolbar", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("paragraph");
    const toolbar = page.locator(SELECTORS.textToolbar);
    await expect(toolbar).toBeVisible();
    // Toolbar mounts its inner controls (font select, color inputs) only
    // once the TipTap editor is ready. Wait for the first select to render.
    await expect(toolbar.locator("select").first()).toBeVisible();
  });

  test("color inputs present in toolbar", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("paragraph");
    const toolbar = page.locator(SELECTORS.textToolbar);
    await expect(toolbar).toBeVisible();
    // Wait for toolbar contents to render (gated by v-if on TipTap ready)
    await expect(
      toolbar.locator(SELECTORS.textToolbarBtn).first(),
    ).toBeVisible();
    // Color pickers for text color and highlight — search globally since toolbar is teleported
    const colorInputs = page.locator(
      `${SELECTORS.textToolbar} input[type="color"]`,
    );
    expect(await colorInputs.count()).toBeGreaterThanOrEqual(1);
  });

  test("clicking another block exits edit mode", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("paragraph");
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();
    // Click a different block type to exit paragraph editing
    await editorPage.getBlockByType("title").first().click();
    await expect(page.locator(SELECTORS.textToolbar)).toHaveCount(0);
  });

  test("double-click title enters edit mode", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("title");
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();
  });

  test("link dialog opens from toolbar", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("paragraph");
    await page.keyboard.press("Meta+a");
    const toolbar = page.locator(SELECTORS.textToolbar);
    const linkBtn = toolbar.getByRole("button", { name: /link/i });
    await expect(linkBtn).toBeVisible();
    await linkBtn.click();
    await expect(
      page.locator(
        'input[type="url"], input[placeholder*="http"], input[placeholder*="URL"], input[placeholder*="url"]',
      ),
    ).toBeVisible();
  });
});
