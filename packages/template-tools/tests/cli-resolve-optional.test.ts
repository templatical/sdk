import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveOptional } from "../src/cli/resolve-optional";

/**
 * Build a throwaway project that has a package installed in its own
 * node_modules, at a path with no relationship to this test file — the geometry
 * an npx-cached CLI faces. A cwd-anchored resolver finds it; the CLI's own
 * resolution cannot.
 */
function projectWithPackage(name: string, body: string): string {
  const root = mkdtempSync(join(tmpdir(), "tt-consumer-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "consumer" }),
  );
  const pkgDir = join(root, "node_modules", name);
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(
    join(pkgDir, "package.json"),
    JSON.stringify({
      name,
      version: "1.0.0",
      type: "module",
      main: "index.js",
    }),
  );
  writeFileSync(join(pkgDir, "index.js"), body, "utf8");
  return root;
}

describe("resolveOptional", () => {
  it("finds a package installed in the consumer's cwd, not the CLI's location", async () => {
    const cwd = projectWithPackage(
      "fake-optional-dep",
      "export const marker = 'from-cwd';\n",
    );
    const mod = await resolveOptional<{ marker: string }>(
      "fake-optional-dep",
      cwd,
    );
    expect(mod?.marker).toBe("from-cwd");
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
});
