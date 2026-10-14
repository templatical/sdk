// Rasterizes the social icon SVG source into PNGs that ship with the npm
// tarball (jsdelivr serves them at the version-pinned URL referenced by
// `DEFAULT_SOCIAL_ICONS_BASE_URL`). Runs as part of `pnpm build`.
//
// PNGs are derived artifacts — not committed to git. The SVG path + brand
// color data comes from `SOCIAL_ICON_GLYPHS` in `@templatical/types` — the
// single source of truth shared with the editor's inline-SVG renderer.
//
// Outputs `assets/social/{dir}/{platform}.png` at 144×144 (3× the largest
// 48px display size), compressed losslessly by oxipng, one folder per style
// and tone: `socialIconAssetDir` names it, and `socialIconColors` picks the
// colors, the same rules the editor's inline SVG follows.
// A dark `plain` or `outlined` icon also gets `socialIconHalo`.

import { renderAsync } from "@resvg/resvg-js";
// The single-thread codec: the package's default entry checks for the
// browser's ImageData, which Node doesn't have.
import initOxipng, {
  optimise,
} from "@jsquash/oxipng/codec/pkg/squoosh_oxipng.js";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SOCIAL_ICON_TONES,
  SOCIAL_ICON_GLYPHS,
  SOCIAL_ICON_STYLES,
  socialIconAssetDir,
  socialIconColors,
  socialIconGlyphScale,
  socialIconHalo,
} from "@templatical/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../assets/social");
const RENDER_SIZE = 144;
// oxipng's default level: higher ones save about 0.5% for several times
// the build time.
const OXIPNG_LEVEL = 2;
const VIEW_SIZE = 24;
const OUTLINE_WIDTH = 2;

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
      bgShape = `<rect width="22" height="22" x="1" y="1" rx="3" fill="transparent" stroke="${fill}" stroke-width="${OUTLINE_WIDTH}"/>`;
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
  const halo = socialIconHalo(style, tone);
  const haloStroke = (width) =>
    `fill="none" stroke="${halo.color}" stroke-opacity="${halo.opacity}" stroke-width="${width}" stroke-linejoin="round"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_SIZE} ${VIEW_SIZE}" width="${VIEW_SIZE}" height="${VIEW_SIZE}">` +
    (halo && style === "outlined"
      ? `<rect width="22" height="22" x="1" y="1" rx="3" ${haloStroke(OUTLINE_WIDTH + halo.width)}/>`
      : "") +
    bgShape +
    `<g transform="translate(${offset}, ${offset}) scale(${scale})">` +
    (halo ? `<path d="${path}" ${haloStroke(halo.width / scale)}/>` : "") +
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
  const png = optimise(rendered.asPng(), OXIPNG_LEVEL, false, false);
  await writeFile(resolve(dir, `${platform}.png`), png);
}

async function main() {
  const start = performance.now();
  const require = createRequire(import.meta.url);
  await initOxipng(
    await readFile(
      require.resolve("@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm"),
    ),
  );
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
