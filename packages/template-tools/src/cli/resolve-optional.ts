//
// Optional dependencies must resolve from the CONSUMER'S cwd, not from this
// module's location. When the CLI runs via npx it lives in npm's cache, so a
// package the user installs in their own project is invisible to the CLI's own
// resolution — and the remediation message ("npm install mjml") would be
// impossible to satisfy. Anchoring the walk at the cwd fixes that; the CLI's
// own directory is tried second, as a fallback — not for ajv (a hard
// `dependencies` entry, imported statically in src/validate.ts, so it never
// passes through this function at all), but for a global install (`npm
// install -g mjml` places the optional peer as a sibling of this package
// under one shared global node_modules that only this anchor can reach) and
// for this package's own tests, which anchor at a throwaway cwd outside the
// repo and rely on this anchor climbing from inside the repo tree up to the
// root node_modules holding the @templatical/import-* converters as root
// devDependencies.
//
// Resolution deliberately does NOT go through require.resolve()/createRequire.
// That API performs Node's CJS-invoked exports resolution, which checks the
// condition list ["require", "node", "default"] and never "import" — so it
// throws ERR_PACKAGE_PATH_NOT_EXPORTED for any package whose exports map
// declares only "import", which is every first-party package in this monorepo
// (CLAUDE.md's ESM-only rule: `exports` exposes only the "import" condition,
// never "require" or "main"). That map also omits "./package.json", so
// require.resolve can't even read the manifest to look further. The result
// under the old createRequire-based resolution: every @templatical/import-*
// converter reported as "not installed" even when built and present on disk.
// The ESM-native alternative, import.meta.resolve(specifier, parentURL),
// would honor the right condition set and resolve this cwd-anchored — but its
// second (parentURL) parameter, the one needed to anchor anywhere other than
// this module's own URL, is documented as requiring the
// --experimental-import-meta-resolve flag, and a published CLI that must run
// un-flagged on Node 20 and 22 cannot bet a core resolution path on that.
//
// The fix walks node_modules directories by hand (findPackageDir) — a plain
// filesystem read bypasses the exports map entirely — then reads the found
// package's own package.json and picks its entry file directly
// (entryFileFor), honoring exports["."].import, a string exports["."],
// exports["."].default, a root-string exports field, "module", then "main",
// in that order.
//
// Returning null instead of throwing lets callers distinguish "not installed"
// (exit 3, name the install command) from "installed but broken" (a real error
// worth surfacing). Same discipline as tryLoadRenderer() in
// packages/editor/src/utils/toMjml.ts: findPackageDir returning null is the
// only thing that continues to the next anchor — a found package's own entry
// resolution or import() is never caught, so a genuinely broken install
// propagates as a real error rather than a misleading install hint.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

interface ExportsConditions {
  import?: string;
  default?: string;
}

interface PackageManifest {
  exports?: string | Record<string, string | ExportsConditions>;
  module?: string;
  main?: string;
}

/**
 * Walk up from `dir` through every ancestor's node_modules looking for
 * <specifier>/package.json — the same directory-walk Node's own resolver uses
 * to locate a package, without then asking Node to apply exports-map
 * resolution. `dir` is normalized to an absolute path via `resolve()` before
 * the walk starts, so a relative anchor (e.g. ".") climbs real ancestors —
 * unnormalized, `dirname(".")` is "." forever and the walk would give up
 * after the first miss.
 */
function findPackageDir(specifier: string, dir: string): string | null {
  let current = resolve(dir);
  for (;;) {
    const candidate = join(current, "node_modules", specifier);
    if (existsSync(join(candidate, "package.json"))) return candidate;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * Pick a found package's entry file straight from its own manifest, honoring
 * exports["."].import, a string exports["."], exports["."].default, a
 * root-string exports field, "module", then "main" — the fields an ESM
 * consumer needs, read without Node's exports-map gating.
 */
function entryFileFor(pkgDir: string): string {
  const manifest = JSON.parse(
    readFileSync(join(pkgDir, "package.json"), "utf8"),
  ) as PackageManifest;

  const dot =
    manifest.exports && typeof manifest.exports === "object"
      ? manifest.exports["."]
      : undefined;
  const conditions = dot && typeof dot === "object" ? dot : undefined;
  // "exports": "./dist/index.js" — no "." key at all. PackageManifest already
  // types this shape; the code just never read it.
  const rootExports =
    typeof manifest.exports === "string" ? manifest.exports : undefined;

  const entry =
    conditions?.import ??
    (typeof dot === "string" ? dot : undefined) ??
    conditions?.default ??
    rootExports ??
    manifest.module ??
    manifest.main;

  // typeof, not just truthiness: the tsup/tsdown types-first shape nests
  // exports["."].import as a further conditions object ({ types, default }),
  // not a string. Without this check that object flows into join() below and
  // throws a raw `TypeError: The "path" argument must be of type string`
  // instead of this function's own, actionable error.
  if (!entry || typeof entry !== "string") {
    throw new Error(
      `${pkgDir} has no resolvable entry point (exports/module/main).`,
    );
  }
  return join(pkgDir, entry);
}

export async function resolveOptional<T>(
  specifier: string,
  cwd: string = process.cwd(),
): Promise<T | null> {
  const anchors = [cwd, dirname(fileURLToPath(import.meta.url))];

  for (const anchor of anchors) {
    const pkgDir = findPackageDir(specifier, anchor);
    if (!pkgDir) continue; // not found from this anchor — try the next
    const resolved = entryFileFor(pkgDir);
    return (await import(pathToFileURL(resolved).href)) as T;
  }
  return null;
}
