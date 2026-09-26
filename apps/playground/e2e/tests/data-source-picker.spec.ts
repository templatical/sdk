import { test, expect } from "../fixtures/editor.fixture";

/**
 * Featured-article / product-showcase `onFetch` opens the playground
 * data-source modal. That Teleport must mount next to SceneHost, not only
 * inside the leftover sink `v-else` — otherwise Change never settles on
 * `/scenes/example-flowwork-newsletter` and `/scenes/example-sable-friday`.
 */

test.describe("data-source picker on example scenes", () => {
  test("Change article opens the picker on Flowwork newsletter", async ({
    scenePage,
    editorPage,
    page,
  }) => {
    await scenePage.goto("example-flowwork-newsletter");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await editorPage.closeCodeDrawer();
    await editorPage.selectBlockByType("custom");

    await page.getByRole("button", { name: "Change" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Select Featured Article",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Fetching data from endpoint")).toBeVisible();

    await expect(
      dialog.getByRole("button", { name: /Why Most Design Systems Fail/ }),
    ).toBeVisible({ timeout: 5000 });
    await dialog
      .getByRole("button", { name: /Why Most Design Systems Fail/ })
      .click();
    await expect(dialog).toBeHidden();
  });
});
