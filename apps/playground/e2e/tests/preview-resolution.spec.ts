import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * `resolvePreview` — the consumer hook that resolves a template for preview,
 * primarily by **evaluating logic tags**, which `MergeTag.sample` cannot do.
 *
 * Driven by the playground's demo resolver (`resolvePreviewDemo` in
 * `apps/playground/src/App.vue`): it waits ~400ms, strips falsy `{% if %}`
 * blocks, and substitutes value tags from a per-recipient fake record. The delay
 * is what makes the skeleton and the debounce observable without a backend.
 *
 * What only a browser can prove here:
 *
 * 1. Entering preview mode swaps in resolved content, and **leaving restores the
 *    unresolved template** — the editing canvas is never resolved.
 * 2. Resolution **supersedes samples**, so the Sample/Label toggle disappears.
 * 3. A resolved value reaches the screen but **never the MJML export**.
 */

const TEMPLATE = "Welcome Email";

/**
 * The demo resolver's `{{first_name}}` for the default recipient.
 *
 * Deliberately **not** the tag's `sample` ("Ada"): if it were, every assertion
 * here could be satisfied by sample substitution and would prove nothing about
 * resolution. The playground's fake data is chosen to keep the two distinct.
 */
const RESOLVED = "Grace";
/** What the same tag resolves to for the second allowed recipient. */
const RESOLVED_OTHER = "Marie";
/** The tag's sample value — what shows in Sample view, *without* a resolver. */
const SAMPLE = "Ada";
/** The label `{{first_name}}` shows on the editing canvas. */
const LABEL = "First Name";
/**
 * The fake data sets `plan_name` to "pro", so of the template's two mutually
 * exclusive `{% if plan_name == … %}` arms this one must survive…
 */
const KEPT_BRANCH = "Pro tip";
/** …and this one must be evaluated away. */
const DROPPED_BRANCH = "Want more features";

test.describe("Preview resolution", () => {
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

  test("the editing canvas is never resolved", async ({ editorPage }) => {
    const page = editorPage.page;
    const canvas = page.locator(SELECTORS.canvasBody);

    // Prove resolution *works* first, so this can't pass merely because the
    // resolver is broken or was never called. Entering and leaving preview mode
    // also guarantees enough time has elapsed for a resolve to have landed —
    // asserting immediately after mount would pass while the debounce was still
    // pending, which is exactly how an earlier version of this test was vacuous.
    await editorPage.togglePreview();
    await expect(canvas).toContainText(RESOLVED);
    await editorPage.togglePreview();

    await expect(canvas).toContainText(LABEL);
    await expect(canvas).not.toContainText(RESOLVED);
    // Chips are back, so the author edits the tag they inserted.
    await expect(canvas.locator(SELECTORS.mergeTagSpan).first()).toBeVisible();
  });

  test("resolution removes logic tags — the thing samples can never do", async ({
    editorPage,
  }) => {
    const page = editorPage.page;
    const canvas = page.locator(SELECTORS.canvasBody);
    const logicBadges = canvas.locator("span[data-logic-merge-tag]");

    // The Welcome Email wraps content in `{% if plan_name == 'pro' %}` blocks.
    const badgesWhileEditing = await logicBadges.count();
    expect(badgesWhileEditing).toBeGreaterThan(0);

    await editorPage.togglePreview();
    await expect(canvas).toContainText(RESOLVED);

    // Evaluated away entirely. Substitution cannot do this, so this assertion
    // is the one that can only be satisfied by `resolvePreview`.
    await expect(logicBadges).toHaveCount(0);

    // Badges disappearing is NOT sufficient on its own — it stays true if the
    // resolver wrongly drops *every* branch, which is exactly the bug this
    // template exposed (a condition matcher that only accepted entity-encoded
    // quotes made both arms evaluate falsy and the block render empty). So
    // assert the branch that should win survives and the other does not.
    await expect(canvas).toContainText(KEPT_BRANCH);
    await expect(canvas).not.toContainText(DROPPED_BRANCH);
  });

  test("a resolved value is not the sample value", async ({ editorPage }) => {
    // Guards the discriminator itself: if the playground's fake data ever drifted
    // to match a `sample`, the rest of this spec would silently stop testing
    // resolution.
    const page = editorPage.page;
    const canvas = page.locator(SELECTORS.canvasBody);

    await editorPage.togglePreview();

    await expect(canvas).toContainText(RESOLVED);
    await expect(canvas).not.toContainText(SAMPLE);
  });

  /**
   * The first-resolve skeleton is deliberately **not** asserted here.
   *
   * Its visibility window is the debounce (500ms) plus the demo resolver's
   * latency (~400ms) — about 350ms. Under parallel workers the gap between the
   * preview click returning and the first assertion poll can exceed that, so the
   * window is already gone and the check fails consistently rather than flakily.
   * Measured: skeleton present 528–880ms after the click when the spec runs
   * alone; missed entirely under load.
   *
   * Racing a transient window is what the repo's flakiness rules forbid, and
   * slowing the playground resolver to widen it would put a test-only delay in
   * front of visitors. `isInitialResolve` is instead covered deterministically
   * with fake timers in `packages/editor/tests/usePreviewResolution.test.ts`
   * ("asks for a skeleton only on a first resolve" and "keeps the previous result
   * during a re-resolve").
   */
  test("swaps in resolved content once resolution completes", async ({
    editorPage,
  }) => {
    const page = editorPage.page;

    await editorPage.togglePreview();

    await expect(page.locator(SELECTORS.canvasBody)).toContainText(RESOLVED);
    // And the skeleton is gone by the time content is showing.
    await expect(page.locator(SELECTORS.previewResolutionLoading)).toHaveCount(
      0,
    );
  });

  test("never flashes edit-like content before resolving", async ({
    editorPage,
  }) => {
    const page = editorPage.page;

    await editorPage.togglePreview();

    // A single synchronous read straight after the click — no polling, so this
    // can't pass by waiting out a flash. Whatever frame it lands on must be the
    // skeleton or resolved content; the unresolved label must never be *visible*.
    //
    // `innerText`, not `textContent`: the block list is hidden with `v-show`
    // while a first resolve is outstanding, so it stays in the DOM under
    // `display: none` and `textContent` would report the label either way —
    // which made an earlier version of this assertion pass unconditionally.
    const firstFrame = await page.evaluate(() => {
      const el = document.querySelector(".tpl-body");
      return el instanceof HTMLElement ? el.innerText : "";
    });
    expect(firstFrame).not.toContain(LABEL);

    await expect(page.locator(SELECTORS.canvasBody)).toContainText(RESOLVED);
  });

  test("resolved content carries no merge tag chips", async ({ editorPage }) => {
    const page = editorPage.page;
    const canvas = page.locator(SELECTORS.canvasBody);

    await editorPage.togglePreview();
    await expect(canvas).toContainText(RESOLVED);

    // The resolver replaced the spans outright, so nothing reads as a token.
    await expect(canvas.locator(SELECTORS.mergeTagSpan)).toHaveCount(0);
    await expect(canvas).not.toContainText(LABEL);
  });

  test("resolution supersedes samples, so the Sample/Label toggle hides", async ({
    editorPage,
  }) => {
    const page = editorPage.page;

    await editorPage.togglePreview();
    await expect(page.locator(SELECTORS.canvasBody)).toContainText(RESOLVED);

    // The toggle exists for choosing between example data and field names;
    // with real resolved data neither is what's rendering.
    await expect(page.locator(SELECTORS.mergeTagModeToggle)).toHaveCount(0);
  });

  test("leaving preview mode restores the unresolved template", async ({
    editorPage,
  }) => {
    const page = editorPage.page;
    const canvas = page.locator(SELECTORS.canvasBody);

    await editorPage.togglePreview();
    await expect(canvas).toContainText(RESOLVED);

    await editorPage.togglePreview();

    await expect(canvas).toContainText(LABEL);
    await expect(canvas).not.toContainText(RESOLVED);
    // And the chips are back, so the author edits the tag they inserted.
    await expect(canvas.locator(SELECTORS.mergeTagSpan).first()).toBeVisible();
  });

  test("re-entering preview mode resolves again", async ({ editorPage }) => {
    const page = editorPage.page;
    const canvas = page.locator(SELECTORS.canvasBody);

    await editorPage.togglePreview();
    await expect(canvas).toContainText(RESOLVED);
    await editorPage.togglePreview();
    await expect(canvas).toContainText(LABEL);

    await editorPage.togglePreview();

    await expect(canvas).toContainText(RESOLVED);
  });

  test("the test-email preview resolves for the selected recipient", async ({
    editorPage,
  }) => {
    const page = editorPage.page;

    await page.locator(SELECTORS.testEmailTrigger).click();
    const preview = page.locator(SELECTORS.blockPreviewCanvas);
    await expect(preview).toBeVisible();

    // Distinct per recipient, so switching visibly re-resolves.
    await expect(preview).toContainText(RESOLVED);

    await page
      .locator(SELECTORS.testEmailRecipient)
      .selectOption("teammate@example.com");

    await expect(preview).toContainText(RESOLVED_OTHER);
    await expect(preview).not.toContainText(RESOLVED);
  });

  test("a resolved value never reaches the MJML export", async ({
    editorPage,
  }) => {
    const page = editorPage.page;

    // Resolve on screen first, so this can't pass by never having resolved.
    await editorPage.togglePreview();
    await expect(page.locator(SELECTORS.canvasBody)).toContainText(RESOLVED);

    const mjml = await page.evaluate(async () => {
      const getMjml = (
        window as { __tplPlaygroundGetMjml?: () => Promise<string> }
      ).__tplPlaygroundGetMjml;
      if (!getMjml) throw new Error("__tplPlaygroundGetMjml is not exposed");
      return getMjml();
    });

    // The export path carries the real token, never the resolved value.
    expect(mjml).toContain("{{first_name}}");
    expect(mjml).not.toContain(RESOLVED);
  });

  /**
   * The hand-toggled display-condition filter versus a resolver that evaluates
   * conditions for real. Both act on the same canvas, so without a rule the
   * manual hide silently vetoed the resolver's answer — and the restore button
   * stayed up claiming blocks were hidden while the preview showed them.
   *
   * Anchored on `data-block-id` rather than block text: the resolver rewrites
   * content, so a text assertion could pass or fail for reasons that have
   * nothing to do with the filter.
   */
  test.describe("a resolver owns display conditions", () => {
    /**
     * Puts a display condition on the second block and hides it by hand,
     * returning a locator for that specific block.
     */
    async function hideSecondBlockByCondition(editorPage: {
      page: import("@playwright/test").Page;
      selectBlock: (i: number) => Promise<void>;
    }) {
      const page = editorPage.page;

      await editorPage.selectBlock(1);
      const blockId = await page
        .locator(SELECTORS.block)
        .nth(1)
        .getAttribute("data-block-id");
      expect(blockId).toBeTruthy();
      const block = page.locator(`[data-block-id="${blockId}"]`);

      await page
        .locator(SELECTORS.displayConditionSelect)
        .selectOption({ label: "VIP Partners" });

      // The filter icon only exists once the block carries a condition.
      const toggle = block.locator(SELECTORS.conditionToggle);
      await expect(toggle).toBeVisible();
      await toggle.click();

      await expect(block).toBeHidden();
      await expect(page.locator(SELECTORS.restoreHiddenBlocks)).toBeVisible();

      return block;
    }

    test("the filter and its restore button step aside once resolved content shows", async ({
      editorPage,
    }) => {
      const page = editorPage.page;
      const block = await hideSecondBlockByCondition(editorPage);

      await editorPage.togglePreview();
      // Wait for the resolver to land, so this cannot pass off the skeleton.
      await expect(page.locator(SELECTORS.canvasBody)).toContainText(RESOLVED);

      // The resolver decided what this recipient sees; the manual hide must not
      // override it, and the button that undoes it must not outlive it.
      await expect(block).toBeVisible();
      await expect(page.locator(SELECTORS.restoreHiddenBlocks)).toBeHidden();
    });

    test("leaving the preview restores the hidden block, so nothing was discarded", async ({
      editorPage,
    }) => {
      const page = editorPage.page;
      const block = await hideSecondBlockByCondition(editorPage);

      await editorPage.togglePreview();
      await expect(page.locator(SELECTORS.canvasBody)).toContainText(RESOLVED);
      await expect(block).toBeVisible();

      await editorPage.togglePreview();

      // This is what separates suppressing the filter from resetting it: a view
      // toggle must not throw away the user's simulation.
      await expect(block).toBeHidden();
      await expect(page.locator(SELECTORS.restoreHiddenBlocks)).toBeVisible();
    });

    test("the restore button still works while editing", async ({
      editorPage,
    }) => {
      // Positive control for the two tests above: if the filter were suppressed
      // unconditionally rather than only under a resolver, this would fail.
      const page = editorPage.page;
      const block = await hideSecondBlockByCondition(editorPage);

      await page.locator(SELECTORS.restoreHiddenBlocks).click();

      await expect(block).toBeVisible();
      await expect(page.locator(SELECTORS.restoreHiddenBlocks)).toBeHidden();
    });
  });
});
