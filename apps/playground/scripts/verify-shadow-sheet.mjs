#!/usr/bin/env node
/**
 * Verify the built playground's shadow-root stylesheet holds the editor's CSS
 * only.
 *
 * The playground compiles the editor from source, so its build is the one
 * place `inline-style-css-plugin` could inline the host's CSS (Tailwind
 * preflight) into the sheet the editor adopts. The e2e suite runs `vite dev`
 * and never sees this build, which is what play.templatical.com serves.
 *
 * Run after `pnpm --filter @templatical/playground run build`:
 *   pnpm --filter @templatical/playground run verify:shadow-sheet
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EDITOR_CSS_MARKER, findHostRules } from "./shadow-sheet-lib.mjs";

const ASSETS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../dist/assets",
);

if (!existsSync(ASSETS)) {
  console.error(
    `verify-shadow-sheet: ${ASSETS} not found. Build the playground first.`,
  );
  process.exit(1);
}

const carriers = readdirSync(ASSETS)
  .filter((file) => file.endsWith(".js"))
  .map((file) => ({ file, code: readFileSync(join(ASSETS, file), "utf8") }))
  .filter(({ code }) => code.includes(EDITOR_CSS_MARKER));

if (carriers.length === 0) {
  console.error(
    `verify-shadow-sheet: no chunk carries the editor stylesheet (marker ${JSON.stringify(EDITOR_CSS_MARKER)}).`,
  );
  process.exit(1);
}

let failed = false;
for (const { file, code } of carriers) {
  const found = findHostRules(code);
  if (found.length === 0) {
    console.log(`verify-shadow-sheet: ${file} carries the editor's CSS only.`);
    continue;
  }
  failed = true;
  console.error(`verify-shadow-sheet: ${file} carries host CSS:`);
  for (const name of found) console.error(`  - ${name}`);
}

if (failed) {
  console.error(
    "The playground's own CSS reached the editor's shadow root. Check `ownedRoots` in apps/playground/vite.config.ts.",
  );
  process.exit(1);
}
