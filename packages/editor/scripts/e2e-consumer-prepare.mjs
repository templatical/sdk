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

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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

  log(`OK — consumer at ${CONSUMER_DIR}`);
} finally {
  rmSync(packDir, { recursive: true, force: true });
}
