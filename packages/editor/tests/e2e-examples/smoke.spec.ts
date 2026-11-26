import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { segments } from "../../../../examples/countdown-image/src/segments.ts";

const KIND = process.env.EXAMPLE_KIND;
const EXAMPLE = process.env.EXAMPLE ?? "";
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

// Next.js renders its own empty role="alert" route announcer, so the
// example's alert is found inside its toolbar.
const toolbarAlert = (page: Page) =>
  page.locator(".toolbar").getByRole("alert");

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
  // EXAMPLE_KIND would otherwise pass with nothing run. The same holds for
  // EXAMPLE and the one test that runs against a single example.
  expect(["fullstack", "minimal", "image-endpoint"]).toContain(KIND);
  expect(EXAMPLE).not.toBe("");
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
    const listedAfter = (await (
      await page.request.get("/api/saved-blocks")
    ).json()) as { id: string; name: string }[];
    expect(listedAfter.find((block) => block.id === saved?.id)?.name).toBe(
      renamedTo,
    );

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

  test("shows editor and export failures in the toolbar until the next export", async ({
    page,
    context,
  }) => {
    // The 500s below are deliberate, so only page errors count.
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const alert = toolbarAlert(page);

    await page.goto("/");
    await expect(page).toHaveURL(/[?&]id=[0-9a-f-]{36}/);

    // The editor reports a saved-block library that fails to load through
    // onError, which the example shows in its toolbar.
    await page.route("**/api/saved-blocks", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            status: 500,
            json: { message: "Saved blocks are unavailable." },
          })
        : route.fallback(),
    );
    await page.locator('button[aria-label="Browse saved blocks"]').click();
    await expect(alert).toHaveText("Saved blocks are unavailable.");
    await page.locator('[data-testid="saved-blocks-browser-close"]').click();
    await page.unroute("**/api/saved-blocks");

    // A failed render closes the tab the export opened, and its message
    // replaces the earlier one.
    await page.route("**/api/render", (route) =>
      route.fulfill({ status: 500, json: { message: "Rendering failed." } }),
    );
    const failedTab = context.waitForEvent("page");
    await page.getByTestId("export-html").click();
    const failed = await failedTab;
    await expect(alert).toHaveText("Rendering failed.");
    await expect.poll(() => failed.isClosed()).toBe(true);
    await page.unroute("**/api/render");

    const exportTab = context.waitForEvent("page");
    await page.getByTestId("export-html").click();
    const exported = await exportTab;
    await expect(exported.locator("iframe")).toHaveAttribute("sandbox", "");
    await exported.close();
    await expect(alert).toHaveCount(0);

    expect(pageErrors).toEqual([]);
  });

  test("asks for pop-ups when the browser blocks the export tab", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.open = () => null;
    });
    await page.goto("/");
    await expect(page).toHaveURL(/[?&]id=[0-9a-f-]{36}/);
    await page.getByTestId("export-html").click();
    await expect(toolbarAlert(page)).toHaveText(
      "Allow pop-ups for this page to see the export.",
    );
  });

  test("answers a body over adapter-node's BODY_SIZE_LIMIT with 413", async ({
    request,
  }) => {
    test.skip(
      EXAMPLE !== "sveltekit",
      "only adapter-node limits request bodies",
    );
    // Over the 512K default, so adapter-node fails the read.
    const response = await request.post("/api/templates", {
      data: { name: "x".repeat(600 * 1024) },
    });
    expect(response.status()).toBe(413);
    expect(((await response.json()) as { message: string }).message).toBe(
      "The request body is larger than BODY_SIZE_LIMIT allows (512K by default).",
    );
  });

  test("offers a new template when the requested one is missing", async ({
    page,
    context,
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
    // An export keeps the message and its link: the template never opened.
    const exportTab = context.waitForEvent("page");
    await page.getByTestId("export-html").click();
    const exported = await exportTab;
    await expect(exported.locator("iframe")).toHaveAttribute("sandbox", "");
    await exported.close();
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

  test("shows an editor failure in the toolbar until the next export", async ({
    page,
  }) => {
    // The editor's localStorage provider can't read the saved-block library,
    // and the editor reports that through onError.
    await page.addInitScript(() => {
      const getItem = Storage.prototype.getItem;
      Storage.prototype.getItem = function (this: Storage, key: string) {
        if (key === "templatical:saved-blocks") {
          throw new Error("Saved blocks are unavailable.");
        }
        return getItem.call(this, key);
      };
    });
    const alert = toolbarAlert(page);

    await page.goto("/");
    await page.locator('button[aria-label="Browse saved blocks"]').click();
    await expect(alert).toHaveText("Saved blocks are unavailable.");
    await page.locator('[data-testid="saved-blocks-browser-close"]').click();

    await page.getByTestId("export-mjml").click();
    await expect(page.getByTestId("export-output")).toContainText("<mjml");
    await expect(alert).toHaveCount(0);
  });
});

function gifPixels(data: Uint8Array, minimumCodeSize: number): number[] {
  const clear = 1 << minimumCodeSize;
  const end = clear + 1;
  let dictionary: number[][] = [];
  let codeSize = minimumCodeSize + 1;
  let bit = 0;
  let previous: number[] | null = null;
  const pixels: number[] = [];
  const reset = () => {
    dictionary = Array.from({ length: clear }, (_, value) => [value]);
    dictionary.push([], []);
    codeSize = minimumCodeSize + 1;
    previous = null;
  };
  reset();
  while (bit + codeSize <= data.length * 8) {
    let code = 0;
    for (let index = 0; index < codeSize; index++) {
      code |= ((data[bit >> 3] >> (bit & 7)) & 1) << index;
      bit++;
    }
    if (code === clear) {
      reset();
      continue;
    }
    if (code === end) break;
    const entry =
      code < dictionary.length
        ? dictionary[code]
        : [...(previous ?? []), previous?.[0] ?? 0];
    pixels.push(...entry);
    if (previous) {
      dictionary.push([...previous, entry[0]]);
      if (dictionary.length === 1 << codeSize && codeSize < 12) codeSize++;
    }
    previous = entry;
  }
  return pixels;
}

/** Read GIF structure rather than counting 0x2c bytes inside compressed data. */
function gifInfo(bytes: Uint8Array) {
  const text = (from: number, length: number) =>
    Buffer.from(bytes.subarray(from, from + length)).toString("ascii");
  expect(text(0, 6)).toBe("GIF89a");
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  let offset = 13;
  if (bytes[10] & 0x80) offset += 3 * (1 << ((bytes[10] & 7) + 1));
  const delays: number[] = [];
  let transparent = false;
  let loops = false;
  let frames = 0;
  let previousFramePixels: number[] = [];
  let lastFramePixels: number[] = [];
  const readBlocks = () => {
    const data: number[] = [];
    while (true) {
      const length = bytes[offset++];
      if (length === 0) return Uint8Array.from(data);
      data.push(...bytes.subarray(offset, offset + length));
      offset += length;
      expect(offset).toBeLessThanOrEqual(bytes.length);
    }
  };
  const skipBlocks = () => {
    readBlocks();
  };
  while (offset < bytes.length) {
    const marker = bytes[offset++];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      const label = bytes[offset++];
      if (label === 0xf9) {
        expect(bytes[offset++]).toBe(4);
        const flags = bytes[offset++];
        transparent ||= !!(flags & 1);
        delays.push(bytes[offset] | (bytes[offset + 1] << 8));
        offset += 3;
        expect(bytes[offset++]).toBe(0);
      } else {
        if (label === 0xff && text(offset + 1, 11) === "NETSCAPE2.0")
          loops = true;
        skipBlocks();
      }
      continue;
    }
    expect(marker).toBe(0x2c);
    frames++;
    const flags = bytes[offset + 8];
    offset += 9;
    if (flags & 0x80) offset += 3 * (1 << ((flags & 7) + 1));
    const minimumCodeSize = bytes[offset++];
    previousFramePixels = lastFramePixels;
    lastFramePixels = gifPixels(readBlocks(), minimumCodeSize);
  }
  expect(bytes[offset - 1]).toBe(0x3b);
  expect(lastFramePixels).toHaveLength(width * height);
  return {
    width,
    height,
    frames,
    delays,
    loops,
    transparent,
    previousFrameSolid: previousFramePixels.every(
      (pixel) => pixel === previousFramePixels[0],
    ),
    lastFrameSolid: lastFramePixels.every(
      (pixel) => pixel === lastFramePixels[0],
    ),
  };
}

test.describe("image endpoint example", () => {
  test.skip(KIND !== "image-endpoint", "runs against the image endpoint only");

  test("moves a hidden unit's time into the next visible unit", () => {
    const labels = {
      labelDays: "d",
      labelHours: "h",
      labelMinutes: "m",
      labelSeconds: "s",
    };
    const digits = (shown: [boolean, boolean, boolean, boolean], s: number) =>
      segments(
        {
          ...labels,
          showDays: shown[0],
          showHours: shown[1],
          showMinutes: shown[2],
          showSeconds: shown[3],
        },
        s,
      ).map((segment) => `${segment.digits}${segment.label}`);
    expect(digits([false, true, false, true], 3661)).toEqual(["01h", "61s"]);
    expect(digits([true, false, true, false], 90061)).toEqual(["1d", "61m"]);
    expect(digits([true, true, true, true], 90061)).toEqual([
      "1d",
      "01h",
      "01m",
      "01s",
    ]);
    expect(digits([false, false, false, true], 3661)).toEqual(["3661s"]);
  });

  test("returns 60 one-second GIF frames without a loop", async ({
    request,
  }) => {
    const targetDate = new Date(Date.now() + 3_600_000)
      .toISOString()
      .slice(0, 16);
    const query = new URLSearchParams({ targetDate, timezone: "UTC" });
    const response = await request.get(`/countdown.gif?${query}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/gif");
    expect(response.headers()["cache-control"]).toBe("public, max-age=1");
    const info = gifInfo(await response.body());
    expect(info.frames).toBe(60);
    expect(info.delays).toEqual(Array(60).fill(100));
    expect(info.loops).toBe(false);
    expect(info.width).toBeGreaterThan(1);
    expect(info.height).toBeGreaterThan(1);
  });

  test("ends a near-target GIF on the expired frame without looping", async ({
    request,
  }) => {
    const targetDate = new Date(Date.now() + 5_000).toISOString();
    const query = new URLSearchParams({
      targetDate,
      timezone: "UTC",
      expiredMessage: "",
    });
    const response = await request.get(`/countdown.gif?${query}`);
    expect(response.status()).toBe(200);
    const info = gifInfo(await response.body());
    expect(info.frames).toBe(6);
    expect(info.delays).toEqual(Array(6).fill(100));
    expect(info.loops).toBe(false);
    expect(info.previousFrameSolid).toBe(false);
    expect(info.lastFrameSolid).toBe(true);
  });

  test("answers HEAD and rejects POST on the image route", async ({
    request,
  }) => {
    const query = "targetDate=2000-01-01T00%3A00&timezone=UTC";
    const head = await request.head(`/countdown.gif?${query}`);
    expect(head.status()).toBe(200);
    expect(head.headers()["content-type"]).toBe("image/gif");
    expect(head.headers()["cache-control"]).toBe("public, max-age=1");
    expect(await head.body()).toHaveLength(0);
    const post = await request.post(`/countdown.gif?${query}`);
    expect(post.status()).toBe(405);
    expect(post.headers().allow).toBe("GET, HEAD");
  });

  test("rejects a canvas that exceeds the image size limit", async ({
    request,
  }) => {
    const query = new URLSearchParams({
      targetDate: "2030-01-01T00:00",
      timezone: "UTC",
      digitFontSize: "72",
      labelFontSize: "32",
      labelDays: "W".repeat(32),
      labelHours: "W".repeat(32),
      labelMinutes: "W".repeat(32),
      labelSeconds: "W".repeat(32),
      expiredMessage: "W".repeat(100),
    });
    const response = await request.get(`/countdown.gif?${query}`);
    expect(response.status()).toBe(400);
  });

  test("renders one expired frame", async ({ request }) => {
    const response = await request.get(
      "/countdown.gif?targetDate=2000-01-01T00%3A00&timezone=UTC",
    );
    expect(response.status()).toBe(200);
    expect(gifInfo(await response.body()).frames).toBe(1);
  });

  test("hides an expired countdown with one transparent pixel", async ({
    request,
  }) => {
    const response = await request.get(
      "/countdown.gif?targetDate=2000-01-01T00%3A00&timezone=UTC&hideOnExpiry=true",
    );
    expect(response.status()).toBe(200);
    expect(gifInfo(await response.body())).toMatchObject({
      width: 1,
      height: 1,
      frames: 1,
      transparent: true,
    });
  });

  test("rejects an unreadable timezone and a 33-character label", async ({
    request,
  }) => {
    const invalid = await request.get(
      "/countdown.gif?targetDate=2030-01-01T00%3A00&timezone=Not%2FAZone",
    );
    expect(invalid.status()).toBe(400);
    const query = new URLSearchParams({
      targetDate: "2030-01-01T00:00",
      timezone: "UTC",
      labelDays: "x".repeat(32),
    });
    const boundary = await request.get(`/countdown.gif?${query}`);
    expect(boundary.status()).toBe(200);
    query.set("labelDays", "x".repeat(33));
    const long = await request.get(`/countdown.gif?${query}`);
    expect(long.status()).toBe(400);
  });
});
