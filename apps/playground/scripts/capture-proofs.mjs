/**
 * Captures the catalog proofs: every Example scene's email as the editor
 * renders it in preview mode, cropped to PROOF_MAX_HEIGHT and saved as WebP,
 * plus a manifest recording each proof's size and the template hash it was
 * captured from.
 *
 *   pnpm --filter @templatical/playground run capture:proofs [scene-id…]
 *
 * Starts its own dev server unless PLAYGROUND_URL points at a running one.
 * Needs Playwright's Chromium (`pnpm exec playwright install chromium`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { SCENES } from "../src/scenes/index.ts";
import {
  MANIFEST_PATH,
  PROOF_DIR,
  PROOF_MAX_HEIGHT,
  PROOF_WIDTH,
  proofContentHash,
  proofSrc,
} from "./proofs-lib.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const requested = process.argv.slice(2);
const examples = SCENES.filter(
  (scene) =>
    scene.group === "examples" &&
    (requested.length === 0 || requested.includes(scene.id)),
);

if (requested.length && examples.length !== requested.length) {
  const known = new Set(examples.map((scene) => scene.id));
  const unknown = requested.filter((id) => !known.has(id));
  throw new Error(`Not an Example scene: ${unknown.join(", ")}`);
}

/** Chromium encodes WebP from a canvas, so no image library is needed. */
async function toWebp(page, png) {
  const dataUrl = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return canvas.toDataURL("image/webp", 0.82);
  }, png.toString("base64"));
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
}

/**
 * Preview mode animates the editor's side panels away, so the frame keeps
 * moving after it first reaches full width. Only three identical readings in
 * a row mean the clip will land on the email and not beside it.
 */
async function settledBox(page, frame) {
  let previous = null;
  let stableReads = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const box = await frame.boundingBox();
    const same =
      box &&
      previous &&
      ["x", "y", "width", "height"].every(
        (key) => Math.abs(box[key] - previous[key]) < 0.5,
      );
    stableReads = same ? stableReads + 1 : 0;
    if (stableReads >= 2) return box;
    previous = box;
    await page.waitForTimeout(150);
  }
  throw new Error("canvas frame never settled");
}

async function capture(page, base, scene) {
  await page.goto(`${base}/scenes/${scene.id}?shadowDom=0`);
  await page.waitForSelector('[data-scene-ready="true"]');
  await page.getByRole("button", { name: "Preview Mode" }).click();
  const frame = page.locator('[data-testid="canvas-wrapper"]');
  await frame.waitFor();
  // A scene with `resolvePreview` debounces 500ms before its first resolve
  // and shows a skeleton meanwhile. Give the debounce time to fire, then wait
  // for the skeleton to go.
  await page.waitForTimeout(900);
  await page
    .locator('[data-testid="preview-resolution-loading"]')
    .waitFor({ state: "detached", timeout: 15_000 });
  // Editor chrome that preview mode still paints over the email stays out:
  // the preview overlay (Sample/Label switch) and the per-block lint badge
  // (BlockIssueBadge, the only element in the canvas with role="img").
  await page.addStyleTag({
    content:
      '.tpl-preview-overlay, [data-testid="canvas-wrapper"] [role="img"] { visibility: hidden !important; }',
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((image) =>
        image.complete
          ? null
          : new Promise((done) => {
              image.addEventListener("load", done, { once: true });
              image.addEventListener("error", done, { once: true });
            }),
      ),
    );
  });
  const box = await settledBox(page, frame);
  if (Math.round(box.width) !== PROOF_WIDTH) {
    throw new Error(`${scene.id}: frame is ${box.width}px, not ${PROOF_WIDTH}`);
  }
  const height = Math.min(Math.round(box.height), PROOF_MAX_HEIGHT);
  const png = await page.screenshot({
    type: "png",
    clip: { x: box.x, y: box.y, width: PROOF_WIDTH, height },
  });
  return { webp: await toWebp(page, png), height };
}

async function main() {
  let server = null;
  let base = process.env.PLAYGROUND_URL?.replace(/\/$/, "");
  if (!base) {
    server = await createServer({
      root: ROOT,
      configFile: join(ROOT, "vite.config.ts"),
      logLevel: "error",
      server: { port: 0, strictPort: false },
    });
    await server.listen();
    base = server.resolvedUrls.local[0].replace(/\/$/, "");
  }

  const browser = await chromium.launch();
  try {
    // Tall enough that the whole email renders without the canvas scrolling;
    // a clip outside the viewport would capture blank pixels.
    const context = await browser.newContext({
      viewport: { width: 1600, height: 5000 },
      deviceScaleFactor: 1,
      colorScheme: "light",
    });
    await context.addInitScript(() => {
      localStorage.setItem("tpl-playground-host-tour-dismissed", "true");
      localStorage.setItem("tpl-playground-theme", "light");
    });
    const page = await context.newPage();

    const manifestFile = join(ROOT, MANIFEST_PATH);
    const previous = existsSync(manifestFile)
      ? JSON.parse(readFileSync(manifestFile, "utf8"))
      : {};
    mkdirSync(join(ROOT, PROOF_DIR), { recursive: true });

    const captured = {};
    for (const scene of examples) {
      const { webp, height } = await capture(page, base, scene);
      writeFileSync(join(ROOT, "public", proofSrc(scene.id)), webp);
      captured[scene.id] = {
        src: proofSrc(scene.id),
        width: PROOF_WIDTH,
        height,
        contentHash: proofContentHash(
          scene.content({ search: new URLSearchParams() }),
        ),
      };
      console.log(
        `${scene.id}: ${PROOF_WIDTH}×${height}, ${Math.round(webp.length / 1024)} KB`,
      );
    }

    // Registry order, so a partial run does not reshuffle the file.
    const manifest = {};
    for (const scene of SCENES) {
      const entry = captured[scene.id] ?? previous[scene.id];
      if (scene.group === "examples" && entry) manifest[scene.id] = entry;
    }
    writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  } finally {
    await browser.close();
    await server?.close();
  }
}

await main();
