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
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { materializeConsumer, repoRootFrom } from "./consumer-fixture.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EDITOR_DIR = resolve(__dirname, "..");
const REPO_ROOT = repoRootFrom(__dirname);
const FIXTURE_DIR = join(EDITOR_DIR, "tests/e2e-fixtures/vanilla-consumer");
const CONSUMER_DIR = join(REPO_ROOT, "node_modules/.cache/e2e-consumer");

const log = (msg) => process.stdout.write(`[e2e-prep] ${msg}\n`);

const packDir = mkdtempSync(join(tmpdir(), "tpl-e2e-pack-"));
try {
  // The renderer is an optional peer of the editor; the fixture installs both
  // because we exercise `editor.toMjml()`. Everything the two pull in
  // transitively is packed and pinned too — see consumer-fixture.mjs.
  materializeConsumer({
    repoRoot: REPO_ROOT,
    fixtureDir: FIXTURE_DIR,
    consumerDir: CONSUMER_DIR,
    packDir,
    log,
  });

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

  // The dev server the smoke runs against never resolves an `import()` it
  // doesn't reach, so a consumer's production build is the only place an
  // undeclared optional import fails. The fixture installs no `pusher-js`.
  // This directory sits inside the repo's node_modules, so a bare import also
  // resolves from every ancestor node_modules; the build proves nothing once
  // `pusher-js` is in one of them. Check those folders the way a bundler does,
  // not with Node's resolver: it also reads NODE_PATH, which pnpm's `.bin`
  // shims point at its hoist folder, and Vite never consults it.
  const leakedPusher = ancestorNodeModules(CONSUMER_DIR).find((dir) =>
    existsSync(join(dir, "pusher-js", "package.json")),
  );
  if (leakedPusher) {
    throw new Error(
      `pusher-js is installed in ${leakedPusher}, where the consumer resolves bare imports, so its production build can no longer catch an undeclared optional import`,
    );
  }
  log("running the consumer's production build (vite build)");
  execSync("node node_modules/vite/bin/vite.js build --logLevel warn", {
    cwd: CONSUMER_DIR,
    stdio: "inherit",
  });

  log(`OK — consumer at ${CONSUMER_DIR}`);
} finally {
  rmSync(packDir, { recursive: true, force: true });
}

/** Every `node_modules` folder a bare import from `dir` is looked up in. */
function ancestorNodeModules(dir) {
  const folders = [];
  for (let current = dir; ; current = dirname(current)) {
    folders.push(
      basename(current) === "node_modules"
        ? current
        : join(current, "node_modules"),
    );
    if (dirname(current) === current) return folders;
  }
}
