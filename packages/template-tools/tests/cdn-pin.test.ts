import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EDITOR_VERSION } from "../src/live/index";

const repoRoot = resolve(import.meta.dirname, "../../..");

function pkgVersion(relative: string): string {
  return JSON.parse(readFileSync(resolve(repoRoot, relative), "utf8")).version;
}

describe("CDN editor pin", () => {
  it("matches the workspace @templatical/editor version", () => {
    // The live harness loads the editor from the CDN at EDITOR_VERSION, while
    // schema.json is generated from @templatical/types. types + editor bump in
    // lockstep (changesets fixed group), so pinning to the editor version is
    // what keeps the live editor's block model equal to the schema's.
    expect(EDITOR_VERSION).toBe(pkgVersion("packages/editor/package.json"));
  });

  it("is declared here and nowhere else", () => {
    // This package is internal and unversioned, so the pin cannot be checked
    // against its own version — the editor version above is the only anchor.
    // What must stay true is that no second declaration exists to drift from
    // it: the skill's CLI re-exports this value through its vendored bundle.
    const pkg = JSON.parse(
      readFileSync(
        resolve(repoRoot, "packages/template-tools/package.json"),
        "utf8",
      ),
    );
    expect(pkg.private).toBe(true);

    const skillCli = readFileSync(
      resolve(
        repoRoot,
        "plugins/templatical/skills/templatical-email/scripts/live-server.mjs",
      ),
      "utf8",
    );
    expect(skillCli).not.toMatch(/export const EDITOR_VERSION\s*=/);
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
});
