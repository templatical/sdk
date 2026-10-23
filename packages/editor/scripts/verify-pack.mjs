#!/usr/bin/env node
/**
 * Verify the published-tarball install footprint.
 *
 * Bundle-topology unit tests (tests/bundle-topology.test.ts) catch regressions
 * inside the built `.js` files, but they don't catch the case where someone
 * adds a runtime `dependency` to package.json — that ships fine in the bundle
 * yet bloats every consumer's node_modules and re-introduces transitive copies
 * of bundled libraries (Vue, Tiptap, etc.). This script catches that.
 *
 * Procedure:
 *   1. Pack the editor and its default-install workspace dependency closure.
 *   2. Create a fresh consumer manifest with local tarball overrides.
 *   3. Install normally and verify quality's lintTemplate API is available.
 *   4. Assert: total package count is reasonable; bundled runtime copies absent.
 *
 * Run:
 *   node packages/editor/scripts/verify-pack.mjs
 *
 * Or via npm script:
 *   pnpm --filter @templatical/editor run verify:pack
 */

import { execSync, execFileSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  readdirSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  packClosure,
  readWorkspacePackages,
  resolveWorkspaceClosure,
  withTarballs,
} from "./consumer-fixture.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EDITOR_DIR = resolve(__dirname, "..");

// Tunable thresholds. If your editor legitimately needs more packages, raise
// MAX_PACKAGES (and explain why in the commit). Lowering it tightens the guard.
const MAX_PACKAGES = 90;

// These packages MUST NOT appear in a consumer's node_modules — they're either
// bundled into the editor's published .js (so a consumer copy is redundant
// bloat) or they would re-introduce the duplicate-Vue-instance bug if present
// (see CONTRIBUTING.md "Architecture overview").
const FORBIDDEN_PACKAGES = [
  "vue",
  "@vue/reactivity",
  "@vue/runtime-core",
  "@vue/runtime-dom",
  "@templatical/core",
  "@vueuse/core",
  "vue-draggable-plus",
  "@tiptap/core",
  "@tiptap/vue-3",
  "@tiptap/starter-kit",
  "@lucide/vue",
  "vue-advanced-cropper",
];
// Types is allowed: quality leaves @templatical/types external at runtime.

function logStep(msg) {
  process.stdout.write(`[verify-pack] ${msg}\n`);
}

function fail(msg) {
  process.stderr.write(`[verify-pack] FAIL: ${msg}\n`);
  process.exit(1);
}

function listTopLevelPackages(nodeModulesDir) {
  if (!existsSync(nodeModulesDir)) return [];
  const out = [];
  for (const entry of readdirSync(nodeModulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === ".bin" || entry.name === ".package-lock.json") continue;
    if (entry.name.startsWith("@")) {
      // Scoped: read sub-entries
      const scopeDir = join(nodeModulesDir, entry.name);
      for (const sub of readdirSync(scopeDir, { withFileTypes: true })) {
        if (sub.isDirectory()) out.push(`${entry.name}/${sub.name}`);
      }
    } else {
      out.push(entry.name);
    }
  }
  return out;
}

const tarballDir = mkdtempSync(join(tmpdir(), "tpl-pack-"));
const consumerDir = mkdtempSync(join(tmpdir(), "tpl-consumer-"));

try {
  const repoRoot = resolve(EDITOR_DIR, "../..");
  const manifests = readWorkspacePackages(repoRoot);
  const { closure, transitive } = resolveWorkspaceClosure(
    ["@templatical/editor"],
    manifests,
  );
  logStep(`packing default-install closure: ${closure.join(", ")}`);
  const tarballs = packClosure({
    repoRoot,
    closure,
    manifests,
    packDir: tarballDir,
    log: logStep,
  });

  logStep(`creating clean consumer project in ${consumerDir}`);
  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify(
      withTarballs(
        {
          name: "verify-pack-consumer",
          version: "0.0.0",
          private: true,
          dependencies: {
            "@templatical/editor": tarballs.get("@templatical/editor"),
          },
        },
        tarballs,
        transitive,
      ),
      null,
      2,
    ),
  );

  logStep("npm install (default optional dependencies included)");
  execSync("npm install --no-fund --no-audit", {
    cwd: consumerDir,
    stdio: "inherit",
  });

  const nodeModules = join(consumerDir, "node_modules");
  const installed = listTopLevelPackages(nodeModules);
  logStep(`installed top-level packages: ${installed.length}`);

  if (!installed.includes("@templatical/quality")) {
    fail("default install did not include @templatical/quality");
  }
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'import { lintTemplate } from "@templatical/quality"; if (typeof lintTemplate !== "function") throw new Error("quality API missing");',
    ],
    { cwd: consumerDir, stdio: "inherit" },
  );
  logStep("default install includes quality and its lintTemplate API");

  const violations = installed.filter((p) => FORBIDDEN_PACKAGES.includes(p));
  if (violations.length > 0) {
    fail(
      `forbidden packages found in consumer node_modules — these must be bundled into the editor, not declared as runtime deps:\n  - ${violations.join("\n  - ")}`,
    );
  }

  if (installed.length > MAX_PACKAGES) {
    fail(
      `consumer install footprint too large: ${installed.length} packages (max ${MAX_PACKAGES}).\n` +
        `Inspect editor's package.json — required editor runtime libraries belong in the bundle, while quality is intentionally an optional dependency; see CONTRIBUTING.md "Architecture overview".`,
    );
  }

  logStep(
    `OK — ${installed.length} packages, no forbidden deps in consumer node_modules`,
  );
} finally {
  // Best-effort cleanup; on Windows, locked files may linger.
  try {
    rmSync(tarballDir, { recursive: true, force: true });
  } catch {}
  try {
    rmSync(consumerDir, { recursive: true, force: true });
  } catch {}
}
