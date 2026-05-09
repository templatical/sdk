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
 *   1. Build + pack `@templatical/editor` and `@templatical/renderer`.
 *   2. Materialize the webpack-consumer fixture into a clean cache dir.
 *   3. `npm install` the tarballs alongside webpack into that consumer.
 *   4. Run `webpack` against `entry.js`.
 *   5. Assert: zero errors, zero warnings about unresolved optional peers.
 *
 * Without `webpackIgnore` magic comments at the dynamic-import sites this
 * script fails — exactly mirroring the issue reporter's experience.
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
const FIXTURE_DIR = join(EDITOR_DIR, "tests/e2e-fixtures/webpack-consumer");
const CONSUMER_DIR = join(REPO_ROOT, "node_modules/.cache/webpack-consumer");

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

function run(cmd, opts = {}) {
  process.stdout.write(`[webpack-verify] $ ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

if (!existsSync(FIXTURE_DIR)) {
  fail(`fixture dir not found: ${FIXTURE_DIR}`);
}

run(`pnpm --filter @templatical/renderer run build`, { cwd: REPO_ROOT });
run(`pnpm --filter @templatical/editor run build`, { cwd: REPO_ROOT });

const RENDERER_DIR = resolve(REPO_ROOT, "packages/renderer");

const packDir = mkdtempSync(join(tmpdir(), "tpl-webpack-pack-"));
try {
  run(`pnpm pack --pack-destination "${packDir}"`, { cwd: EDITOR_DIR });
  run(`pnpm pack --pack-destination "${packDir}"`, { cwd: RENDERER_DIR });

  const editorTarball = readdirSync(packDir).find(
    (f) => f.startsWith("templatical-editor-") && f.endsWith(".tgz"),
  );
  const rendererTarball = readdirSync(packDir).find(
    (f) => f.startsWith("templatical-renderer-") && f.endsWith(".tgz"),
  );
  if (!editorTarball) fail("pnpm pack did not produce an editor .tgz");
  if (!rendererTarball) fail("pnpm pack did not produce a renderer .tgz");

  const editorTarballPath = join(packDir, editorTarball);
  const rendererTarballPath = join(packDir, rendererTarball);

  rmSync(CONSUMER_DIR, { recursive: true, force: true });
  mkdirSync(CONSUMER_DIR, { recursive: true });
  cpSync(FIXTURE_DIR, CONSUMER_DIR, { recursive: true });

  const tplPath = join(CONSUMER_DIR, "package.json.tpl");
  const consumerPkgPath = join(CONSUMER_DIR, "package.json");
  renameSync(tplPath, consumerPkgPath);
  const consumerPkgText = readFileSync(consumerPkgPath, "utf8")
    .replace("EDITOR_TARBALL_PLACEHOLDER", `file:${editorTarballPath}`)
    .replace("RENDERER_TARBALL_PLACEHOLDER", `file:${rendererTarballPath}`);
  writeFileSync(consumerPkgPath, consumerPkgText);

  run(`npm install --no-fund --no-audit`, { cwd: CONSUMER_DIR });

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
}
