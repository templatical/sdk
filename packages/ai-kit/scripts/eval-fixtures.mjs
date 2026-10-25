// Run from the repository root: node packages/ai-kit/scripts/eval-fixtures.mjs
// Requires the root @playwright/test Chromium installation. Regenerate the
// manifest only after this completes: node packages/ai-kit/scripts/eval-manifest.mjs
import { chromium } from "@playwright/test";
import { mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const evalDir = resolve(import.meta.dirname, "../eval");
const fixtures = [
  ["newsletter", "designs/newsletter.png", 680],
  ["promo", "designs/promo.png", 720],
  ["one-page", "designs/one-page.pdf", 800],
  ["product", "images/product.png", 650],
  ["probe", "images/probe.png", 400],
  ["banner", "images/banner.png", 400],
  ["divider", "images/divider.png", 190],
  ["chart", "images/chart.png", 600],
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 720, height: 800 },
    deviceScaleFactor: 1,
  });
  for (const [source, file, height] of fixtures) {
    const output = resolve(evalDir, file);
    await mkdir(resolve(output, ".."), { recursive: true });
    await page.setViewportSize({ width: 720, height });
    await page.goto(
      pathToFileURL(resolve(evalDir, "sources", `${source}.html`)).href,
    );
    await page.evaluate(() => document.fonts.ready);
    if (file.endsWith(".pdf")) {
      await page.pdf({
        path: output,
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
      });
    } else {
      await page.screenshot({ path: output, type: "png", fullPage: true });
    }
    const { size } = await stat(output);
    if (size > 150_000)
      throw new Error(`${file} exceeds 150 KB (${size} bytes).`);
    console.log(`${file}: ${size} bytes`);
  }
} finally {
  await browser.close();
}
