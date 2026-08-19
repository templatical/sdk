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
    await page.keyboard.press("ControlOrMeta+a");
    const toolbar = page.locator(SELECTORS.textToolbar);
    const boldBtn = toolbar.getByRole("button", { name: /bold/i });
    await expect(boldBtn).toBeVisible();
    await boldBtn.click();
    await expect(boldBtn).toHaveClass(/tpl-text-toolbar-btn--active/);
  });

  test("italic toggles on click", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("paragraph");
    await page.keyboard.press("ControlOrMeta+a");
    const toolbar = page.locator(SELECTORS.textToolbar);
    const italicBtn = toolbar.getByRole("button", { name: /italic/i });
    await italicBtn.click();
    await expect(italicBtn).toHaveClass(/tpl-text-toolbar-btn--active/);
  });

  test("text alignment switches", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.doubleClickBlock("paragraph");
    await page.keyboard.press("ControlOrMeta+a");
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

  test("shared color pickers present in toolbar (no native color input)", async ({
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
    // Text color + highlight now use the SDK's shared ColorPicker (hex wheel),
    // consistent with every other color control in the editor.
    await expect(toolbar.locator(SELECTORS.textColorPicker)).toBeVisible();
    await expect(toolbar.locator(SELECTORS.highlightColorPicker)).toBeVisible();
    // The native OS color input must be gone.
    await expect(toolbar.locator('input[type="color"]')).toHaveCount(0);
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
    await page.keyboard.press("ControlOrMeta+a");
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

  test("typing after triple-click + native End keeps the canvas in place", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Deliberately performs the gesture the rest of the suite avoids (see
    // EditorPage.focusTextEditableAtEnd): the dblclick plus a same-point
    // click complete a triple-click chain, and a NATIVE End on that
    // selection arms a Chromium bug (verified 140–151) where the next
    // keystroke smooth-scrolls .tpl-body to its very bottom, dragging the
    // caret out of view. The editor's LineBoundaryKeys extension intercepts
    // plain End/Home and moves the caret via Selection.modify instead,
    // which never arms the bug.
    await editorPage.doubleClickBlock("paragraph");
    const editable = editorPage.getEditableFor("paragraph");
    await editable.click();

    const canvasBody = page.locator(SELECTORS.canvasBody);
    const scrollTopBefore = await canvasBody.evaluate((el) =>
      Math.round(el.scrollTop),
    );

    await editable.press("End");
    await page.keyboard.type(" guard");

    // The typed text landing is the concrete signal every keystroke was
    // processed — an armed runaway starts scrolling on the first one and
    // covers hundreds of pixels within these six.
    await expect(editable).toContainText("guard");
    const scrollTopAfter = await canvasBody.evaluate((el) =>
      Math.round(el.scrollTop),
    );
    // Caret was already in view, so healthy typing scrolls nothing; the
    // bug scrolls to the canvas bottom (~1100px). Small tolerance for a
    // sub-line caret reveal.
    expect(Math.abs(scrollTopAfter - scrollTopBefore)).toBeLessThanOrEqual(24);
    await expect(editable).toBeInViewport();
  });
});
