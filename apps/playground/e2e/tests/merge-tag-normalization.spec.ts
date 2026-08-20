import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * Merge tag normalization — bare tokens in loaded content become real tags.
 *
 * A merge tag exists in stored content in one of two physical shapes. Anything
 * a user types is already a `<span data-merge-tag>`; content that never passed
 * through the editor's input pipeline — a consumer's stored JSON, an
 * `@templatical/import-*` conversion — holds bare `{{tokens}}`, which on their
 * own are just text: no label, no highlight, no `sample`, and not selectable as
 * a unit. The editor converts them as the template loads, and these tests are
 * what prove it in a real browser.
 *
 * **Order Confirmation**'s "Delivery contact" block is authored in that second
 * shape on purpose (`apps/playground/src/templates.ts`). Every other merge tag
 * in the playground is either already a span or sits inside an `href`, so this
 * is the one fixture that can prove the conversion in a real browser — and the
 * only place the parser is the browser's own rather than a test double.
 *
 * The `href` in the same block is the control. Its token must survive
 * byte-identical: wrapping a token in attribute position would inject a
 * `<span>` into the URL, which is the failure mode the parse-based normalizer
 * makes impossible by construction.
 */

const TEMPLATE = "Order Confirmation";

/** Declared with `sample: "Ada"`. */
const SAMPLED_TOKEN = "{{first_name}}";
/** Declared, deliberately sample-less. */
const UNSAMPLED_TOKEN = "{{last_name}}";
/** Absent from the configured tag list — labelled with its own raw token. */
const UNDECLARED_TOKEN = "{{customer_tier}}";
/** Attribute-position control: must never be wrapped. */
const HREF_TOKEN = "{{unsubscribe_url}}";

/**
 * The fixture block itself, isolated from the rest of the template.
 *
 * Every assertion about *conversion* has to be scoped this way. Order
 * Confirmation renders "First Name" and "Last Name" further up from tags that
 * were authored as spans, so a canvas-wide assertion passes whether or not
 * normalization ran — measured by disabling the hook and watching the test stay
 * green.
 */
function deliveryContact(page: import("@playwright/test").Page) {
  return page
    .locator(SELECTORS.canvasBody)
    .locator("p", { hasText: "member." })
    .last();
}

test.describe("Merge tag normalization", () => {
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

  test("a bare token in visible text becomes a merge tag chip", async ({
    editorPage,
  }) => {
    const line = deliveryContact(editorPage.page);

    await expect(
      line.locator(`${SELECTORS.mergeTagSpan}[data-merge-tag="${SAMPLED_TOKEN}"]`),
    ).toHaveCount(1);
    // The raw token is absent from the rendered text: it is markup now, not text.
    await expect(line).not.toContainText(SAMPLED_TOKEN);
  });

  test("the normalized chips render their configured labels", async ({
    editorPage,
  }) => {
    // Scoped to the fixture block, not the canvas: the shipping address above
    // already renders "First Name" / "Last Name" from tags authored as spans,
    // so a canvas-wide assertion would pass with normalization switched off.
    const line = deliveryContact(editorPage.page);

    await expect(line).toContainText("First Name");
    await expect(line).toContainText("Last Name");
    await expect(line).not.toContainText(SAMPLED_TOKEN);
    await expect(line).not.toContainText(UNSAMPLED_TOKEN);
  });

  // Q5 — matching is syntax-driven, not list-driven, so a migrated template's
  // undeclared tags are made atomic too rather than left as loose text.
  test("an undeclared bare token becomes a chip labelled with its raw token", async ({
    editorPage,
  }) => {
    const canvas = editorPage.page.locator(SELECTORS.canvasBody);
    const chip = canvas.locator(
      `${SELECTORS.mergeTagSpan}[data-merge-tag="${UNDECLARED_TOKEN}"]`,
    );

    await expect(chip).toHaveCount(1);
    await expect(chip).toHaveText(UNDECLARED_TOKEN);
  });

  // F5 — the regression test for the whole approach.
  test("a token in an href is left alone, not wrapped", async ({
    editorPage,
  }) => {
    const canvas = editorPage.page.locator(SELECTORS.canvasBody);
    const link = canvas.getByRole("link", { name: "Manage notifications" });

    await expect(link).toHaveAttribute("href", HREF_TOKEN);
    // No chip was created for it, and no markup leaked into the URL.
    await expect(
      canvas.locator(`${SELECTORS.mergeTagSpan}[data-merge-tag="${HREF_TOKEN}"]`),
    ).toHaveCount(0);
    expect(await link.getAttribute("href")).not.toContain("<span");
  });

  test("a normalized tag is selected and deleted as one unit", async ({
    editorPage,
  }) => {
    const canvas = editorPage.page.locator(SELECTORS.canvasBody);
    const chip = canvas.locator(
      `${SELECTORS.mergeTagSpan}[data-merge-tag="${UNDECLARED_TOKEN}"]`,
    );
    await expect(chip).toHaveCount(1);

    // Click the paragraph to enter the rich-text editor, then the chip itself:
    // a merge tag is an atomic node, so clicking selects the whole node and a
    // single Backspace removes it entirely — the behaviour a bare token lacks.
    await chip.click();
    await editorPage.page.keyboard.press("Backspace");

    await expect(chip).toHaveCount(0);
  });

  test("Sample view substitutes the normalized sampled tag and keeps the sample-less one", async ({
    editorPage,
  }) => {
    await editorPage.togglePreview();

    // Scoped to the fixture block for the same reason as above — the sampled
    // and sample-less pair also appears in the shipping address.
    const line = deliveryContact(editorPage.page);

    // `{{first_name}}` has a sample, so it is unwrapped to plain text. Reaching
    // Sample view at all is the proof: a bare token has no sample to resolve.
    await expect(line).toContainText("Ada");
    await expect(
      line.locator(`${SELECTORS.mergeTagSpan}[data-merge-tag="${SAMPLED_TOKEN}"]`),
    ).toHaveCount(0);

    // `{{last_name}}` has none, so it stays a highlighted chip showing its label.
    await expect(
      line.locator(
        `${SELECTORS.mergeTagSpan}[data-merge-tag="${UNSAMPLED_TOKEN}"]`,
      ),
    ).toHaveCount(1);
    await expect(line).toContainText("Last Name");
  });

  // F4 — normalization changes the stored shape, never the output. The token,
  // not the label, is what a send receives.
  test("the export carries the tokens, not the labels", async ({
    editorPage,
  }) => {
    const page = editorPage.page;
    await page.waitForFunction(
      () =>
        typeof (window as { __tplPlaygroundGetMjml?: () => Promise<string> })
          .__tplPlaygroundGetMjml === "function",
    );
    const mjml = await page.evaluate(() =>
      (
        window as { __tplPlaygroundGetMjml?: () => Promise<string> }
      ).__tplPlaygroundGetMjml!(),
    );

    expect(mjml).toContain(SAMPLED_TOKEN);
    expect(mjml).toContain(UNDECLARED_TOKEN);
    expect(mjml).toContain(`href="${HREF_TOKEN}"`);
    expect(mjml).not.toContain("data-merge-tag");
  });
});
