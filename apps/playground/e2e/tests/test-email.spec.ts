import { test, expect } from "../fixtures/editor.fixture";
import { SELECTORS } from "../helpers/selectors";

/**
 * Test emails in the OSS editor, backed by the playground's always-on fake
 * sender (`apps/playground/src/App.vue`). It waits ~800ms, logs the payload, and
 * resolves — nothing is delivered.
 *
 * The playground pins its provider deliberately, which bounds what is reachable
 * from here: **two allowed recipients**, `includeMjml: true`, and a send that
 * always succeeds. So this spec covers the picker branch and the happy path
 * browser-side, and the branches the playground can't express — free text, a
 * single read-only recipient, an empty allowlist hiding the trigger, and a
 * rejected send — are covered by `testEmailModal.test.ts` and
 * `useTestEmailFeature.test.ts` instead. Adding a control surface to the
 * playground purely to reach them would put UI in front of visitors that exists
 * only for tests.
 */

/** Matches the hardcoded demo allowlist. */
const ALLOWED = ["you@example.com", "teammate@example.com"];

/** The fake sender's latency; sends resolve after this. */
const FAKE_LATENCY_MS = 800;

type CapturedPayload = {
  recipient: string;
  content: { blocks: unknown[] };
  mjml?: string;
  allowedRecipients?: string[];
};

test.describe("Test email", () => {
  test("the trigger renders in the editor header", async ({ editorReady }) => {
    const { editorPage } = editorReady;

    await expect(
      editorPage.page.locator(SELECTORS.testEmailTrigger),
    ).toBeVisible();
  });

  test("opens a dialog offering exactly the allowed recipients", async ({
    editorReady,
  }) => {
    const { editorPage } = editorReady;
    const page = editorPage.page;

    await page.locator(SELECTORS.testEmailTrigger).click();

    const field = page.locator(SELECTORS.testEmailRecipient);
    await expect(field).toBeVisible();
    // Two entries ⇒ a picker, pre-selected on the first.
    await expect(field).toHaveJSProperty("tagName", "SELECT");
    await expect(field.locator("option")).toHaveText(ALLOWED);
    await expect(field).toHaveValue(ALLOWED[0]);
  });

  test("shows the preview without any interaction", async ({ editorReady }) => {
    const { editorPage } = editorReady;
    const page = editorPage.page;

    await page.locator(SELECTORS.testEmailTrigger).click();

    // No disclosure to open — the preview is part of the dialog.
    await expect(page.locator(SELECTORS.testEmailPreview)).toBeVisible();
    await expect(
      page.locator(SELECTORS.blockPreviewCanvas),
    ).toBeVisible();
  });

  test("the preview renders the template's actual blocks", async ({
    editorReady,
  }) => {
    const { editorPage } = editorReady;
    const page = editorPage.page;

    // Take a distinctive string off the canvas first, so the assertion is about
    // this template rather than any non-empty render.
    const canvasText = await editorPage
      .getBlocks()
      .first()
      .innerText();
    const needle = canvasText.trim().split("\n")[0].slice(0, 24);
    expect(needle.length).toBeGreaterThan(3);

    await page.locator(SELECTORS.testEmailTrigger).click();

    await expect(page.locator(SELECTORS.blockPreviewCanvas)).toContainText(
      needle,
    );
  });

  test("switching the preview viewport narrows the frame", async ({
    editorReady,
  }) => {
    const { editorPage } = editorReady;
    const page = editorPage.page;

    await page.locator(SELECTORS.testEmailTrigger).click();

    const group = page.locator(SELECTORS.testEmailPreviewViewport);
    const desktop = group.getByRole("radio", { name: "Desktop" });
    const mobile = group.getByRole("radio", { name: "Mobile" });
    await expect(desktop).toHaveAttribute("aria-checked", "true");

    const frame = page.locator(SELECTORS.blockPreviewCanvas);
    const desktopWidth = (await frame.boundingBox())?.width ?? 0;
    expect(desktopWidth).toBeGreaterThan(400);

    await mobile.click();
    await expect(mobile).toHaveAttribute("aria-checked", "true");
    await expect(desktop).toHaveAttribute("aria-checked", "false");

    // Poll rather than measure once: the frame eases to its new width, so an
    // immediate read can catch it mid-transition.
    await expect
      .poll(async () => Math.round((await frame.boundingBox())?.width ?? 0))
      .toBe(375);
  });

  test("sends to the selected recipient and confirms, then closes itself", async ({
    editorReady,
  }) => {
    const { editorPage } = editorReady;
    const page = editorPage.page;

    await page.locator(SELECTORS.testEmailTrigger).click();
    await page.locator(SELECTORS.testEmailSend).click();

    // Confirmation appears once the fake sender resolves.
    await expect(page.locator(SELECTORS.testEmailSuccess)).toBeVisible({
      timeout: FAKE_LATENCY_MS + 4000,
    });
    await expect(page.locator(SELECTORS.testEmailError)).toHaveCount(0);

    // …and the dialog dismisses itself shortly after.
    await expect(page.locator(SELECTORS.testEmailRecipient)).toBeHidden();
  });

  test("hands the provider the recipient, the content and the MJML", async ({
    editorReady,
  }) => {
    const { editorPage } = editorReady;
    const page = editorPage.page;

    await page.locator(SELECTORS.testEmailTrigger).click();
    await page
      .locator(SELECTORS.testEmailRecipient)
      .selectOption(ALLOWED[1]);
    await page.locator(SELECTORS.testEmailSend).click();
    await expect(page.locator(SELECTORS.testEmailSuccess)).toBeVisible({
      timeout: FAKE_LATENCY_MS + 4000,
    });

    // The playground stashes the payload for exactly this purpose, so the
    // assertion doesn't depend on scraping console output.
    const payload = await page.evaluate(
      () =>
        (window as { __tplPlaygroundLastTestEmail?: CapturedPayload })
          .__tplPlaygroundLastTestEmail,
    );

    expect(payload?.recipient).toBe(ALLOWED[1]);
    expect(payload?.content.blocks.length).toBeGreaterThan(0);
    // `includeMjml` is on in the playground, and the renderer is installed, so
    // real MJML must arrive — this is the one place the whole optional-peer chain
    // is exercised in a browser.
    expect(payload?.mjml?.startsWith("<mjml")).toBe(true);
    // The allowlist is echoed back so one `send` stays portable to Cloud.
    expect(payload?.allowedRecipients).toEqual(ALLOWED);
  });

  test("Cancel closes without sending", async ({ editorReady }) => {
    const { editorPage } = editorReady;
    const page = editorPage.page;

    await page.evaluate(() => {
      delete (window as { __tplPlaygroundLastTestEmail?: unknown })
        .__tplPlaygroundLastTestEmail;
    });

    await page.locator(SELECTORS.testEmailTrigger).click();
    await expect(page.locator(SELECTORS.testEmailRecipient)).toBeVisible();

    await page.locator(SELECTORS.testEmailCancel).click();

    await expect(page.locator(SELECTORS.testEmailRecipient)).toBeHidden();
    const payload = await page.evaluate(
      () =>
        (window as { __tplPlaygroundLastTestEmail?: CapturedPayload })
          .__tplPlaygroundLastTestEmail,
    );
    expect(payload).toBeUndefined();
  });

  test("Escape closes the dialog", async ({ editorReady }) => {
    const { editorPage } = editorReady;
    const page = editorPage.page;

    await page.locator(SELECTORS.testEmailTrigger).click();
    await expect(page.locator(SELECTORS.testEmailRecipient)).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.locator(SELECTORS.testEmailRecipient)).toBeHidden();
  });

  test("reopening starts clean rather than showing the last result", async ({
    editorReady,
  }) => {
    const { editorPage } = editorReady;
    const page = editorPage.page;

    await page.locator(SELECTORS.testEmailTrigger).click();
    await page.locator(SELECTORS.testEmailSend).click();
    await expect(page.locator(SELECTORS.testEmailSuccess)).toBeVisible({
      timeout: FAKE_LATENCY_MS + 4000,
    });
    await expect(page.locator(SELECTORS.testEmailRecipient)).toBeHidden();

    await page.locator(SELECTORS.testEmailTrigger).click();

    await expect(page.locator(SELECTORS.testEmailRecipient)).toBeVisible();
    // A stale confirmation on reopen would read as "already sent".
    await expect(page.locator(SELECTORS.testEmailSuccess)).toHaveCount(0);
    await expect(page.locator(SELECTORS.testEmailError)).toHaveCount(0);
  });
});
