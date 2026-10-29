import type { Locator, Page } from "@playwright/test";
import { test, expect } from "../fixtures/editor.fixture";

/**
 * Measures the Languages scene's scale variant (`?scale=1`: 300 blocks in 20
 * languages) and prints the numbers as one JSON line. Opt-in, because wall
 * times depend on the machine: `TEMPLATICAL_MEASURE=1`. CI asserts the shape
 * instead (packages/editor/tests/localizationRecompute.test.ts and
 * translationBatching.test.ts).
 */
test.skip(
  process.env.TEMPLATICAL_MEASURE !== "1",
  "Set TEMPLATICAL_MEASURE=1 to measure the scale variant.",
);

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Milliseconds from a click on `target` to the next paint, in the page. */
function clickToPaint(target: Locator): Promise<number> {
  return target.evaluate(
    (element) =>
      new Promise<number>((resolve) => {
        const start = performance.now();
        (element as HTMLElement).click();
        requestAnimationFrame(() => {
          // A task queued from the frame callback runs after that frame's paint.
          const channel = new MessageChannel();
          channel.port1.onmessage = () => resolve(performance.now() - start);
          channel.port2.postMessage(null);
        });
      }),
  );
}

/** Times each keydown from its event timestamp to the next paint. */
async function recordKeystrokes(page: Page) {
  await page.evaluate(() => {
    const times: number[] = [];
    (window as { __tplKeystrokeMs?: number[] }).__tplKeystrokeMs = times;
    window.addEventListener(
      "keydown",
      (event) => {
        const start = event.timeStamp;
        requestAnimationFrame(() => {
          const channel = new MessageChannel();
          channel.port1.onmessage = () => times.push(performance.now() - start);
          channel.port2.postMessage(null);
        });
      },
      { capture: true },
    );
  });
}

test("measures 300 blocks in 20 languages", async ({
  page,
  scenePage,
  editorPage,
}) => {
  test.setTimeout(180_000);
  await scenePage.goto("languages", { scale: "1" });
  await editorPage.waitForReady();
  await editorPage.dismissOverlays();
  await expect(page.locator("[data-block-id]")).toHaveCount(300);

  // The pure helpers on the scene's own content, as a backend would run them.
  const pure = await page.evaluate(async () => {
    const scenePath = "/src/scenes/author/languages.ts";
    const { languages } = await import(/* @vite-ignore */ scenePath);
    const types = await import(/* @vite-ignore */ "/@id/@templatical/types");
    const renderer = await import(
      /* @vite-ignore */ "/@id/@templatical/renderer"
    );
    const content = languages.content({
      search: new URLSearchParams("scale=1"),
    });
    const time = async (run: () => unknown, times: number) => {
      const samples: number[] = [];
      for (let i = 0; i < times; i++) {
        const start = performance.now();
        await run();
        samples.push(performance.now() - start);
      }
      return samples;
    };
    let mjml = "";
    return {
      payloadBytes: new TextEncoder().encode(JSON.stringify(content))
        .byteLength,
      coverage: await time(() => types.localeCoverage(content, "de"), 20),
      render: await time(async () => {
        mjml = await renderer.renderToMjml(types.resolveLocale(content, "de"));
      }, 5),
      rendersGerman: mjml.includes("[de] Line"),
    };
  });
  expect(pure.rendersGerman).toBe(true);

  const trigger = page.getByTestId("language-menu");
  const menuOpen: number[] = [];
  for (let i = 0; i < 5; i++) {
    menuOpen.push(await clickToPaint(trigger));
    await expect(page.locator('[role="menuitemradio"]')).toHaveCount(20);
    await page.keyboard.press("Escape");
    await expect(page.locator('[role="menuitemradio"]')).toHaveCount(0);
  }

  await trigger.click();
  await page.getByTestId("language-option-de").click();
  await expect(page.getByTestId("language-bar")).toBeVisible();

  await editorPage.doubleClickBlock("paragraph");
  const editable = await editorPage.focusTextEditableAtEnd("paragraph");
  await expect(editable).toBeEditable();
  await recordKeystrokes(page);
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("x");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as { __tplKeystrokeMs?: number[] }).__tplKeystrokeMs
              ?.length ?? 0,
        ),
      )
      .toBe(i + 1);
  }
  const keystrokes = await page.evaluate(
    () => (window as { __tplKeystrokeMs?: number[] }).__tplKeystrokeMs ?? [],
  );
  await editorPage.deselectBlock();

  await page.evaluate(() => {
    (
      window as { __tplPlaygroundTranslateCalls?: unknown[] }
    ).__tplPlaygroundTranslateCalls = [];
  });
  await page.getByTestId("translate-language").click();
  await expect(page.getByTestId("translation-result")).toBeVisible({
    timeout: 60_000,
  });
  const calls = await page.evaluate(
    () =>
      (
        window as {
          __tplPlaygroundTranslateCalls?: { fields: number; chars: number }[];
        }
      ).__tplPlaygroundTranslateCalls ?? [],
  );

  const measurements = {
    keystrokeMs: median(keystrokes),
    coverageMs: median(pure.coverage),
    menuOpenMs: median(menuOpen),
    translateCalls: calls.length,
    translateChars: calls.reduce((sum, call) => sum + call.chars, 0),
    payloadBytes: pure.payloadBytes,
    renderMs: median(pure.render),
  };
  console.log(JSON.stringify(measurements));
  expect(keystrokes).toHaveLength(20);
  expect(measurements.translateCalls).toBeGreaterThan(0);
  expect(calls.every((call) => call.fields <= 50 && call.chars <= 20_000)).toBe(
    true,
  );
});
