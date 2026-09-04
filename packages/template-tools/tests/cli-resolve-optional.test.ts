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

  it("returns null when the package is absent anywhere", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "tt-empty-"));
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "empty" }));
    expect(
      await resolveOptional("definitely-not-installed-xyz", cwd),
    ).toBeNull();
  });

  it("still resolves a package the CLI itself depends on", async () => {
    // ajv is a real dependency of this package, so it must resolve even from a
    // cwd that knows nothing about it.
    const cwd = mkdtempSync(join(tmpdir(), "tt-bare-"));
    expect(await resolveOptional("ajv", cwd)).not.toBeNull();
  });

  it("finds a package via a relative anchor path that requires climbing", async () => {
    // Verify that relative paths like ".." are normalized to absolute paths
    // before walking node_modules. Without normalization, dirname() operates
    // lexically and never climbs real ancestors, so the walk gets stuck.
    // This is critical for CLI usage where --cwd might be a relative path
    // from the user's shell.
    const cwd = projectWithPackage(
      "fake-optional-dep-relative",
      "export const marker = 'from-relative-anchor';\n",
      { type: "module", main: "index.js" },
    );
    // Create a nested subdirectory and chdir into it
    const subdir = join(cwd, "subdir");
    mkdirSync(subdir, { recursive: true });
    process.chdir(subdir);
    // Now try to resolve the package using a relative path that climbs up
    // Without normalization, ".." is resolved lexically by dirname, never
    // reaching the parent's node_modules.
    const mod = await resolveOptional<{ marker: string }>(
      "fake-optional-dep-relative",
      "..",
    );
    expect(mod?.marker).toBe("from-relative-anchor");
  });
});
