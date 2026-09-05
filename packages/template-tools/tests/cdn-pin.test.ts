import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { EDITOR_VERSION } from "../src/live/index";

const repoRoot = resolve(import.meta.dirname, "../../..");
const packageRoot = resolve(import.meta.dirname, "..");

function pkgVersion(relative: string): string {
  return JSON.parse(readFileSync(resolve(repoRoot, relative), "utf8")).version;
}

// Recursively collects every file under `dir` that contains a declaration
// matching DECLARATION_RE, built from parts so this file's own source never
// self-matches when the walk includes the tests/ directory.
const DECLARATION_RE = new RegExp(
  ["export const EDITOR_VERSION", "\\s*="].join(""),
);

function findEditorVersionDeclarations(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    if (entry.name.startsWith(".")) continue;
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findEditorVersionDeclarations(full));
    } else if (entry.isFile() && /\.(ts|mjs|js)$/.test(entry.name)) {
      if (DECLARATION_RE.test(readFileSync(full, "utf8"))) {
        found.push(full);
      }
    }
  }
  return found;
}

describe("CDN editor pin", () => {
  it("matches the workspace @templatical/editor version", () => {
    // The live harness loads the editor from the CDN at EDITOR_VERSION, while
    // schema.json is generated from @templatical/types. types + editor bump in
    // lockstep (changesets fixed group), so pinning to the editor version is
    // what keeps the live editor's block model equal to the schema's.
    expect(EDITOR_VERSION).toBe(pkgVersion("packages/editor/package.json"));
  });

  it("is published on purpose, and EDITOR_VERSION has exactly one declaration in this package", () => {
    // This package is published: no `private` field, and `publishConfig.access`
    // is "public". Asserting that is the point — a stray `private: true` would
    // silently un-publish it rather than fail loudly here.
    const pkg = JSON.parse(
      readFileSync(resolve(packageRoot, "package.json"), "utf8"),
    );
    expect(pkg.private).toBeFalsy();
    expect(pkg.publishConfig?.access).toBe("public");

    // Within this package, EDITOR_VERSION must be declared exactly once, in
    // src/live/index.ts — a second declaration anywhere else here could drift
    // from it silently. skills/templatical-email holds no copy to check
    // against: the live-preview harness lives entirely in this package, and
    // the skill carries only the content that teaches an agent to use it
    // (SKILL.md, the schema, the block guide, the examples).
    expect(findEditorVersionDeclarations(packageRoot)).toEqual([
      resolve(packageRoot, "src/live/index.ts"),
    ]);
  });
});

describe("live harness CDN hosts", () => {
  const html = readFileSync(
    resolve(repoRoot, "packages/template-tools/live/index.html"),
    "utf8",
  );

  it("loads every CDN asset from a single host", () => {
    const hosts = new Set(
      [...html.matchAll(/https:\/\/([a-z0-9.-]+)\/[^"'\s)]*/gi)]
        .map((match) => match[1].toLowerCase())
        // Fonts and doc links are not module/asset CDNs — only script, style
        // and dynamic-import sources matter here.
        .filter(
          (host) =>
            !host.includes("fonts.") &&
            !(host === "templatical.com" || host.endsWith(".templatical.com")),
        ),
    );
    expect([...hosts]).toEqual(["cdn.jsdelivr.net"]);
  });

  it("keeps the editor off unpkg", () => {
    // Named explicitly so the reason survives even if the host set above is
    // ever widened for an unrelated asset. unpkg intermittently served the
    // editor's lazy chunks as text/plain with a failed CORS preflight: the entry
    // booted and only the deferred chunk died, surfacing as toMjml()'s
    // misleading "install @templatical/renderer" error.
    expect(html).not.toMatch(/unpkg\.com\/@templatical\/editor/);
  });

  it("pins mjml-browser to the same major as the renderer's mjml", () => {
    // The harness compiles MJML to HTML in the browser with mjml-browser,
    // while @templatical/renderer's own round-trip tests compile with `mjml`
    // — the two must share a major, or the preview renders through a
    // different compiler than the one the renderer's output is verified
    // against. A version pinned inside a CDN URL in an HTML file is invisible
    // to Renovate, so nothing else here flags a drift. Deriving the expected
    // major from the renderer's own devDependency, rather than hardcoding a
    // number, is what makes an MJML major bump there fail here until the
    // harness follows.
    const rendererPkg = JSON.parse(
      readFileSync(
        resolve(repoRoot, "packages/renderer/package.json"),
        "utf8",
      ),
    );
    const declared = rendererPkg.devDependencies?.mjml;
    expect(declared).toMatch(/^\D*\d+\./);
    const expected = declared.match(/(\d+)\./)[1];

    const pins = [...html.matchAll(/mjml-browser@(\d+)/g)].map(
      (match) => match[1],
    );
    // Exactly one pin, on the renderer's major. An empty array here means the
    // import was removed or renamed rather than that the pin is fine.
    expect(pins).toEqual([expected]);
  });
});
