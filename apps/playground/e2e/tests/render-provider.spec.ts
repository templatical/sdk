import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * Browser-level coverage for the render provider's **`compileMjml` tier**.
 *
 * The unit suites pin the resolution ladders in isolation (`renderProvider.test.ts`)
 * and the two Cloud adapters against a mocked `ApiClient`. What only a real browser
 * proves is the tier the whole three-method contract exists for: a consumer with no
 * Node backend wires up **one** function, the SDK still renders the MJML itself, and
 * `editor.toHtml()` starts working.
 *
 * The playground is exactly that consumer — it pins `render: { compileMjml }` backed
 * by `mjml-browser` and implements neither `toMjml` nor `toHtml`. So these tests can
 * distinguish "the local renderer produced the MJML" from "the provider produced the
 * HTML", which is the seam that matters.
 *
 * What the playground can't express (a provider supplying `toMjml`/`toHtml`, an
 * absent provider making `toHtml()` reject) stays in `renderProvider.test.ts` —
 * adding playground controls purely to reach those would put test-only UI in front
 * of visitors.
 */

/** `editor.toMjml()` via the playground's window hook. */
async function getMjml(page: import("@playwright/test").Page): Promise<string> {
  await page.waitForFunction(
    () =>
      typeof (window as { __tplPlaygroundGetMjml?: () => Promise<string> })
        .__tplPlaygroundGetMjml === "function",
  );
  return page.evaluate(() =>
    (
      window as { __tplPlaygroundGetMjml?: () => Promise<string> }
    ).__tplPlaygroundGetMjml!(),
  );
}

/** `editor.toHtml()` via the playground's window hook. */
async function getHtml(page: import("@playwright/test").Page): Promise<string> {
  await page.waitForFunction(
    () =>
      typeof (window as { __tplPlaygroundGetHtml?: () => Promise<string> })
        .__tplPlaygroundGetHtml === "function",
  );
  return page.evaluate(() =>
    (
      window as { __tplPlaygroundGetHtml?: () => Promise<string> }
    ).__tplPlaygroundGetHtml!(),
  );
}

test.describe("render provider — compileMjml tier", () => {
  test("toHtml() resolves through the provider to compiled HTML", async ({
    editorReady: { editorPage },
    page,
  }) => {
    expect(await editorPage.getBlockCount()).toBeGreaterThan(0);

    const html = await getHtml(page);

    // Compiled email HTML, not MJML source: mjml2html emits an XHTML doctype and
    // the Outlook conditional wrapper, and no `<mjml`/`<mj-` tags survive.
    expect(html).toContain("<!doctype html");
    expect(html).toContain("<!--[if mso | IE]>");
    expect(html).not.toContain("<mjml");
    expect(html).not.toContain("<mj-section");
  });

  test("the MJML it compiles is the SDK's own, not the provider's", async ({
    editorReady: { editorPage },
    page,
  }) => {
    expect(await editorPage.getBlockCount()).toBeGreaterThan(0);

    const mjml = await getMjml(page);
    const html = await getHtml(page);

    // The playground implements only `compileMjml`, so `toMjml()` must have come
    // from the bundled renderer — and the HTML must be that MJML compiled.
    expect(mjml).toContain("<mjml");
    expect(mjml).toContain("<mj-body");

    // The template's own text survives the whole chain: local render → provider
    // compile. Take a distinctive run of words out of the MJML and require it in
    // the HTML, so a provider returning canned output would fail.
    const heading = mjml.match(/<h[12][^>]*>([^<]{8,})<\/h[12]>/);
    expect(heading).not.toBeNull();
    expect(html).toContain(heading![1]);
  });

  test("the export modal's HTML tab renders the compiled output", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExport();
    await page.locator(SELECTORS.exportTabHtml).click();

    const editorText = page
      .locator(SELECTORS.exportModal)
      .locator(".cm-editor");
    // The tab compiles on demand; wait for real content rather than a spinner.
    await expect(editorText).toBeVisible();
    await expect
      .poll(async () => (await editorText.innerText()).includes("<!doctype html"))
      .toBe(true);

    const text = await editorText.innerText();
    expect(text).not.toContain("<mj-section");
    // The error branch renders its own testid instead of the code editor.
    await expect(page.locator(SELECTORS.exportHtmlError)).toHaveCount(0);
  });

  test("the MJML tab still shows locally-rendered source", async ({
    editorReady: { editorPage },
    page,
  }) => {
    await editorPage.openExport();
    await page.locator(SELECTORS.exportTabMjml).click();

    const text = await page
      .locator(SELECTORS.exportModal)
      .locator(".cm-editor")
      .innerText();

    // CodeMirror only renders the visible viewport, so assert on what is at the
    // very top of each form: `<mjml` for source, `<!doctype html` for compiled.
    // A deeper marker like `<mj-body` sits below the fold and reads as absent.
    expect(text).toContain("<mjml");
    expect(text).not.toContain("<!doctype html");
  });
});
