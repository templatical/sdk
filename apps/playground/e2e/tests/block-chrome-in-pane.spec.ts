import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * A selected block's action bar and its comment-count pill stay inside the
 * canvas pane (#1052). At Playwright's default 1280 × 720 the playground's
 * pane leaves about 28 px beside a full-width block, so both would hang past
 * the pane's edge, under the properties panel.
 *
 * Playwright's `click()` scrolls a clipping ancestor first, so it passes on a
 * clipped button; these tests hit-test with `elementFromPoint` instead.
 */

/** Buttons in `chrome` that are outside the pane or covered by something. */
function unreachableButtons(chrome: Locator): Promise<string[]> {
  return chrome.evaluate((element) => {
    const root = element.getRootNode() as Document | ShadowRoot;
    const pane = element.closest(".tpl-body") as HTMLElement;
    const paneBox = pane.getBoundingClientRect();
    const paneLeft = paneBox.left + pane.clientLeft;
    const paneRight = paneLeft + pane.clientWidth;
    const buttons = element.matches("button")
      ? [element]
      : [...element.querySelectorAll("button")];
    return buttons.flatMap((button) => {
      const label = button.getAttribute("aria-label");
      const box = button.getBoundingClientRect();
      if (box.left < paneLeft || box.right > paneRight)
        return [`${label} outside the pane`];
      // Nine points, so a badge painted over part of a button counts.
      return [0.2, 0.5, 0.8].flatMap((fx) =>
        [0.2, 0.5, 0.8].flatMap((fy) => {
          const hit = root.elementFromPoint(
            box.left + box.width * fx,
            box.top + box.height * fy,
          );
          return hit && button.contains(hit)
            ? []
            : [`${label} covered at ${fx},${fy}`];
        }),
      );
    });
  });
}

/** Pixels between the block's right edge and the pane's visible right edge. */
function roomBesideBlock(block: Locator): Promise<number> {
  return block.evaluate((element) => {
    const pane = element.closest(".tpl-body") as HTMLElement;
    const paneRight =
      pane.getBoundingClientRect().left + pane.clientLeft + pane.clientWidth;
    return paneRight - element.getBoundingClientRect().right;
  });
}

function paneOverflow(page: Page): Promise<number> {
  return page
    .locator(".tpl-body")
    .evaluate((pane) => pane.scrollWidth - pane.clientWidth);
}

test.describe("block chrome in a narrow canvas pane", () => {
  test("keeps the four-button action bar clickable when saved blocks are on", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("saved-blocks");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await editorPage.selectBlockByType("title");
    const block = page.locator(SELECTORS.blockSelected);
    const actions = page.locator(SELECTORS.blockActions);
    await expect(actions.getByRole("button")).toHaveCount(4);
    await expect(
      actions.getByRole("button", { name: /save as block/i }),
    ).toBeVisible();

    // The case under test: beside the block, the bar would leave the pane.
    const barWidth = await actions.evaluate(
      (element) => (element as HTMLElement).offsetWidth,
    );
    expect(await roomBesideBlock(block)).toBeLessThan(barWidth + 8);

    await expect.poll(() => unreachableButtons(actions)).toEqual([]);
    expect(await paneOverflow(page)).toBeLessThanOrEqual(0);

    const blockId = await block.getAttribute("data-block-id");
    const before = await editorPage.getBlockCount();
    await page.locator(SELECTORS.blockDeleteBtn).click();
    await expect.poll(() => editorPage.getBlockCount()).toBe(before - 1);
    await expect(page.locator(`[data-block-id="${blockId}"]`)).toHaveCount(0);
  });

  test("moves the comment-count pill into the badge row when it would leave the pane", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await page.addInitScript(() =>
      localStorage.removeItem("templatical:comments:comments"),
    );
    await scenePage.goto("comments");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await editorPage.selectBlockByType("paragraph");
    const blockId = await page
      .locator(SELECTORS.blockSelected)
      .getAttribute("data-block-id");
    const block = page.locator(`[data-block-id="${blockId}"]`);

    await page.locator(SELECTORS.commentsTrigger).click();
    await expect(page.locator(SELECTORS.commentsSidebar)).toBeVisible();
    await page.locator(SELECTORS.commentsFilterBlock).click();
    await page.locator(SELECTORS.commentsInput).fill("Tighten this line");
    await page.locator(SELECTORS.commentsSend).click();
    await expect(page.locator(SELECTORS.commentThread)).toHaveCount(1);
    await page.locator(SELECTORS.commentsTrigger).click();
    await expect(page.locator(SELECTORS.commentsSidebar)).toHaveCount(0);

    const pill = block.locator(
      `${SELECTORS.blockBadges} > ${SELECTORS.commentIndicator}`,
    );
    await expect(pill).toHaveText("1");
    // The pane's right inset animates from the panel's 680 px back to the
    // properties panel's 320 px; measure once it has landed.
    await expect
      .poll(() =>
        page.locator(".tpl-body").evaluate((pane) => getComputedStyle(pane).right),
      )
      .toBe("320px");

    // The case under test: outside the corner, the pill would leave the pane.
    const pillWidth = await pill.evaluate(
      (element) => (element as HTMLElement).offsetWidth,
    );
    expect(await roomBesideBlock(block)).toBeLessThan(pillWidth + 8);

    await expect
      .poll(() => pill.evaluate((element) => getComputedStyle(element).position))
      .toBe("static");
    await expect.poll(() => unreachableButtons(pill)).toEqual([]);
    // The selected block's action bar steps around the row the pill joined.
    await expect
      .poll(() => unreachableButtons(page.locator(SELECTORS.blockActions)))
      .toEqual([]);
    expect(await paneOverflow(page)).toBeLessThanOrEqual(0);

    // With room again both return to where they always sat: the pill 4 px
    // past the top-right corner, the bar 8 px right of the block. On this
    // short block the bar starts under the pill rather than covering it.
    await page.setViewportSize({ width: 1600, height: 900 });
    await expect
      .poll(() => pill.evaluate((element) => getComputedStyle(element).position))
      .toBe("absolute");
    const offsets = () =>
      block.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const pillBox = element
          .querySelector(".tpl-comment-indicator")!
          .getBoundingClientRect();
        const barBox = element
          .querySelector(".tpl-block-actions")!
          .getBoundingClientRect();
        return {
          pillLeft: Math.round(pillBox.left - box.right),
          pillTop: Math.round(pillBox.top - box.top),
          barLeft: Math.round(barBox.left - box.right),
          barUnderPill: Math.round(barBox.top - pillBox.bottom),
        };
      });
    await expect
      .poll(offsets)
      .toEqual({ pillLeft: 4, pillTop: -4, barLeft: 8, barUnderPill: 4 });

    await pill.click();
    await expect(page.locator(SELECTORS.commentsSidebar)).toBeVisible();
    await expect(page.locator(SELECTORS.commentThread)).toHaveCount(1);
  });
});
