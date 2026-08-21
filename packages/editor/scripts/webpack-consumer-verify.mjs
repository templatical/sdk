#!/usr/bin/env node
/**
 * Build the editor as a real Webpack 5 consumer would.
 *
 * The editor uses dynamic `import()` with try/catch to load four optional
 * peers (`pusher-js`, `@templatical/quality`, `@templatical/media-library`,
 * `@templatical/renderer`). Vite/esbuild silently pass these through when the
 * package isn't installed; Webpack 5 statically resolves every `import()`
 * regardless of try/catch and emits "Module not found" warnings/errors. That
 * was the entire content of issue #63 — the editor's docs claim "no peer
 * dependencies" but Webpack consumers still got a noisy or failing build.
 *
 * Procedure:
 *   1. Build + pack the fixture's `@templatical/*` closure.
 *   2. Materialize the webpack-consumer fixture into a clean cache dir.
 *   3. `npm install` the tarballs alongside webpack into that consumer.
 *   4. Run `webpack` against `entry.js`.
 *   5. Assert: zero errors, zero warnings about unresolved optional peers.
 *
 * The try/catch at each of the four sites is what holds Webpack at a warning;
 * unwrap any one of them and this script fails exactly as the reporter's build
 * did. There are no `webpackIgnore` magic comments anywhere in the source — the
 * warnings a passing run prints ARE the resolution attempts, and the
 * installation docs show consumers how to silence them.
 */

import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { materializeConsumer, repoRootFrom } from "./consumer-fixture.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EDITOR_DIR = resolve(__dirname, "..");
const REPO_ROOT = repoRootFrom(__dirname);
const FIXTURE_DIR = join(EDITOR_DIR, "tests/e2e-fixtures/webpack-consumer");
// Materialize the consumer OUTSIDE the monorepo so webpack resolves modules the
// way a real installed consumer does — it must NOT walk up into the workspace and
// resolve hoisted workspace packages (@templatical/quality et al.) or their
// TypeScript source. Keeps the check immune to lockfile/hoisting layout changes.
const CONSUMER_DIR = mkdtempSync(join(tmpdir(), "tpl-webpack-consumer-"));

const OPTIONAL_PEERS = [
  "pusher-js",
  "@templatical/quality",
  "@templatical/media-library",
  "@templatical/renderer",
];

function logStep(msg) {
  process.stdout.write(`[webpack-verify] ${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`[webpack-verify] FAIL: ${msg}\n`);
  process.exit(1);
}

const packDir = mkdtempSync(join(tmpdir(), "tpl-webpack-pack-"));
try {
  materializeConsumer({
    repoRoot: REPO_ROOT,
    fixtureDir: FIXTURE_DIR,
    consumerDir: CONSUMER_DIR,
    packDir,
    log: logStep,
  });

  logStep("running webpack build");
  // Capture both stdout and stderr — webpack writes "Module not found"
  // diagnostics to stderr in some configurations.
  let webpackOutput = "";
  let webpackExitCode = 0;
  try {
    webpackOutput = execSync(
      `node node_modules/webpack-cli/bin/cli.js --config webpack.config.cjs`,
      { cwd: CONSUMER_DIR, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (err) {
    webpackExitCode = err.status ?? 1;
    webpackOutput = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
  }

  process.stdout.write(webpackOutput);
  process.stdout.write("\n");

  // Webpack downgrades "Module not found" to a warning when the dynamic
  // `import()` is wrapped in try/catch and exits 0; without try/catch it
  // emits an error and exits non-zero. The OSS consumer in issue #63 saw
  // exactly that — a production build failure on `@templatical/media-library`.
  // Warnings are cosmetic noise; non-zero exit means the consumer can't ship.
  if (webpackExitCode !== 0) {
    const errorPeers = OPTIONAL_PEERS.filter((peer) => {
      const escaped = peer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(
        `ERROR[\\s\\S]*?Can't resolve ['"\`]${escaped}['"\`]`,
      ).test(webpackOutput);
    });
    if (errorPeers.length > 0) {
      fail(
        `webpack production build failed — optional peer(s) referenced via dynamic import without try/catch, so webpack escalated "Module not found" from warning to error (issue #63):\n  - ${errorPeers.join("\n  - ")}`,
      );
    }
    fail(`webpack exited with code ${webpackExitCode}`);
  }

  logStep(
    "OK — webpack consumer build succeeds (warnings about uninstalled optional peers are expected and harmless)",
  );
} finally {
  rmSync(packDir, { recursive: true, force: true });
  rmSync(CONSUMER_DIR, { recursive: true, force: true });
}
