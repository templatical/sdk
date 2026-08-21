#!/usr/bin/env node
/**
 * Build the editor as a real Next.js + Turbopack consumer would.
 *
 * Webpack tolerates legacy module-detection forms (UMD/AMD `typeof define ===
 * "function" && define.amd`) inside dependencies it bundles. Turbopack does
 * not — it errors out with `TP1200 unsupported AMD define() dependency element
 * form` and refuses to compile the consumer. That breaks any Next.js 15+ app
 * (Turbopack is the default builder) that imports `@templatical/editor`.
 *
 * Procedure:
 *   1. Build + pack the fixture's `@templatical/*` closure.
 *   2. Materialize the turbopack-consumer fixture into a clean cache dir.
 *   3. `npm install` the tarball alongside next/react/react-dom.
 *   4. Run `next build --turbopack`.
 *   5. Assert: zero TP1200 errors, build exits 0.
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
const FIXTURE_DIR = join(EDITOR_DIR, "tests/e2e-fixtures/turbopack-consumer");
const CONSUMER_DIR = join(REPO_ROOT, "node_modules/.cache/turbopack-consumer");

function logStep(msg) {
  process.stdout.write(`[turbopack-verify] ${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`[turbopack-verify] FAIL: ${msg}\n`);
  process.exit(1);
}

const packDir = mkdtempSync(join(tmpdir(), "tpl-turbopack-pack-"));
try {
  // This fixture installs the editor alone, which bundles types — so the
  // closure is one package and no overrides are synthesized. Adding an optional
  // peer here would pull its transitive types in, and the shared materializer
  // pins it without this script changing.
  materializeConsumer({
    repoRoot: REPO_ROOT,
    fixtureDir: FIXTURE_DIR,
    consumerDir: CONSUMER_DIR,
    packDir,
    log: logStep,
  });

  logStep("running next build with turbopack");
  let buildOutput = "";
  let buildExitCode = 0;
  try {
    buildOutput = execSync(
      `node node_modules/next/dist/bin/next build --turbopack`,
      {
        cwd: CONSUMER_DIR,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      },
    );
  } catch (err) {
    buildExitCode = err.status ?? 1;
    buildOutput = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
  }

  process.stdout.write(buildOutput);
  process.stdout.write("\n");

  if (/error TP1200/.test(buildOutput)) {
    fail(
      "next build failed with TP1200 — a published chunk in dist/ contains a UMD/AMD `define()` wrapper that Turbopack rejects. Find the offending dep (search dist/ for `define.amd`), and either swap it for an ESM-only equivalent or import its ESM source directly so the wrapper isn't bundled.",
    );
  }
  if (buildExitCode !== 0) {
    fail(`next build exited with code ${buildExitCode}`);
  }

  logStep("OK — next build with turbopack succeeds");
} finally {
  rmSync(packDir, { recursive: true, force: true });
}
