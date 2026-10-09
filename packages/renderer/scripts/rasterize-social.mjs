// Rasterizes the social icon SVG source into PNGs that ship with the npm
// tarball (jsdelivr serves them at the version-pinned URL referenced by
// `DEFAULT_SOCIAL_ICONS_BASE_URL`). Runs as part of `pnpm build`.
//
// PNGs are derived artifacts — not committed to git. The SVG path + brand
// color data comes from `SOCIAL_ICON_GLYPHS` in `@templatical/types` — the
// single source of truth shared with the editor's inline-SVG renderer.
//
// Outputs `assets/social/{dir}/{platform}.png` at 192×192 (8× retina for
// the default 24px display size; scales cleanly to 48px), one folder per style
// and tone: `socialIconAssetDir` names it, and `socialIconColors` picks the
// colors, the same rules the editor's inline SVG follows.

import { renderAsync } from "@resvg/resvg-js";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SOCIAL_ICON_TONES,
  SOCIAL_ICON_GLYPHS,
  SOCIAL_ICON_STYLES,
  socialIconAssetDir,
  socialIconColors,
  socialIconGlyphScale,
} from "@templatical/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../assets/social");
const RENDER_SIZE = 192;
const VIEW_SIZE = 24;

function buildSvg(platform, style, tone) {
  const { path } = SOCIAL_ICON_GLYPHS[platform];
  const { fill, onFill } = socialIconColors(platform, tone);
  let glyphColor = onFill;
  let bgShape;
  switch (style) {
    case "circle":
      bgShape = `<circle cx="12" cy="12" r="12" fill="${fill}"/>`;
      break;
    case "rounded":
      bgShape = `<rect width="24" height="24" rx="6" fill="${fill}"/>`;
      break;
    case "square":
      bgShape = `<rect width="24" height="24" rx="0" fill="${fill}"/>`;
      break;
    case "outlined":
      bgShape = `<rect width="22" height="22" x="1" y="1" rx="3" fill="transparent" stroke="${fill}" stroke-width="2"/>`;
      glyphColor = fill;
      break;
    case "plain":
      bgShape = "";
      glyphColor = fill;
      break;
    default:
      bgShape = `<rect width="24" height="24" rx="3" fill="${fill}"/>`;
      break;
  }
  const scale = socialIconGlyphScale(style);
  const offset = Number(((VIEW_SIZE * (1 - scale)) / 2).toFixed(3));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_SIZE} ${VIEW_SIZE}" width="${VIEW_SIZE}" height="${VIEW_SIZE}">` +
    bgShape +
    `<g transform="translate(${offset}, ${offset}) scale(${scale})">` +
    `<path d="${path}" fill="${glyphColor}"/>` +
    `</g></svg>`
  );
}

async function renderOne(platform, style, tone, dir) {
  const svg = buildSvg(platform, style, tone);
  const rendered = await renderAsync(svg, {
    fitTo: { mode: "width", value: RENDER_SIZE },
    shapeRendering: 2,
    textRendering: 2,
    imageRendering: 0,
  });
  await writeFile(resolve(dir, `${platform}.png`), rendered.asPng());
}

async function main() {
  const start = performance.now();
  await rm(OUT_DIR, { recursive: true, force: true });

  const platforms = Object.keys(SOCIAL_ICON_GLYPHS);
  const jobs = [];
  for (const style of SOCIAL_ICON_STYLES) {
    for (const tone of SOCIAL_ICON_TONES) {
      const dir = resolve(OUT_DIR, socialIconAssetDir(style, tone));
      await mkdir(dir, { recursive: true });
      for (const platform of platforms) {
        jobs.push(renderOne(platform, style, tone, dir));
      }
    }
  }
  await Promise.all(jobs);

  const ms = Math.round(performance.now() - start);
  console.log(`rasterize-social: wrote ${jobs.length} PNGs in ${ms}ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
