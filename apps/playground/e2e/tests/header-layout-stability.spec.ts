import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * The header's three view controls must not move, ever.
 *
 * `EditorHeader`'s grid is `1fr auto 1fr`. The centre track is exactly
 * max-content wide and the equal `fr` columns centre it, so **any** width
 * change there redistributes symmetrically about the header's centre and moves
 * every sibling by half the delta — whichever side of the change it sits on.
 * DOM order buys nothing.
 *
 * Entering preview mode used to add a 189px sample/label toggle plus a 40px
 * gap to that track, so Viewport, DarkMode and Preview each jumped 114.5px
 * left. Re-clicking Preview to leave the mode meant hunting for a button half
 * a toggle's width from where it had just been (#574).
 *
 * **Order Confirmation is the template that can prove this.** The toggle only
 * renders when some configured merge tag declares a `sample`, and this is the
 * playground's Sample/Label showcase. On a template that never shows the
 * toggle, nothing changes width and every assertion below passes for the wrong
 * reason — which is why each test asserts the toggle is actually on screen
 * before checking that nothing moved.
 */

const TEMPLATE = "Order Confirmation";

/** Horizontal centre of an element, or null when it isn't rendered. */
async function centreX(
  page: import("@playwright/test").Page,
  selector: string,
): Promise<number | null> {
  const box = await page.locator(selector).boundingBox();
  return box ? box.x + box.width / 2 : null;
}

test.describe("header layout stability", () => {
  test.beforeEach(async ({ page, chooserPage, editorPage }) => {
    // Set before any page JS runs, or the onboarding overlay intercepts the
    // template-card click.
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectTemplateByName(TEMPLATE);
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
  });

  test("the preview button holds its position across a preview toggle", async ({
    page,
    editorPage,
  }) => {
    const before = await centreX(page, SELECTORS.previewToggle);
    expect(before).not.toBeNull();

    await editorPage.togglePreview();

    // Non-vacuity: the control whose arrival used to shift the header is
    // genuinely on screen. Without this the test passes on a template that
    // never renders it.
    await expect(page.locator(SELECTORS.mergeTagModeToggle)).toBeVisible();

    expect(await centreX(page, SELECTORS.previewToggle)).toBe(before);

    // And back — the same click target both ways.
    await editorPage.togglePreview();
    await expect(page.locator(SELECTORS.mergeTagModeToggle)).toBeHidden();
    expect(await centreX(page, SELECTORS.previewToggle)).toBe(before);
  });

  test("the whole centre track holds its position", async ({
    page,
    editorPage,
  }) => {
    // Preview is the button a user re-clicks at speed, but the other two are
    // click targets as well and the track moves as one.
    const before = {
      viewport: await centreX(page, SELECTORS.viewportGroup),
      darkMode: await centreX(page, SELECTORS.darkModeToggle),
      preview: await centreX(page, SELECTORS.previewToggle),
    };
    expect(Object.values(before).every((x) => x !== null)).toBe(true);

    await editorPage.togglePreview();
    await expect(page.locator(SELECTORS.mergeTagModeToggle)).toBeVisible();

    expect({
      viewport: await centreX(page, SELECTORS.viewportGroup),
      darkMode: await centreX(page, SELECTORS.darkModeToggle),
      preview: await centreX(page, SELECTORS.previewToggle),
    }).toEqual(before);
  });

  test("the sample/label toggle renders over the canvas, below the header", async ({
    page,
    editorPage,
  }) => {
    await editorPage.togglePreview();

    const toggle = page.locator(SELECTORS.mergeTagModeToggle);
    await expect(toggle).toBeVisible();

    const header = await page.locator(SELECTORS.editorHeader).boundingBox();
    const box = await toggle.boundingBox();
    expect(header).not.toBeNull();
    expect(box).not.toBeNull();

    // Clear of the header entirely — this is what makes its width irrelevant
    // to the centre track.
    expect(box!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
  });

  test("the sample/label toggle never renders while editing", async ({
    page,
  }) => {
    // Asserted before preview is ever entered, not just after leaving it: the
    // switch substitutes merge tags, which never happens on the editing canvas.
    await expect(page.locator(SELECTORS.mergeTagModeToggle)).toBeHidden();
  });
});

/**
 * The two pills that share the canvas overlay have to read as one family.
 *
 * They stack whenever both apply, and they arrived as different species: the
 * restore pill was hand-rolled at 30px with `rounded-full` and a filled amber
 * surface, against the switch's 38px `--tpl-radius-sm` box. It now uses the
 * shared `warningBtnCompactClass`, so the geometry cannot drift again without
 * the recipe changing for every caller.
 */
test.describe("preview overlay pills are one family", () => {
  test.beforeEach(async ({ page, chooserPage, editorPage }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tpl-playground-onboarding-dismissed", "true");
      localStorage.setItem("tpl-playground-features-dismissed", "true");
    });
    await chooserPage.goto();
    await chooserPage.selectTemplateByName(TEMPLATE);
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
  });

  /** Gives the second block a display condition and hides it. */
  async function hideSecondBlock(editorPage: {
    page: import("@playwright/test").Page;
    selectBlock: (i: number) => Promise<void>;
  }) {
    const page = editorPage.page;
    await editorPage.selectBlock(1);
    const blockId = await page
      .locator(SELECTORS.block)
      .nth(1)
      .getAttribute("data-block-id");
    const block = page.locator(`[data-block-id="${blockId}"]`);

    // The section is collapsed by default and its contents are `v-show`n.
    await page.locator(SELECTORS.displayConditionSection).click();
    const select = page.locator(SELECTORS.displayConditionSelect);
    await expect(select).toBeVisible();
    await select.selectOption({ label: "VIP Partners" });

    const toggle = block.locator(SELECTORS.conditionToggle);
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator(SELECTORS.restoreHiddenBlocks)).toBeVisible();
  }

  /**
   * Both pills animate in under `scale(0.9)`, and `boundingBox()` reports the
   * *transformed* box — so measuring geometry before the transform settles reads
   * 90% of the truth. Waits for it rather than sleeping.
   */
  async function settled(
    page: import("@playwright/test").Page,
    ...selectors: string[]
  ) {
    // Read through the locator, not `document.querySelector`: in the shadow-DOM
    // project these live inside a shadow root, which a raw document query does
    // not reach — it would poll `null` until the timeout.
    await expect
      .poll(async () => {
        const transforms = await Promise.all(
          selectors.map((s) =>
            page.locator(s).evaluate((el) => getComputedStyle(el).transform),
          ),
        );
        return transforms.every((t) => t === "none");
      })
      .toBe(true);
  }

  test("the restore pill sits at the top of the canvas while editing", async ({
    page,
    editorPage,
  }) => {
    // The regression this guards: pinning the pill 48px down so it could stack
    // under the switch left it there when it rendered alone, and in editing
    // mode — where the switch never shows — that dropped it onto the first
    // block's content. It floats *over* the canvas by design, so the test is
    // "does it start above the card", not "does it avoid the card entirely".
    await hideSecondBlock(editorPage);
    await settled(page, SELECTORS.restoreHiddenBlocks);

    const pill = await page
      .locator(SELECTORS.restoreHiddenBlocks)
      .boundingBox();
    const header = await page.locator(SELECTORS.editorHeader).boundingBox();
    const firstBlock = await page.locator(SELECTORS.block).first().boundingBox();

    // Tucked under the header rather than pushed down into the content.
    const offsetBelowHeader = pill!.y - (header!.y + header!.height);
    expect(offsetBelowHeader).toBeGreaterThanOrEqual(0);
    expect(offsetBelowHeader).toBeLessThanOrEqual(12);

    // Starts above the canvas card. At the old 56px offset it started below it.
    expect(pill!.y).toBeLessThan(firstBlock!.y);
  });

  /**
   * Offset geometry, not `boundingBox()`. `offsetTop`/`offsetHeight` are layout
   * values and ignore transforms entirely, so the `scale(0.9)` entrance cannot
   * skew them — no waiting, nothing to race. Both pills share an offsetParent
   * (the positioned column), so their offsets are directly comparable.
   */
  async function offsetBox(
    page: import("@playwright/test").Page,
    selector: string,
  ) {
    return page.locator(selector).evaluate((el) => {
      const e = el as HTMLElement;
      return {
        top: e.offsetTop,
        height: e.offsetHeight,
        centre: e.offsetLeft + e.offsetWidth / 2,
      };
    });
  }

  test("both pills share a height and a centre line when stacked", async ({
    page,
    editorPage,
  }) => {
    await hideSecondBlock(editorPage);
    await editorPage.togglePreview();
    await expect(page.locator(SELECTORS.mergeTagModeToggle)).toBeVisible();

    const sw = await offsetBox(page, SELECTORS.mergeTagModeToggle);
    const pill = await offsetBox(page, SELECTORS.restoreHiddenBlocks);

    // The whole point of the shared recipe: same box, so they read as siblings.
    // 38px both — the pill was 30px and `rounded-full` before.
    expect(pill.height).toBe(sw.height);
    expect(pill.centre).toBeCloseTo(sw.centre, 0);

    // Stacked, switch first, and genuinely clear of each other.
    expect(pill.top).toBeGreaterThanOrEqual(sw.top + sw.height);
  });

  test("the restore pill wears the amber on its border, not its label", async ({
    page,
    editorPage,
  }) => {
    // `--tpl-warning` as a label on `--tpl-bg` is 2.11:1; the muted label is
    // 5.93:1. The fill it replaced was 1.85:1.
    await hideSecondBlock(editorPage);

    const styles = await page
      .locator(SELECTORS.restoreHiddenBlocks)
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        // A raw custom property keeps its authored form (`76.9%`) while a
        // computed colour is normalised (`0.769`), so the token has to be
        // resolved *as a colour* to be comparable. A probe beside the pill
        // inherits the same cascade, including the dark-mode overrides.
        const probe = document.createElement("span");
        el.parentElement!.appendChild(probe);
        const resolve = (token: string) => {
          probe.style.color = `var(${token})`;
          return getComputedStyle(probe).color;
        };
        const out = {
          border: cs.borderTopColor,
          background: cs.backgroundColor,
          color: cs.color,
          warning: resolve("--tpl-warning"),
          bg: resolve("--tpl-bg"),
          textMuted: resolve("--tpl-text-muted"),
        };
        probe.remove();
        return out;
      });

    // Resolved against the live tokens, so this fails if the skin is rewired
    // rather than merely if a literal changes.
    expect(styles.border).toBe(styles.warning);
    expect(styles.background).toBe(styles.bg);
    expect(styles.color).toBe(styles.textMuted);
    expect(styles.color).not.toBe(styles.warning);
  });
});
