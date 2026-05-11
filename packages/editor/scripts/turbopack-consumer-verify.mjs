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
 *   1. Build + pack `@templatical/editor`.
 *   2. Materialize the turbopack-consumer fixture into a clean cache dir.
 *   3. `npm install` the tarball alongside next/react/react-dom.
 *   4. Run `next build --turbopack`.
 *   5. Assert: zero TP1200 errors, build exits 0.
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
const FIXTURE_DIR = join(EDITOR_DIR, "tests/e2e-fixtures/turbopack-consumer");
const CONSUMER_DIR = join(REPO_ROOT, "node_modules/.cache/turbopack-consumer");

function logStep(msg) {
  process.stdout.write(`[turbopack-verify] ${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`[turbopack-verify] FAIL: ${msg}\n`);
  process.exit(1);
}

function run(cmd, opts = {}) {
  process.stdout.write(`[turbopack-verify] $ ${cmd}\n`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

if (!existsSync(FIXTURE_DIR)) {
  fail(`fixture dir not found: ${FIXTURE_DIR}`);
}

run(`pnpm --filter @templatical/editor run build`, { cwd: REPO_ROOT });

const packDir = mkdtempSync(join(tmpdir(), "tpl-turbopack-pack-"));
try {
  run(`pnpm pack --pack-destination "${packDir}"`, { cwd: EDITOR_DIR });

  const editorTarball = readdirSync(packDir).find(
    (f) => f.startsWith("templatical-editor-") && f.endsWith(".tgz"),
  );
  if (!editorTarball) fail("pnpm pack did not produce an editor .tgz");

  const editorTarballPath = join(packDir, editorTarball);

  rmSync(CONSUMER_DIR, { recursive: true, force: true });
  mkdirSync(CONSUMER_DIR, { recursive: true });
  cpSync(FIXTURE_DIR, CONSUMER_DIR, { recursive: true });

  const tplPath = join(CONSUMER_DIR, "package.json.tpl");
  const consumerPkgPath = join(CONSUMER_DIR, "package.json");
  renameSync(tplPath, consumerPkgPath);
  const consumerPkgText = readFileSync(consumerPkgPath, "utf8").replace(
    "EDITOR_TARBALL_PLACEHOLDER",
    `file:${editorTarballPath}`,
  );
  writeFileSync(consumerPkgPath, consumerPkgText);

  run(`npm install --no-fund --no-audit`, { cwd: CONSUMER_DIR });

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
