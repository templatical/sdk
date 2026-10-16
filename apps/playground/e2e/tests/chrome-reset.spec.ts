import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";
import { animationsFinished } from "../helpers/motion";

/**
 * The editor chrome renders with the box model and typography it was designed
 * against: the scoped copy of Tailwind's preflight in `styles/index.css`.
 * Without it a real install showed browser defaults: dialog panels overrunning
 * their size caps by their padding, UA margins on titles and help text, and
 * buttons in the browser's 13.33px font.
 *
 * Both DOM modes run these. A light-DOM mount also sits under the playground
 * document's own preflight, which sets the same values.
 */

test.describe("editor chrome keeps its designed box model", () => {
  test("a dialog panel keeps its padding inside its size caps", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("test-email");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await page.locator(SELECTORS.testEmailTrigger).click();
    const panel = page.locator(SELECTORS.testEmailDialog);
    await expect(panel).toBeVisible();
    await animationsFinished(panel);

    const fit = await panel.evaluate((el) => {
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return {
        boxSizing: style.boxSizing,
        overWidth: box.width - parseFloat(style.maxWidth),
        // `max-h-[90%]` resolves against the wrapper the panel sits in.
        overHeight: box.height - el.parentElement!.clientHeight * 0.9,
      };
    });

    expect(fit.boxSizing).toBe("border-box");
    expect(fit.overWidth).toBeLessThanOrEqual(0);
    expect(fit.overHeight).toBeLessThanOrEqual(0.5);
  });

  test("titles and help text carry no browser margins", async ({
    page,
    scenePage,
    editorPage,
  }) => {
    await scenePage.goto("saved-blocks");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
    await page.locator(SELECTORS.savedBlocksRailBtn).click();
    const title = page.locator(SELECTORS.savedBlocksBrowserTitle);
    await expect(title).toBeVisible();

    expect(
      await title.evaluate((el) => {
        const style = getComputedStyle(el);
        return [style.marginTop, style.marginBottom];
      }),
    ).toEqual(["0px", "0px"]);

    await page.keyboard.press("Escape");
    await editorPage.openSettingsTab();
    // Its only margin is the `tpl:mt-1` above it.
    const hint = page.locator('[data-testid="template-settings-locale"] p');
    expect(
      await hint.evaluate((el) => {
        const style = getComputedStyle(el);
        return [style.marginTop, style.marginBottom];
      }),
    ).toEqual(["4px", "0px"]);
  });

  test("form controls use the editor's font, not the browser's", async ({
    page,
    editorReady: { editorPage },
  }) => {
    await editorPage.openSettingsTab();

    const browserFont = await page
      .locator(SELECTORS.rightSidebar)
      .evaluate((sidebar) => {
        const controls = Array.from(
          sidebar
            .getRootNode()
            .querySelectorAll("button, input, select, textarea"),
        ).filter(
          (el) =>
            !el.closest(".tpl-email-surface") &&
            el.getBoundingClientRect().width > 0,
        );
        return {
          checked: controls.length,
          offenders: controls
            .filter((el) => {
              const style = getComputedStyle(el);
              // Chromium computes `line-height: normal` for a `<select>`
              // whatever the author CSS says, inline styles included.
              const browserLineHeight =
                style.lineHeight === "normal" && el.tagName !== "SELECT";
              return style.fontSize === "13.3333px" || browserLineHeight;
            })
            .map((el) => el.outerHTML.slice(0, 120)),
        };
      });

    // Guard against a selector that silently matches nothing.
    expect(browserFont.checked).toBeGreaterThan(20);
    expect(browserFont.offenders).toEqual([]);
  });

  test("the Tips list keeps its markers", async ({
    page,
    editorReady: { editorPage },
  }) => {
    await editorPage.openSettingsTab();
    const tips = page.locator('[data-testid="template-settings-card-tips"] ul');

    expect(
      await tips.evaluate((el) => getComputedStyle(el).listStyleType),
    ).toBe("disc");
  });
});
