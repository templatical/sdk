import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * E2E coverage for the built-in merge tag picker modal. The playground
 * toggles `enableRequestMergeTag` to switch between:
 *   - ON  → consumer-owned `onRequest` modal (playground's pg-modal-dialog)
 *   - OFF → SDK's built-in picker (TplModal-based MergeTagPickerModal)
 *
 * The default playground state has `enableRequestMergeTag = true`, so we
 * flip it off via the config modal for the picker-path tests.
 */

async function openConfigAndDisableOnRequest(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.locator(SELECTORS.configButton).click();
  // Config modal opens on the "options" tab by default; the onRequest
  // checkbox lives under the "callbacks" tab. Switch first — the
  // checkbox element exists in DOM regardless (it's `v-show`-hidden),
  // so `toBeVisible()` times out without this tab click.
  await page.locator("#config-tab-callbacks").click();
  const checkbox = page.locator(SELECTORS.configEnableOnRequestMergeTag);
  await expect(checkbox).toBeVisible();
  // Read current state — if already unchecked we just apply.
  const isChecked = await checkbox.isChecked();
  if (isChecked) await checkbox.click();
  await page.locator(SELECTORS.configApply).click();
}

async function openParagraphToolbar(
  editorPage: import("../pages/editor.page").EditorPage,
): Promise<void> {
  // Paragraph blocks enter edit mode (and mount the contenteditable +
  // toolbar) on double-click — `useEditableTextBlock.handleDoubleClick`.
  // A single click without double-click leaves the block in static
  // render mode and `getEditableFor("paragraph")` waits forever.
  await editorPage.doubleClickBlock("paragraph");
  const editable = editorPage.getEditableFor("paragraph");
  await editable.click();
}

async function clickInsertMergeTagButton(
  page: import("@playwright/test").Page,
): Promise<void> {
  // The inline button is gated on `canRequestMergeTag` and rendered in the
  // ParagraphToolbar / TitleEditor toolbar with the `Insert merge tag`
  // aria-label (English locale per playground default).
  const btn = page.getByRole("button", { name: "Insert merge tag" }).first();
  await btn.click();
}

test.describe("Merge tag picker — built-in (SDK) modal", () => {
  test("clicking 'Insert merge tag' opens the SDK picker when only static tags are configured", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openConfigAndDisableOnRequest(page);
    await editorPage.waitForReady();
    await openParagraphToolbar(editorPage);
    await clickInsertMergeTagButton(page);
    await expect(page.locator(SELECTORS.mergeTagPickerModal)).toBeVisible();
  });

  test("mouse click on a row inserts a merge tag node into the paragraph and closes the modal", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openConfigAndDisableOnRequest(page);
    await editorPage.waitForReady();
    await openParagraphToolbar(editorPage);
    await clickInsertMergeTagButton(page);
    const modal = page.locator(SELECTORS.mergeTagPickerModal);
    await expect(modal).toBeVisible();

    const firstItem = page.locator(SELECTORS.mergeTagPickerItem).first();
    const insertedValue = await firstItem.getAttribute("data-merge-tag-value");
    await firstItem.click();

    await expect(modal).toBeHidden();
    // The merge tag node lands on the canvas as a `.tpl-merge-tag-node`
    // wrapping an inner display span carrying the raw value via
    // `data-tooltip`. Matches the selector used by the autocomplete spec.
    await expect(
      page.locator(`.tpl-merge-tag-node [data-tooltip="${insertedValue}"]`).last(),
    ).toBeVisible();
  });

  test("keyboard insert: ArrowDown then Enter inserts the second item", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openConfigAndDisableOnRequest(page);
    await editorPage.waitForReady();
    await openParagraphToolbar(editorPage);
    await clickInsertMergeTagButton(page);
    const modal = page.locator(SELECTORS.mergeTagPickerModal);
    await expect(modal).toBeVisible();
    // Search input is auto-focused — keyboard navigation flows from there.
    await page.keyboard.press("ArrowDown");
    const secondItem = page.locator(SELECTORS.mergeTagPickerItem).nth(1);
    await expect(secondItem).toHaveAttribute("aria-selected", "true");
    const expectedValue = await secondItem.getAttribute("data-merge-tag-value");
    await page.keyboard.press("Enter");
    await expect(modal).toBeHidden();
    await expect(
      page.locator(`.tpl-merge-tag-node [data-tooltip="${expectedValue}"]`).last(),
    ).toBeVisible();
  });

  test("typing filters the list and clearing restores it", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openConfigAndDisableOnRequest(page);
    await editorPage.waitForReady();
    await openParagraphToolbar(editorPage);
    await clickInsertMergeTagButton(page);

    const search = page.locator(SELECTORS.mergeTagPickerSearch);
    await expect(search).toBeFocused();
    const itemsBefore = await page
      .locator(SELECTORS.mergeTagPickerItem)
      .count();
    expect(itemsBefore).toBeGreaterThan(1);

    await search.fill("email");
    await expect
      .poll(() => page.locator(SELECTORS.mergeTagPickerItem).count(), {
        timeout: 2000,
      })
      .toBeLessThan(itemsBefore);

    await search.fill("");
    await expect
      .poll(() => page.locator(SELECTORS.mergeTagPickerItem).count(), {
        timeout: 2000,
      })
      .toBe(itemsBefore);
  });

  test("search with no matches shows the empty state", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openConfigAndDisableOnRequest(page);
    await editorPage.waitForReady();
    await openParagraphToolbar(editorPage);
    await clickInsertMergeTagButton(page);

    const search = page.locator(SELECTORS.mergeTagPickerSearch);
    await search.fill("zzznomatch");
    await expect(page.locator(SELECTORS.mergeTagPickerEmpty)).toBeVisible();
    await expect(page.locator(SELECTORS.mergeTagPickerItem)).toHaveCount(0);
  });

  test("Esc cancels the modal without changing the canvas", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openConfigAndDisableOnRequest(page);
    await editorPage.waitForReady();
    await openParagraphToolbar(editorPage);
    const blocksBefore = await editorPage.getBlocks().count();
    await clickInsertMergeTagButton(page);
    const modal = page.locator(SELECTORS.mergeTagPickerModal);
    await expect(modal).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(modal).toBeHidden();
    expect(await editorPage.getBlocks().count()).toBe(blocksBefore);
  });

  test("header close button (×) closes the modal", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openConfigAndDisableOnRequest(page);
    await editorPage.waitForReady();
    await openParagraphToolbar(editorPage);
    await clickInsertMergeTagButton(page);
    await expect(page.locator(SELECTORS.mergeTagPickerModal)).toBeVisible();
    await page.locator(SELECTORS.mergeTagPickerClose).click();
    await expect(page.locator(SELECTORS.mergeTagPickerModal)).toBeHidden();
  });

  test("grouped tags render with group headers and counts", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openConfigAndDisableOnRequest(page);
    await editorPage.waitForReady();
    await openParagraphToolbar(editorPage);
    await clickInsertMergeTagButton(page);
    const headers = page.locator(SELECTORS.mergeTagPickerGroupHeader);
    // Playground configures group on every tag — headers must render.
    expect(await headers.count()).toBeGreaterThan(0);
    const firstHeader = await headers.first().textContent();
    expect(firstHeader).toMatch(/\(\d+\)/);
  });

  test("active search flattens groups (headers hide while filter is active)", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openConfigAndDisableOnRequest(page);
    await editorPage.waitForReady();
    await openParagraphToolbar(editorPage);
    await clickInsertMergeTagButton(page);
    expect(
      await page.locator(SELECTORS.mergeTagPickerGroupHeader).count(),
    ).toBeGreaterThan(0);
    await page.locator(SELECTORS.mergeTagPickerSearch).fill("name");
    await expect
      .poll(
        () => page.locator(SELECTORS.mergeTagPickerGroupHeader).count(),
        { timeout: 2000 },
      )
      .toBe(0);
  });

  test("rows show description text when configured", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openConfigAndDisableOnRequest(page);
    await editorPage.waitForReady();
    await openParagraphToolbar(editorPage);
    await clickInsertMergeTagButton(page);
    // The playground sets description for every tag; at least one row's
    // text content must include a known description phrase.
    const items = page.locator(SELECTORS.mergeTagPickerItem);
    const combined = (await items.first().textContent()) ?? "";
    expect(combined.length).toBeGreaterThan(0);
    // First playground tag is `firstName` — description "Personalized greeting..."
    expect(combined.toLowerCase()).toContain("personalized");
  });
});

test.describe("Merge tag picker — onRequest precedence", () => {
  test("with default config (onRequest enabled), clicking 'Insert merge tag' opens the playground modal, NOT the SDK picker", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Default playground state already has onRequest enabled. We just need
    // to open a paragraph and click the button.
    await openParagraphToolbar(editorPage);
    await clickInsertMergeTagButton(page);
    await expect(
      page.locator(SELECTORS.playgroundMergeTagModal),
    ).toBeVisible();
    // The SDK picker must NOT be in the DOM — consumer-owned UX wins.
    await expect(page.locator(SELECTORS.mergeTagPickerModal)).toHaveCount(0);
  });
});

test.describe("Welcome Email template — built-in picker is the default", () => {
  test("opens the SDK picker without flipping any config toggle", async ({
    page,
    chooserPage,
    editorPage,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectTemplateByName("Welcome Email");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await openParagraphToolbar(editorPage);
    await clickInsertMergeTagButton(page);
    await expect(page.locator(SELECTORS.mergeTagPickerModal)).toBeVisible();
    await expect(page.locator(SELECTORS.playgroundMergeTagModal)).toHaveCount(0);
  });
});

test.describe("Merge tag picker — autocomplete unchanged", () => {
  test("typing the syntax opener still shows the autocomplete suggestion list (regression)", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openConfigAndDisableOnRequest(page);
    await editorPage.waitForReady();
    await editorPage.doubleClickBlock("paragraph");
    // Programmatic caret placement — a native End after the dblclick+click
    // chain trips the Chromium triple-click scroll bug; see
    // focusTextEditableAtEnd in editor.page.ts.
    await editorPage.focusTextEditableAtEnd("paragraph");
    // Liquid trigger char.
    await page.keyboard.type(" {{");
    await expect(page.locator(SELECTORS.mergeTagSuggestionPopup)).toBeVisible();
  });
});

/**
 * Issue #733: activating a tag that is already in the content reopens the
 * chooser rather than a text input holding the raw token.
 *
 * The canvas chip is the case worth driving in a browser: the chooser mounts
 * in the popover root, outside the rich-text editor, so a click on one of its
 * rows reads as a click outside the block. Without the shared requesting flag
 * the block finishes editing mid-pick and the update is silently dropped —
 * which no unit test exercises end to end.
 */
test.describe("Merge tag — changing a tag already in the content", () => {
  async function insertFirstTag(
    editorPage: import("../pages/editor.page").EditorPage,
    page: import("@playwright/test").Page,
  ): Promise<string> {
    await openParagraphToolbar(editorPage);
    await clickInsertMergeTagButton(page);
    const firstItem = page.locator(SELECTORS.mergeTagPickerItem).first();
    const value = await firstItem.getAttribute("data-merge-tag-value");
    await firstItem.click();
    await expect(page.locator(SELECTORS.mergeTagPickerModal)).toBeHidden();
    return value!;
  }

  function chipFor(page: import("@playwright/test").Page, value: string) {
    return page.locator(`.tpl-merge-tag-node [data-tooltip="${value}"]`).last();
  }

  test("clicking a chip reopens the picker instead of a raw text input", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openConfigAndDisableOnRequest(page);
    await editorPage.waitForReady();
    const inserted = await insertFirstTag(editorPage, page);

    await chipFor(page, inserted).click();

    await expect(page.locator(SELECTORS.mergeTagPickerModal)).toBeVisible();
    // The old behaviour put the raw token into an editable input on the chip.
    await expect(page.locator(".tpl-merge-tag-node input")).toHaveCount(0);
  });

  test("the picker opens with the current tag preselected", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openConfigAndDisableOnRequest(page);
    await editorPage.waitForReady();
    const inserted = await insertFirstTag(editorPage, page);

    await chipFor(page, inserted).click();
    await expect(page.locator(SELECTORS.mergeTagPickerModal)).toBeVisible();

    const current = page.locator(
      `${SELECTORS.mergeTagPickerItem}[aria-current="true"]`,
    );
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute("data-merge-tag-value", inserted);
  });

  test("picking a different tag swaps the chip in place", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await openConfigAndDisableOnRequest(page);
    await editorPage.waitForReady();
    const inserted = await insertFirstTag(editorPage, page);
    const chipsBefore = await page.locator(SELECTORS.mergeTagNode).count();

    // Counted, not asserted absent: the showcase template already carries tags
    // of its own, so only the delta says whether *this* chip changed.
    const allWith = (value: string) =>
      page.locator(`.tpl-merge-tag-node [data-tooltip="${value}"]`);
    const insertedBefore = await allWith(inserted).count();

    await chipFor(page, inserted).click();
    await expect(page.locator(SELECTORS.mergeTagPickerModal)).toBeVisible();

    const replacement = page.locator(SELECTORS.mergeTagPickerItem).nth(1);
    const replacementValue =
      await replacement.getAttribute("data-merge-tag-value");
    expect(replacementValue).not.toBe(inserted);
    const replacementBefore = await allWith(replacementValue!).count();
    // Clicking a row is a click outside the rich-text block. If the block tears
    // down here, the update lands on a disposed node view and nothing changes.
    await replacement.click();

    await expect(page.locator(SELECTORS.mergeTagPickerModal)).toBeHidden();
    await expect(allWith(replacementValue!)).toHaveCount(replacementBefore + 1);
    await expect(allWith(inserted)).toHaveCount(insertedBefore - 1);
    // Swapped, not added.
    await expect(page.locator(SELECTORS.mergeTagNode)).toHaveCount(chipsBefore);
  });

  test("a consumer-owned chooser handles the change too", async ({
    editorReady: { editorPage },
    page,
  }) => {
    // Default playground state: `mergeTags.onRequest` is wired to the
    // playground's own modal, which must own edits as well as insertions.
    await editorPage.waitForReady();
    await openParagraphToolbar(editorPage);
    await clickInsertMergeTagButton(page);
    const playgroundModal = page.locator(SELECTORS.playgroundMergeTagModal);
    await expect(playgroundModal).toBeVisible();
    const row = playgroundModal.getByRole("button").nth(1);
    await row.click();
    await expect(playgroundModal).toBeHidden();

    const chip = page.locator(`${SELECTORS.mergeTagNode} [role="button"]`).last();
    await chip.click();

    await expect(playgroundModal).toBeVisible();
    await expect(page.locator(SELECTORS.mergeTagPickerModal)).toHaveCount(0);
    await expect(page.locator(".tpl-merge-tag-node input")).toHaveCount(0);
  });
});
