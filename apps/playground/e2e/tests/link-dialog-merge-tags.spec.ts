import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import type { Page } from "@playwright/test";
import type { EditorPage } from "../pages/editor.page";

/**
 * E2E coverage for merge tags in the rich-text link URL field (#687).
 *
 * The three things only a browser can show: the type-ahead popup paints
 * above the dialog rather than behind it, the picker modal's row click does
 * not tear the paragraph out of edit mode, and a bare tag reaches the stored
 * `href` without a `https://` prefix.
 */

async function openLinkDialog(
  editorPage: EditorPage,
  page: Page,
): Promise<void> {
  // Paragraphs mount their contenteditable + toolbar on double-click.
  await editorPage.doubleClickBlock("paragraph");
  const editable = editorPage.getEditableFor("paragraph");
  await editable.click();
  // insertLink runs extendMarkRange().setLink() — a collapsed caret marks no
  // range, so no anchor is created and the assertions would read the
  // template's pre-existing links instead. Select the block's text first.
  await page.keyboard.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Add Link" }).first().click();
  await expect(page.locator(SELECTORS.linkDialog)).toBeVisible();
}

function urlInput(page: Page) {
  return page.locator(SELECTORS.linkDialogUrl).locator("input");
}

test.describe("Link dialog merge tags", () => {
  test("offers the merge tag insert button in the URL field", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openLinkDialog(editorPage, page);

    // Scoped to the dialog: the paragraph toolbar behind it carries the same
    // button, so an unscoped query passes without the dialog having one.
    await expect(
      page
        .locator(SELECTORS.linkDialog)
        .getByRole("button", { name: "Insert merge tag" }),
    ).toBeVisible();
  });

  test("paints the suggestion popup above the dialog", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openLinkDialog(editorPage, page);

    const input = urlInput(page);
    await input.click();
    await input.pressSequentially("{{fir");

    const popup = page.locator(SELECTORS.mergeTagSuggestionPopup);
    await expect(popup).toBeVisible();

    // `toBeVisible` is not enough: a popup painting behind the dialog's
    // backdrop still reports visible. Comparing computed z-index is not the
    // check either — the backdrop resolves to `auto`, so any number beats it
    // and the assertion passes for the wrong reason. Hit-test instead, which
    // is the property the user actually has. Descend through shadow roots: a
    // plain elementFromPoint stops at the editor's shadow host.
    const box = (await popup.boundingBox())!;
    const topmost = await page.evaluate(
      ([x, y]) => {
        let el = document.elementFromPoint(x as number, y as number);
        while (el?.shadowRoot) {
          const inner = el.shadowRoot.elementFromPoint(
            x as number,
            y as number,
          );
          if (!inner || inner === el) break;
          el = inner;
        }
        return el?.closest("[data-testid='merge-tag-suggestion-popup']")
          ? "popup"
          : (el?.tagName ?? "none");
      },
      [box.x + box.width / 2, box.y + 8],
    );
    expect(topmost).toBe("popup");
  });

  // A picker opened FROM the dialog is strictly above it in the interaction
  // stack, but both are `z-index: auto` inside `.tpl-popover-root` (one
  // stacking context), so paint order is teleport-anchor order. The picker
  // modals mount with the editor; the dialog's Teleport mounts later, when the
  // paragraph enters edit mode — so the dialog's anchor comes last and it
  // covers the very picker it opened.
  //
  // The logic picker stands in for both: it and the merge tag picker are the
  // same `TplModal`, and the playground's default config routes the merge tag
  // button to its own `onRequest` modal rather than the SDK picker.
  //
  // Hit-tested, not z-index-compared: `auto` reads as 0, so any number would
  // pass for the wrong reason.
  test("paints a picker modal above the dialog that opened it", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openLinkDialog(editorPage, page);

    await page
      .locator(SELECTORS.linkDialog)
      .getByRole("button", { name: "Insert logic", exact: true })
      .click();

    const modal = page.locator(SELECTORS.logicPickerModal);
    await expect(modal).toBeVisible();

    const box = (await modal.boundingBox())!;
    const topmost = await page.evaluate(
      ([x, y]) => {
        let el = document.elementFromPoint(Number(x), Number(y));
        while (el?.shadowRoot) {
          const inner = el.shadowRoot.elementFromPoint(Number(x), Number(y));
          if (!inner || inner === el) break;
          el = inner;
        }
        if (el?.closest("[data-testid='logic-picker-modal']")) return "picker";
        if (el?.closest("[data-testid='link-dialog']")) return "link-dialog";
        return el?.tagName ?? "none";
      },
      [box.x + box.width / 2, box.y + box.height / 2],
    );
    expect(topmost).toBe("picker");
  });

  test("keeps the paragraph in edit mode while the picker modal is open", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openLinkDialog(editorPage, page);

    await page
      .locator(SELECTORS.linkDialog)
      .getByRole("button", { name: "Insert merge tag" })
      .click();

    // The playground's default wiring opens its own onRequest modal; the SDK
    // picker appears when that's off. Either way, whichever modal opened, the
    // dialog underneath must survive it — that is the regression.
    await expect(page.locator(SELECTORS.linkDialog)).toBeVisible();
    await expect(editorPage.getEditableFor("paragraph")).toBeVisible();
  });

  test("stores a bare merge tag as the href without prefixing https://", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openLinkDialog(editorPage, page);

    const input = urlInput(page);
    await input.click();
    await input.fill("{{first_name}}");
    await page.locator(SELECTORS.linkDialogSubmit).click();
    await expect(page.locator(SELECTORS.linkDialog)).toBeHidden();

    const hrefs = await editorPage.getCanvasLinkHrefs();
    expect(hrefs).toContain("{{first_name}}");
    expect(hrefs.some((h) => h.startsWith("https://{{"))).toBe(false);
  });

  test("still completes a bare host with https://", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openLinkDialog(editorPage, page);

    const input = urlInput(page);
    await input.click();
    await input.fill("example.com/promo");
    await page.locator(SELECTORS.linkDialogSubmit).click();
    await expect(page.locator(SELECTORS.linkDialog)).toBeHidden();

    const hrefs = await editorPage.getCanvasLinkHrefs();
    expect(hrefs).toContain("https://example.com/promo");
  });
});
