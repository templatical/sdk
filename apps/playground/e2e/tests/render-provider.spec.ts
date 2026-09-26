import { test, expect } from "../fixtures/editor.fixture";

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
    (window as { __tplPlaygroundGetMjml?: () => Promise<string> })
      .__tplPlaygroundGetMjml!(),
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
    (window as { __tplPlaygroundGetHtml?: () => Promise<string> })
      .__tplPlaygroundGetHtml!(),
  );
}

test.describe("render provider — compileMjml tier", () => {
  test.beforeEach(async ({ scenePage, editorPage }) => {
    await scenePage.goto("render");
    await editorPage.waitForReady();
    await editorPage.dismissOverlays();
  });

  test("toHtml() resolves through the provider to compiled HTML", async ({
    editorPage,
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
    editorPage,
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

  test("toHtml() is compiled email HTML, not MJML source", async ({
    editorPage,
    page,
  }) => {
    expect(await editorPage.getBlockCount()).toBeGreaterThan(0);
    const html = await getHtml(page);
    expect(html).toContain("<!doctype html");
    expect(html).not.toContain("<mj-section");
  });

  test("toMjml() is locally-rendered source", async ({ editorPage, page }) => {
    expect(await editorPage.getBlockCount()).toBeGreaterThan(0);
    const mjml = await getMjml(page);
    expect(mjml).toContain("<mjml");
    expect(mjml).not.toContain("<!doctype html");
  });
});
