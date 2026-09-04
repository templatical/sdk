import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveOptional } from "../src/cli/resolve-optional";

/**
 * Build a throwaway project that has a package installed in its own
 * node_modules, at a path with no relationship to this test file — the geometry
 * an npx-cached CLI faces. A cwd-anchored resolver finds it; the CLI's own
 * resolution cannot.
 *
 * `manifest` is merged over the package name/version so callers can shape the
 * package as CJS-resolvable (a `main` field) or ESM-only (an `exports` map
 * declaring only "import", no `main` at all) — the two package shapes that
 * matter here, since only one of them worked under the old
 * createRequire()-based resolution.
 */
function projectWithPackage(
  name: string,
  body: string,
  manifest: Record<string, unknown>,
): string {
  const root = mkdtempSync(join(tmpdir(), "tt-consumer-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "consumer" }),
  );
  const pkgDir = join(root, "node_modules", name);
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(
    join(pkgDir, "package.json"),
    JSON.stringify({ name, version: "1.0.0", ...manifest }),
  );
  writeFileSync(join(pkgDir, "index.js"), body, "utf8");
  return root;
}

describe("resolveOptional", () => {
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it("finds a CJS-shaped package (a bare `main` field) installed in the consumer's cwd", async () => {
    const cwd = projectWithPackage(
      "fake-optional-dep-cjs",
      "export const marker = 'from-cwd-cjs';\n",
      { type: "module", main: "index.js" },
    );
    const mod = await resolveOptional<{ marker: string }>(
      "fake-optional-dep-cjs",
      cwd,
    );
    expect(mod?.marker).toBe("from-cwd-cjs");
  });

  it('finds an ESM-only package — an exports map declaring only "import", no main field', async () => {
    // This is the shape of every first-party @templatical/* package (this
    // repo's ESM-only rule): `exports["."]` has an "import" condition and
    // nothing else, and there is no top-level `main` at all. A
    // createRequire().resolve() applies CJS resolution conditions
    // (require/node/default) and throws ERR_PACKAGE_PATH_NOT_EXPORTED against
    // exactly this shape — which is the defect this case exists to catch.
    const cwd = projectWithPackage(
      "fake-optional-dep-esm",
      "export const marker = 'from-cwd-esm';\n",
      {
        type: "module",
        exports: { ".": { import: "./index.js" } },
      },
    );
    const mod = await resolveOptional<{ marker: string }>(
      "fake-optional-dep-esm",
      cwd,
    );
    expect(mod?.marker).toBe("from-cwd-esm");
  });

  it('finds a package via a root-string "exports" field (no "." key)', async () => {
    // "exports": "./index.js" — PackageManifest's type already declares this
    // shape (string | Record<...>); entryFileFor previously only ever read
    // the Record branch and fell through past module/main to "no entry".
    const cwd = projectWithPackage(
      "fake-optional-dep-root-exports",
      "export const marker = 'from-root-exports';\n",
      { type: "module", exports: "./index.js" },
    );
    const mod = await resolveOptional<{ marker: string }>(
      "fake-optional-dep-root-exports",
      cwd,
    );
    expect(mod?.marker).toBe("from-root-exports");
  });

  it('throws a clear error, not a raw TypeError, for a nested exports["."].import conditions object', async () => {
    // The tsup/tsdown "types-first" shape: exports["."].import is itself a
    // conditions object ({ types, default }), not a string. Handing that
    // object straight to node:path's join() throws
    // `TypeError: The "path" argument must be of type string`; entryFileFor
    // must catch it first and raise its own actionable error instead.
    const cwd = projectWithPackage(
      "fake-optional-dep-nested-conditions",
      "export const marker = 'unused';\n",
      {
        type: "module",
        exports: {
          ".": { import: { types: "./index.d.ts", default: "./index.js" } },
        },
      },
    );
    await expect(
      resolveOptional("fake-optional-dep-nested-conditions", cwd),
    ).rejects.toThrow(/has no resolvable entry point/);
  });

  it("returns null when the package is absent anywhere", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "tt-empty-"));
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "empty" }));
    expect(
      await resolveOptional("definitely-not-installed-xyz", cwd),
    ).toBeNull();
  });

  it("still resolves a package the CLI itself depends on", async () => {
    // ajv is a hard `dependencies` entry of this package (unlike mjml and the
    // importers, which are optional peers), so it is always present next to
    // the CLI's own install and must resolve even from a cwd that knows
    // nothing about it — exercising the second (CLI-directory) anchor.
    const cwd = mkdtempSync(join(tmpdir(), "tt-bare-"));
    const mod = await resolveOptional<{ default: unknown }>("ajv", cwd);
    // Ajv's default export is the constructor function itself (`new Ajv(...)`
    // in src/validate.ts) — a concrete check, not just "something came back".
    expect(typeof mod?.default).toBe("function");
  });

  it("finds a package via a relative anchor path that requires climbing", async () => {
    // The anchor must land two levels below a directory whose node_modules
    // does NOT hold the package, so the walk is forced to climb real
    // ancestors rather than finding it on the first check. Anchoring on ".."
    // from a single-level "subdir" would resolve (relative to the chdir'd
    // cwd) straight onto the project root's node_modules — found on the
    // first iteration, climbing zero levels either way. Two levels down with
    // "." as the anchor avoids that: unnormalized, dirname(".") is "."
    // forever, so the walk gives up after the first miss; normalized via
    // resolve(), it climbs project/a/b -> project/a -> project and finds it.
    const cwd = projectWithPackage(
      "fake-optional-dep-relative",
      "export const marker = 'from-relative-anchor';\n",
      { type: "module", main: "index.js" },
    );
    const nested = join(cwd, "a", "b");
    mkdirSync(nested, { recursive: true });
    process.chdir(nested);
    const mod = await resolveOptional<{ marker: string }>(
      "fake-optional-dep-relative",
      ".",
    );
    expect(mod?.marker).toBe("from-relative-anchor");
  });
});
