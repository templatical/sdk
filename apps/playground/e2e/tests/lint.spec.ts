import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

test.describe("Template lint (a11y + structure)", () => {
  test("empty section: warning shows, Fix button is visible and amber, click removes", async ({
    blankEditorReady: { editorPage },
  }) => {
    await editorPage.dragBlockFromSidebar("section");
    expect(await editorPage.getBlocks().count()).toBe(1);

    await editorPage.openIssuesTab();

    const issueRow = editorPage.getIssueRow("structure.empty-section");
    await expect(issueRow).toBeVisible();

    const fixBtn = editorPage.getFixButtonForRule("structure.empty-section");
    await expect(fixBtn).toBeVisible();

    // Guard against the `.tpl button { background: none }` specificity bug.
    // Source code can look correct (class on element, CSS rule in bundle)
    // while the button still computes to transparent because of a
    // descendant-element reset. Only a real browser catches it.
    const bg = await fixBtn.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toBe("transparent");

    await fixBtn.click();
    await expect(editorPage.getBlocks()).toHaveCount(0);
    await expect(issueRow).toHaveCount(0);
  });

  test("a11y rule fires on blank template alongside structure rules", async ({
    blankEditorReady: { editorPage },
  }) => {
    // Blank template has no preheader — a11y.missing-preheader fires at the
    // template level. This verifies that both linter families run through
    // the same composable and show in the same panel.
    await editorPage.dragBlockFromSidebar("section");
    await editorPage.openIssuesTab();

    await expect(
      editorPage.getIssueRow("structure.empty-section"),
    ).toBeVisible();
    await expect(
      editorPage.getIssueRow("a11y.missing-preheader"),
    ).toBeVisible();
  });

  test("Issues tab shows a count badge with the total across categories", async ({
    blankEditorReady: { editorPage },
    page,
  }) => {
    await editorPage.dragBlockFromSidebar("section");
    // structure.empty-section + a11y.missing-preheader = 2 issues total
    const tab = page.locator(SELECTORS.rightTabIssues);
    await tab.waitFor();
    await expect(tab).toContainText(/2/);
  });
});
