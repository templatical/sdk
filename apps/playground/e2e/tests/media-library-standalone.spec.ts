import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";
import { animationsFinished } from "../helpers/motion";

/**
 * The standalone media library (`init()` from `@templatical/media-library`)
 * renders with the box model and typography it was designed against on a
 * host with no CSS reset. It mounts in the host document and loads only its
 * own stylesheet, which carries the editor's scoped chrome reset plus
 * `tpl:box-border` on its root. Without them it showed browser defaults:
 * dialog panels overrunning `max-w-sm` by their padding, UA margins on titles
 * and `<p>`s, buttons in the browser's 13.33px font and padding, a root 2px
 * larger than its container.
 *
 * `e2e/hosts/standalone-media-library.html` is the bare host. It can't be a
 * playground route: the playground's document carries Tailwind's preflight,
 * which sets the same values and would let every check here pass without the
 * fix.
 */

async function openStandalone(page: Page): Promise<Locator> {
  await page.goto("/e2e/hosts/standalone-media-library.html");
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __mediaReady?: boolean }).__mediaReady),
  );
  await expect(
    page.locator('[data-testid="media-library-item"]').first(),
  ).toBeVisible();
  return page.locator("#media > .tpl");
}

async function margins(locator: Locator): Promise<string[]> {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return [style.marginTop, style.marginBottom];
  });
}

/** A dialog panel's overrun of its own `max-width`, in px (≤ 0 fits). */
async function overrun(panel: Locator) {
  await animationsFinished(panel);
  return panel.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      boxSizing: style.boxSizing,
      overWidth: el.getBoundingClientRect().width - parseFloat(style.maxWidth),
    };
  });
}

test.describe("standalone media library on a host without a CSS reset", () => {
  test.skip(
    ({ shadowDom }) => shadowDom,
    "standalone mounts in the host document; the editor's mount mode doesn't apply",
  );

  test("the host page really has no reset", async ({ page }) => {
    await openStandalone(page);
    // Guard against an oracle that a preflight on the page would satisfy.
    expect(await margins(page.locator("#host-probe"))).toEqual([
      "16px",
      "16px",
    ]);
  });

  test("the root fits its container, border included", async ({ page }) => {
    const root = await openStandalone(page);
    const [rootBox, containerBox] = await Promise.all([
      root.boundingBox(),
      page.locator("#media").boundingBox(),
    ]);

    expect(rootBox).toEqual(containerBox);
  });

  test("titles and captions carry no browser margins", async ({ page }) => {
    await openStandalone(page);

    expect(await margins(page.locator("#tpl-media-library-title"))).toEqual([
      "0px",
      "0px",
    ]);
    const caption = page
      .locator('[data-testid="media-library-item"]')
      .first()
      .locator("p");
    await expect(caption).toHaveCount(2);
    for (const p of await caption.all()) {
      expect(await margins(p)).toEqual(["0px", "0px"]);
    }
  });

  test("the delete warning keeps its padding inside its size cap", async ({
    page,
  }) => {
    await openStandalone(page);
    await page.locator('[data-testid="media-library-item"]').first().click();
    await page.locator('[data-testid="media-delete"]').click();
    const title = page.locator("#tpl-media-delete-title");
    await expect(title).toBeVisible();

    const fit = await overrun(title.locator(".."));
    expect(fit.boxSizing).toBe("border-box");
    expect(fit.overWidth).toBeLessThanOrEqual(0);
    // Its only margin is the `tpl:mb-2` below it.
    expect(await margins(title)).toEqual(["0px", "8px"]);
  });

  test("the import dialog keeps its padding inside its size cap", async ({
    page,
  }) => {
    await openStandalone(page);
    await page.locator('[data-testid="media-import-url"]').click();
    const panel = page.locator('[aria-labelledby="tpl-media-import-title"]');
    await expect(panel).toBeVisible();

    const fit = await overrun(panel);
    expect(fit.boxSizing).toBe("border-box");
    expect(fit.overWidth).toBeLessThanOrEqual(0);
  });

  test("the replace dialog fits its cap, and its file input adds no browser chrome", async ({
    page,
  }) => {
    await openStandalone(page);
    const item = page.locator('[data-testid="media-library-item"]').first();
    await item.hover();
    await item.locator('[data-testid="media-replace"]').click();
    const panel = page.locator('[aria-labelledby="tpl-media-replace-title"]');
    await expect(panel).toBeVisible();

    const fit = await overrun(panel);
    expect(fit.boxSizing).toBe("border-box");
    expect(fit.overWidth).toBeLessThanOrEqual(0);

    // The file input is exactly its line box plus padding and border: the
    // browser's file-selector button adds no margin or padding of its own.
    const input = await panel.locator('input[type="file"]').evaluate((el) => {
      const style = getComputedStyle(el);
      const px = (value: string) => parseFloat(value);
      return {
        height: el.getBoundingClientRect().height,
        expected:
          px(style.lineHeight) +
          px(style.paddingTop) +
          px(style.paddingBottom) +
          px(style.borderTopWidth) +
          px(style.borderBottomWidth),
      };
    });
    expect(input.height).toBe(input.expected);
  });

  test("the folder tree fits its rail and draws its chevron whole", async ({
    page,
  }) => {
    await openStandalone(page);
    await page.locator('[data-testid="media-folder-toggle"]').click();
    const tree = page.locator('[data-testid="media-folder-tree"]');
    await expect(tree).toBeVisible();

    expect(await tree.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(
      0,
    );
    const chevron = await tree
      .locator("button[aria-expanded] svg")
      .first()
      .boundingBox();
    expect([chevron?.width, chevron?.height]).toEqual([10, 10]);
  });

  test("controls use the library's font, not the browser's", async ({
    page,
  }) => {
    const root = await openStandalone(page);
    await page.locator('[data-testid="media-folder-toggle"]').click();
    await expect(
      page.locator('[data-testid="media-folder-tree"]'),
    ).toBeVisible();

    const browserFont = await root.evaluate((el) => {
      const controls = Array.from(
        el.querySelectorAll("button, input, select, textarea"),
      ).filter((control) => control.getBoundingClientRect().width > 0);
      return {
        checked: controls.length,
        offenders: controls
          .filter((control) => {
            const style = getComputedStyle(control);
            // Chromium computes `line-height: normal` for a `<select>`
            // whatever the author CSS says, inline styles included.
            const browserLineHeight =
              style.lineHeight === "normal" && control.tagName !== "SELECT";
            return style.fontSize === "13.3333px" || browserLineHeight;
          })
          .map((control) => control.outerHTML.slice(0, 120)),
      };
    });

    // Guard against a selector that silently matches nothing.
    expect(browserFont.checked).toBeGreaterThan(10);
    expect(browserFont.offenders).toEqual([]);
  });
});
