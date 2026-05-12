import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * Shadow event retargeting regression tests.
 *
 * When the editor mounts inside a shadow root, the browser retargets
 * `event.target` to the shadow host on listeners attached at `document`
 * level. The actual focused / clicked element inside the shadow tree is
 * only accessible via `event.composedPath()`. Two production sites that
 * read `event.target` directly broke without this fix:
 *
 *   1. `isEditingText()` in `keyboardShortcuts.ts` — used by the global
 *      Backspace handler to decide whether to delete the selected block.
 *      Retargeted target was a non-contenteditable DIV → guard wrongly
 *      passed → Backspace deleted the block instead of a character.
 *
 *   2. `handleClickOutside()` in `useRichTextEditor.ts` — used to decide
 *      when to exit edit mode. Retargeted target was the shadow host
 *      (outside `.tpl-text-editor-wrapper`) → every click inside the
 *      shadow tree exited edit mode, including double-click word-select.
 *
 * Both sites now walk `composedPath()`. These specs are shadow-only.
 *
 * `page.keyboard.type()` doesn't reach shadow-mounted contenteditables in
 * Playwright (separate, tracked issue — Playwright keyboard routing
 * limitation, not a real shadow-DOM bug), so the specs dispatch synthetic
 * keyboard/mouse events from inside the shadow tree via `page.evaluate()`
 * — which is exactly the path Chromium uses for native input anyway.
 */
test.describe("Shadow event retargeting regressions", () => {
  test.skip(
    ({ shadowDom }) => !shadowDom,
    "regressions only manifest in shadow mode (event.target retargeting)",
  );

  test("Backspace while editing text does not delete the block", async ({
    editorReady,
    page,
  }) => {
    const { editorPage } = editorReady;
    const countBefore = await editorPage.getBlockCount();
    await editorPage.doubleClickBlock("paragraph");
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();

    // TipTap mounts the contenteditable asynchronously after edit mode
    // starts. Wait for it to materialize before dispatching the
    // synthetic keydown — otherwise the queryselector inside the
    // page.evaluate may run while the block is still in idle render.
    await editorPage.getEditableFor("paragraph").waitFor();

    // Dispatch a Backspace keydown from inside the shadow-mounted
    // contenteditable. composedPath() will include the contenteditable
    // even though document-level listeners see event.target retargeted
    // to the editor container — the fix's whole point.
    await page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="editor-container"]',
      ) as HTMLElement;
      // TipTap's contenteditable lives inside the paragraph block.
      // Tag is `<div contenteditable="true">` produced by ProseMirror;
      // selector matches whatever attribute string the renderer emits.
      const para = container.shadowRoot?.querySelector(
        '[data-block-type="paragraph"]',
      ) as HTMLElement | null;
      const editable =
        (para?.querySelector("[contenteditable]") as HTMLElement | null) ??
        (para?.querySelector(".tiptap") as HTMLElement | null);
      if (!editable) {
        const sample = para?.innerHTML.slice(0, 400) ?? "<no paragraph>";
        throw new Error(`contenteditable not found. sample: ${sample}`);
      }
      editable.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Backspace",
          bubbles: true,
          composed: true,
        }),
      );
    });

    // The block count must be unchanged. Pre-fix, the global Backspace
    // handler saw a retargeted DIV target, decided "not editing", and
    // removed the block — count dropped by one.
    expect(await editorPage.getBlockCount()).toBe(countBefore);
  });

  test("mousedown inside the editor wrapper does not exit edit mode", async ({
    editorReady,
    page,
  }) => {
    const { editorPage } = editorReady;
    await editorPage.doubleClickBlock("paragraph");
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();
    await editorPage.getEditableFor("paragraph").waitFor();

    // Dispatch a mousedown from inside the contenteditable. Production
    // mousedown handler reads composedPath to find the real target;
    // pre-fix it read retargeted event.target (shadow host) → fell
    // through the `.tpl-text-editor-wrapper` closest-ancestor check →
    // called onDone() and exited edit mode.
    await page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="editor-container"]',
      ) as HTMLElement;
      // TipTap's contenteditable lives inside the paragraph block.
      // Tag is `<div contenteditable="true">` produced by ProseMirror;
      // selector matches whatever attribute string the renderer emits.
      const para = container.shadowRoot?.querySelector(
        '[data-block-type="paragraph"]',
      ) as HTMLElement | null;
      const editable =
        (para?.querySelector("[contenteditable]") as HTMLElement | null) ??
        (para?.querySelector(".tiptap") as HTMLElement | null);
      if (!editable) {
        const sample = para?.innerHTML.slice(0, 400) ?? "<no paragraph>";
        throw new Error(`contenteditable not found. sample: ${sample}`);
      }
      editable.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          composed: true,
        }),
      );
    });

    // The text toolbar (only visible while editing) must still be
    // present. Pre-fix it disappeared because the click-outside path
    // wrongly decided the click was outside the editor wrapper.
    await expect(page.locator(SELECTORS.textToolbar)).toBeVisible();
  });
});
