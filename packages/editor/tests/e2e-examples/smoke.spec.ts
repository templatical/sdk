import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const KIND = process.env.EXAMPLE_KIND;
const DATA_DIR = process.env.TEMPLATICAL_DATA_DIR ?? "";

const APP_ORIGIN = new URL(process.env.EXAMPLE_URL ?? "http://localhost")
  .origin;

// "Click Here" is the English default text of a new Button block, so it marks
// the inserted block in every export.
const BUTTON_TEXT = "Click Here";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const source = message.location().url;
    // A browser logs a missing favicon as an error, and the examples ship none.
    if (source.endsWith("/favicon.ico")) return;
    // A failed request to another origin (the editor's font stylesheet) is the
    // network's problem, not the example's.
    if (URL.canParse(source) && new URL(source).origin !== APP_ORIGIN) return;
    errors.push(message.text());
  });
  return errors;
}

/** The `.html` files in the outbox, or none before the first send creates it. */
function outboxFiles(outbox: string): string[] {
  return existsSync(outbox)
    ? readdirSync(outbox).filter((file) => file.endsWith(".html"))
    : [];
}

const buttons = (page: Page) => page.locator('[data-block-type="button"]');

async function insertButton(page: Page) {
  await page.locator('[data-palette-type="button"]').click();
}

async function saveButtonAsBlock(page: Page, name: string) {
  await buttons(page).click();
  await page.locator('button[aria-label="Save as Block"]').click();
  await page.locator('[data-testid="saved-blocks-pick-confirm"]').click();
  await page.locator('[data-testid="saved-blocks-name-input"]').fill(name);
  await page.getByRole("button", { name: "Save Block", exact: true }).click();
  await expect(
    page.locator('[data-testid="saved-blocks-name-input"]'),
  ).toBeHidden();
}

async function openLibraryCard(page: Page, name: string) {
  await page.locator('button[aria-label="Browse saved blocks"]').click();
  const card = page.locator('[data-testid="saved-block-card"]', {
    hasText: name,
  });
  await expect(card).toBeVisible();
  return card;
}

test("runs against a known example kind", () => {
  // Each describe below skips unless its kind matches, so a wrong
  // EXAMPLE_KIND would otherwise pass with nothing run.
  expect(["fullstack", "minimal"]).toContain(KIND);
});

test.describe("full-stack example", () => {
  test.skip(KIND !== "fullstack", "runs against a full-stack example only");

  test("creates, saves, reloads, reuses and deletes a saved block, exports HTML and sends a test email", async ({
    page,
    context,
  }, testInfo) => {
    expect(DATA_DIR).not.toBe("");
    const errors = collectErrors(page);

    // A retry runs against the same server and data, so its saved block needs
    // a name the earlier attempt didn't use.
    const blockName = `Smoke block ${testInfo.retry}`;

    await page.goto("/");
    await expect(page).toHaveURL(/[?&]id=[0-9a-f-]{36}/);

    await insertButton(page);
    await expect(buttons(page)).toHaveCount(1);
    await page.locator('[data-testid="template-save"]').click();
    await expect(
      page.locator('[data-testid="save-status-saved"]'),
    ).toBeVisible();
    await page.reload();
    await expect(buttons(page)).toHaveCount(1);

    await saveButtonAsBlock(page, blockName);
    await (await openLibraryCard(page, blockName)).click();
    await page
      .locator('[data-testid="saved-blocks-browser"]')
      .getByRole("button", { name: "Insert", exact: true })
      .click();
    await expect(buttons(page)).toHaveCount(2);

    // The rename route (PATCH) is the one storage route the editor steps above
    // don't reach; the editor's rename UI calls the same provider method.
    const listedBefore = (await (
      await page.request.get("/api/saved-blocks")
    ).json()) as { id: string; name: string }[];
    const saved = listedBefore.find((block) => block.name === blockName);
    expect(saved?.name).toBe(blockName);
    const renamedTo = `${blockName} renamed`;
    const renamed = await page.request.patch(`/api/saved-blocks/${saved?.id}`, {
      data: { name: renamedTo },
    });
    expect(renamed.status()).toBe(200);
    expect(((await renamed.json()) as { name: string }).name).toBe(renamedTo);

    // Deleting sends the journey's only bodyless request, the one a
    // framework's CSRF check is likeliest to reject, so the saved block is
    // deleted through the editor and the server must stop listing it.
    const card = await openLibraryCard(page, blockName);
    await card.getByRole("button", { name: "Delete", exact: true }).click();
    await card
      .getByRole("button", { name: "Delete this saved block?", exact: true })
      .click();
    await expect(card).toHaveCount(0);
    const listed = await page.request.get("/api/saved-blocks");
    expect(listed.status()).toBe(200);
    const names = ((await listed.json()) as { name: string }[]).map(
      (block) => block.name,
    );
    expect(names).not.toContain(renamedTo);
    await page.locator('[data-testid="saved-blocks-browser-close"]').click();
    await expect(
      page.locator('[data-testid="saved-blocks-browser"]'),
    ).toBeHidden();

    const popupPromise = context.waitForEvent("page");
    await page.getByTestId("export-html").click();
    const popup = await popupPromise;
    // The export renders in a sandboxed frame, so markup in a template can't
    // run with the app's origin.
    const frame = popup.locator("iframe");
    await expect(frame).toHaveAttribute("sandbox", "");
    const html = (await frame.getAttribute("srcdoc")) ?? "";
    expect(html.toLowerCase()).toContain("<!doctype html");
    expect(html).toContain(BUTTON_TEXT);
    await popup.close();

    const outbox = join(DATA_DIR, "outbox");
    const before = new Set(outboxFiles(outbox));
    await page.locator('[data-testid="test-email-trigger"]').click();
    await page
      .locator('[data-testid="test-email-recipient"]')
      .fill("smoke@example.com");
    await page.locator('[data-testid="test-email-send"]').click();
    await expect(
      page.locator('[data-testid="test-email-success"]'),
    ).toBeVisible();
    const sent = outboxFiles(outbox).filter((file) => !before.has(file));
    expect(sent).toHaveLength(1);
    const delivered = readFileSync(join(outbox, sent[0]), "utf8");
    expect(delivered.toLowerCase()).toContain("<!doctype html");
    expect(delivered).toContain(BUTTON_TEXT);

    expect(errors).toEqual([]);
  });

  test("offers a new template when the requested one is missing", async ({
    page,
  }) => {
    // The 404 for the missing template is expected, so only page errors count.
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const missing = "00000000-0000-4000-8000-000000000000";
    const notFound = page
      .getByRole("alert")
      .filter({ hasText: "Template not found." });

    await page.goto(`/?id=${missing}`);
    await expect(notFound).toBeVisible();
    await notFound.getByRole("link", { name: "Start a new template" }).click();
    // A different id: the old URL would satisfy a plain id pattern at once.
    await expect(page).toHaveURL(
      new RegExp(`[?&]id=(?!${missing})[0-9a-f-]{36}`),
    );
    await expect(notFound).toHaveCount(0);

    expect(pageErrors).toEqual([]);
  });
});

test.describe("minimal example", () => {
  test.skip(KIND !== "minimal", "runs against the minimal example only");

  test("keeps content and saved blocks across reloads and exports MJML", async ({
    page,
  }) => {
    const errors = collectErrors(page);

    await page.goto("/");
    await insertButton(page);
    await expect(buttons(page)).toHaveCount(1);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const stored = localStorage.getItem("templatical-example:content");
          return stored
            ? (JSON.parse(stored) as { blocks: { type: string }[] }).blocks.map(
                (block) => block.type,
              )
            : [];
        }),
      )
      .toContain("button");
    await page.reload();
    await expect(buttons(page)).toHaveCount(1);

    await saveButtonAsBlock(page, "Smoke block");
    await page.reload();
    await openLibraryCard(page, "Smoke block");
    await page.locator('[data-testid="saved-blocks-browser-close"]').click();

    await page.getByTestId("export-mjml").click();
    await expect(page.getByTestId("export-output")).toContainText("<mjml");
    await expect(page.getByTestId("export-output")).toContainText(BUTTON_TEXT);

    expect(errors).toEqual([]);
  });
});
