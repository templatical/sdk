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
 *   1. `pnpm pack` the editor package into a temp directory.
 *   2. `npm init -y` a fresh consumer project in another temp dir.
 *   3. `npm install <tarball>` and read the resulting node_modules.
 *   4. Assert: total package count is reasonable; forbidden packages absent.
 *
 * Run:
 *   node packages/editor/scripts/verify-pack.mjs
 *
 * Or via npm script:
 *   pnpm --filter @templatical/editor run verify:pack
 */

import { execSync } from "node:child_process";
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const EDITOR_DIR = resolve(__dirname, "..");

// Tunable thresholds. If your editor legitimately needs more packages, raise
// MAX_PACKAGES (and explain why in the commit). Lowering it tightens the guard.
const MAX_PACKAGES = 90;

// These packages MUST NOT appear in a consumer's node_modules — they're either
// bundled into the editor's published .js (so a consumer copy is redundant
// bloat) or they would re-introduce the duplicate-Vue-instance bug if present
// (see CLAUDE.md "Editor is fully self-contained").
const FORBIDDEN_PACKAGES = [
  "vue",
  "@vue/reactivity",
  "@vue/runtime-core",
  "@vue/runtime-dom",
  "@templatical/core",
  "@templatical/types",
  "@vueuse/core",
  "vuedraggable",
  "@tiptap/core",
  "@tiptap/vue-3",
  "@tiptap/starter-kit",
  "@lucide/vue",
];

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
  logStep(`packing @templatical/editor → ${tarballDir}`);
  execSync(`pnpm pack --pack-destination "${tarballDir}"`, {
    cwd: EDITOR_DIR,
    stdio: "inherit",
  });

  const tarball = readdirSync(tarballDir).find((f) => f.endsWith(".tgz"));
  if (!tarball) fail("no .tgz produced by pnpm pack");

  const tarballPath = join(tarballDir, tarball);
  logStep(`tarball: ${tarballPath}`);

  logStep(`creating clean consumer project in ${consumerDir}`);
  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify(
      { name: "verify-pack-consumer", version: "0.0.0", private: true },
      null,
      2,
    ),
  );

  logStep("npm install <tarball>");
  execSync(`npm install "${tarballPath}" --no-fund --no-audit`, {
    cwd: consumerDir,
    stdio: "inherit",
  });

  const nodeModules = join(consumerDir, "node_modules");
  const installed = listTopLevelPackages(nodeModules);
  logStep(`installed top-level packages: ${installed.length}`);

  const violations = installed.filter((p) => FORBIDDEN_PACKAGES.includes(p));
  if (violations.length > 0) {
    fail(
      `forbidden packages found in consumer node_modules — these must be bundled into the editor, not declared as runtime deps:\n  - ${violations.join("\n  - ")}`,
    );
  }

  if (installed.length > MAX_PACKAGES) {
    fail(
      `consumer install footprint too large: ${installed.length} packages (max ${MAX_PACKAGES}).\n` +
        `Inspect editor's package.json — anything in 'dependencies' is a candidate to move to 'devDependencies' (then bundle inline). See CLAUDE.md "Editor's runtime dependencies should be empty".`,
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
