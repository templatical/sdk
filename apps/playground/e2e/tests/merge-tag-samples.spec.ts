import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * `MergeTag.sample` — example values rendered in place of a tag on preview
 * surfaces.
 *
 * Driven by the playground's real merge tag config, which is deliberately
 * *partly* sampled: `{{first_name}}` carries `sample: "Ada"` while
 * `{{last_name}}` carries none. The **Order Confirmation** template renders both
 * as adjacent spans in its shipping address, which makes it the one place where
 * both halves of the per-tag rule are visible in a single line — and therefore
 * the only place a browser can prove them.
 *
 * Two invariants carry the feature, and both are asserted below rather than
 * inferred:
 *
 * 1. **Substitution never happens while editing.** The editing canvas shows the
 *    tag the author inserted, never a value they never typed.
 * 2. **The chip is the highlight.** A substituted sample renders with no
 *    `span[data-merge-tag]`, so it reads as ordinary content; a sample-less tag
 *    keeps its span and stays visibly dynamic.
 */

const TEMPLATE = "Order Confirmation";

/** Has `sample: "Ada"` in the playground config. */
const SAMPLED_VALUE = "Ada";
/** `{{last_name}}` has no sample, so it keeps showing this label. */
const UNSAMPLED_LABEL = "Last Name";
/** The label `{{first_name}}` shows whenever it is *not* substituted. */
const SAMPLED_LABEL = "First Name";

test.describe("Merge tag samples", () => {
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

  test("the editing canvas shows labels, never samples", async ({
    editorPage,
  }) => {
    const canvas = editorPage.page.locator(SELECTORS.canvasBody);

    await expect(canvas).toContainText(SAMPLED_LABEL);
    await expect(canvas).not.toContainText(SAMPLED_VALUE);
  });

  test("no mode toggle while editing", async ({ editorPage }) => {
    // The control would be inert on an editable canvas, so it must not render.
    await expect(
      editorPage.page.locator(SELECTORS.mergeTagModeToggle),
    ).toHaveCount(0);
  });

  test("entering preview mode substitutes the sampled tag", async ({
    editorPage,
  }) => {
    const canvas = editorPage.page.locator(SELECTORS.canvasBody);

    await editorPage.togglePreview();

    await expect(canvas).toContainText(SAMPLED_VALUE);
    await expect(canvas).not.toContainText(SAMPLED_LABEL);
  });

  test("the substituted sample loses its chip, the sample-less tag keeps one", async ({
    editorPage,
  }) => {
    const canvas = editorPage.page.locator(SELECTORS.canvasBody);
    const chips = canvas.locator(SELECTORS.mergeTagSpan);

    const chipsWhileEditing = await chips.count();
    expect(chipsWhileEditing).toBeGreaterThan(0);

    await editorPage.togglePreview();
    await expect(canvas).toContainText(SAMPLED_VALUE);

    // Per-tag, not per-mode: some chips survive, and specifically the
    // sample-less one does.
    const remaining = await chips.count();
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThan(chipsWhileEditing);

    await expect(
      canvas.locator(`${SELECTORS.mergeTagSpan}[data-merge-tag="{{last_name}}"]`),
    ).toHaveCount(1);
    await expect(
      canvas.locator(
        `${SELECTORS.mergeTagSpan}[data-merge-tag="{{first_name}}"]`,
      ),
    ).toHaveCount(0);
    // …and the sample-less tag still reads as its label.
    await expect(canvas).toContainText(UNSAMPLED_LABEL);
  });

  test("the toggle appears in preview mode and switches back to labels", async ({
    editorPage,
  }) => {
    const page = editorPage.page;
    const canvas = page.locator(SELECTORS.canvasBody);
    const sampledChips = canvas.locator(
      `${SELECTORS.mergeTagSpan}[data-merge-tag="{{first_name}}"]`,
    );

    // Counted rather than hardcoded: this template happens to render the tag
    // twice, and the invariant is "Label view looks like editing", not any
    // particular number.
    const chipsWhileEditing = await sampledChips.count();
    expect(chipsWhileEditing).toBeGreaterThan(0);

    await editorPage.togglePreview();

    const toggle = page.locator(SELECTORS.mergeTagModeToggle);
    await expect(toggle).toBeVisible();

    const sample = toggle.getByRole("radio").first();
    const label = toggle.getByRole("radio").last();
    // Sample is the default, because the config declares at least one sample.
    await expect(sample).toHaveAttribute("aria-checked", "true");
    await expect(sampledChips).toHaveCount(0);

    await label.click();

    await expect(label).toHaveAttribute("aria-checked", "true");
    await expect(canvas).toContainText(SAMPLED_LABEL);
    await expect(canvas).not.toContainText(SAMPLED_VALUE);
    // Label view restores every chip the editing canvas had.
    await expect(sampledChips).toHaveCount(chipsWhileEditing);
  });

  test("leaving preview mode returns to labels and hides the toggle", async ({
    editorPage,
  }) => {
    const page = editorPage.page;
    const canvas = page.locator(SELECTORS.canvasBody);

    await editorPage.togglePreview();
    await expect(canvas).toContainText(SAMPLED_VALUE);

    await editorPage.togglePreview();

    await expect(canvas).toContainText(SAMPLED_LABEL);
    await expect(canvas).not.toContainText(SAMPLED_VALUE);
    await expect(page.locator(SELECTORS.mergeTagModeToggle)).toHaveCount(0);
  });

  test("the mode choice survives leaving and re-entering preview mode", async ({
    editorPage,
  }) => {
    const page = editorPage.page;
    const canvas = page.locator(SELECTORS.canvasBody);

    await editorPage.togglePreview();
    await page.locator(SELECTORS.mergeTagModeToggle).getByRole("radio").last().click();
    await expect(canvas).toContainText(SAMPLED_LABEL);

    await editorPage.togglePreview();
    await editorPage.togglePreview();

    // Session-scoped: still Label view rather than resetting to Sample.
    await expect(canvas).toContainText(SAMPLED_LABEL);
    await expect(canvas).not.toContainText(SAMPLED_VALUE);
  });

  test("the test-email preview substitutes too, sharing the same choice", async ({
    editorPage,
  }) => {
    const page = editorPage.page;

    await page.locator(SELECTORS.testEmailTrigger).click();
    const preview = page.locator(SELECTORS.blockPreviewCanvas);
    await expect(preview).toBeVisible();

    // The dialog is inherently a preview, so it substitutes with no need to
    // enter the editor's preview mode first.
    await expect(preview).toContainText(SAMPLED_VALUE);
    await expect(preview).toContainText(UNSAMPLED_LABEL);

    const dialogToggle = page
      .locator(SELECTORS.testEmailDialog)
      .locator(SELECTORS.mergeTagModeToggle);
    await expect(dialogToggle).toBeVisible();

    await dialogToggle.getByRole("radio").last().click();
    await expect(preview).toContainText(SAMPLED_LABEL);
    await expect(preview).not.toContainText(SAMPLED_VALUE);
  });

  test("a sample never reaches the MJML export", async ({ editorPage }) => {
    const page = editorPage.page;

    // Substitute on screen first, so this cannot pass by never having rendered
    // a sample in the first place.
    await editorPage.togglePreview();
    await expect(page.locator(SELECTORS.canvasBody)).toContainText(
      SAMPLED_VALUE,
    );

    // `editor.toMjml()` is the real export path — the same output a consumer
    // compiles and sends. This is the strongest form of the display-only
    // guarantee available in a browser.
    const mjml = await page.evaluate(async () => {
      const getMjml = (window as { __tplPlaygroundGetMjml?: () => Promise<string> })
        .__tplPlaygroundGetMjml;
      if (!getMjml) throw new Error("__tplPlaygroundGetMjml is not exposed");
      return getMjml();
    });

    expect(mjml).toContain("{{first_name}}");
    expect(mjml).toContain("{{last_name}}");
    // The value on screen must be absent from what would actually be sent.
    expect(mjml).not.toContain(SAMPLED_VALUE);
  });
});
