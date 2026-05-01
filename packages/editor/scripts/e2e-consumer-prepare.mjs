#!/usr/bin/env node
/**
 * Materialize a tiny vanilla consumer (just an HTML page that calls `init()`)
 * into a temp directory, then build + pack the editor and install the tarball
 * into that consumer. Playwright's webServer command then runs `vite` against
 * the materialized directory. Combined with the smoke spec this catches the
 * duplicate-Vue-reactivity-instance class of regression — the editor renders
 * chrome but every interaction silently no-ops — exactly as a real consumer
 * would experience it.
 *
 * No checked-in consumer project. Fixtures live under
 * `packages/editor/tests/e2e-fixtures/vanilla-consumer/` and are copied into
 * `<repo>/node_modules/.cache/e2e-consumer/` (ignored by git, predictable
 * across runs and platforms).
 *
 * Idempotent — wipes the cache dir before re-materializing.
 */

import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EDITOR_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(EDITOR_DIR, "../..");
const FIXTURE_DIR = join(EDITOR_DIR, "tests/e2e-fixtures/vanilla-consumer");
const CONSUMER_DIR = join(REPO_ROOT, "node_modules/.cache/e2e-consumer");

function run(cmd, opts = {}) {
  process.stdout.write(`[e2e-prep] $ ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

if (!existsSync(FIXTURE_DIR)) {
  throw new Error(`fixture dir not found: ${FIXTURE_DIR}`);
}

// Build editor and renderer in dependency order so packed tarballs ship the
// latest local source. The renderer is an optional peer of the editor; the
// e2e consumer installs both because we exercise `editor.toMjml()`.
run(`pnpm --filter @templatical/renderer run build`, { cwd: REPO_ROOT });
run(`pnpm --filter @templatical/editor run build`, { cwd: REPO_ROOT });

const RENDERER_DIR = resolve(REPO_ROOT, "packages/renderer");

const packDir = mkdtempSync(join(tmpdir(), "tpl-e2e-pack-"));
try {
  run(`pnpm pack --pack-destination "${packDir}"`, { cwd: EDITOR_DIR });
  run(`pnpm pack --pack-destination "${packDir}"`, { cwd: RENDERER_DIR });
  const editorTarball = readdirSync(packDir).find(
    (f) => f.startsWith("templatical-editor-") && f.endsWith(".tgz"),
  );
  const rendererTarball = readdirSync(packDir).find(
    (f) => f.startsWith("templatical-renderer-") && f.endsWith(".tgz"),
  );
  if (!editorTarball)
    throw new Error("pnpm pack did not produce an editor .tgz");
  if (!rendererTarball)
    throw new Error("pnpm pack did not produce a renderer .tgz");
  const editorTarballPath = join(packDir, editorTarball);
  const rendererTarballPath = join(packDir, rendererTarball);

  rmSync(CONSUMER_DIR, { recursive: true, force: true });
  mkdirSync(CONSUMER_DIR, { recursive: true });
  cpSync(FIXTURE_DIR, CONSUMER_DIR, { recursive: true });

  // The fixture ships its package.json as `package.json.tpl` so syncpack and
  // pnpm don't treat it as a workspace package. Rename + interpolate the
  // tarball specs here.
  const tplPath = join(CONSUMER_DIR, "package.json.tpl");
  const consumerPkgPath = join(CONSUMER_DIR, "package.json");
  renameSync(tplPath, consumerPkgPath);
  const consumerPkgText = readFileSync(consumerPkgPath, "utf8")
    .replace("EDITOR_TARBALL_PLACEHOLDER", `file:${editorTarballPath}`)
    .replace("RENDERER_TARBALL_PLACEHOLDER", `file:${rendererTarballPath}`);
  writeFileSync(consumerPkgPath, consumerPkgText);

  run(`npm install --no-fund --no-audit`, { cwd: CONSUMER_DIR });

  // Sanity-check: published artifacts that we claim consumers can import must
  // actually arrive in node_modules.
  const installedDist = join(
    CONSUMER_DIR,
    "node_modules/@templatical/editor/dist",
  );
  for (const expected of ["templatical-editor.js", "style.css"]) {
    if (!existsSync(join(installedDist, expected))) {
      throw new Error(
        `expected ${expected} in installed editor's dist/ — install or build is broken`,
      );
    }
  }

  process.stdout.write(`[e2e-prep] OK — consumer at ${CONSUMER_DIR}\n`);
} finally {
  rmSync(packDir, { recursive: true, force: true });
}
