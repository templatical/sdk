import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EDITOR_VERSION } from "../scripts/live-server.mjs";
import {
  applyEditorVersion,
  applyPluginPatchBump,
  bumpPatch,
} from "../tools/sync-editor-version.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

describe("live-mode CDN pin", () => {
  // The live harness loads the editor from the CDN at EDITOR_VERSION. That
  // version MUST match the repo's @templatical/editor — which shares a version
  // with @templatical/types (changesets fixed group), the package
  // reference/schema.json is generated from. So a matching pin means the live
  // editor's block model matches the schema the skill validates against. When a
  // release bumps the suite, this fails until EDITOR_VERSION is bumped too,
  // forcing the pin to stay in lockstep with the regenerated schema.
  it("pins EDITOR_VERSION to the repo's @templatical/editor version", () => {
    const editorPkg = JSON.parse(read("../../../packages/editor/package.json"));
    expect(EDITOR_VERSION).toBe(editorPkg.version);
  });

  it("resolves the harness's CDN URLs through the injected placeholder, not a hardcoded version", () => {
    const html = read("../live/index.html");
    // The server injects EDITOR_VERSION into {{EDITOR_VERSION}} at serve time,
    // so EDITOR_VERSION in live-server.mjs is the single source of the pin.
    expect(html).toContain(
      "@templatical/editor@{{EDITOR_VERSION}}/dist/cdn/editor.js",
    );
    expect(html).toContain(
      "@templatical/editor@{{EDITOR_VERSION}}/dist/cdn/editor.css",
    );
    // A literal @x.y.z on the editor URL would silently drift from EDITOR_VERSION.
    expect(html).not.toMatch(/@templatical\/editor@\d+\.\d+\.\d+/);
  });

  // The harness rides ONE CDN. A mixed setup is what broke MJML export: unpkg
  // served the editor's lazy chunks as text/plain with a failed CORS preflight,
  // so the entry booted but the deferred renderer chunk died — reported by
  // toMjml()'s catch-all as a missing @templatical/renderer install.
  it("loads every CDN asset from a single host", () => {
    const html = read("../live/index.html");
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

  // The harness compiles MJML to HTML in the browser with mjml-browser, while
  // @templatical/renderer's round-trip tests compile with `mjml`. If the two
  // drift by a major, the preview renders through a different compiler than the
  // one the renderer's output is actually verified against. This pin sat a full
  // major behind for exactly that reason: Renovate cannot see a version inside a
  // CDN URL in an HTML file, so nothing flagged it. Deriving the expected major
  // from the renderer's own devDependency means an MJML major bump there fails
  // here until the harness follows.
  it("pins mjml-browser to the same major as the renderer's mjml", () => {
    const rendererPkg = JSON.parse(
      read("../../../packages/renderer/package.json"),
    );
    const declared = rendererPkg.devDependencies?.mjml;
    expect(declared).toMatch(/^\D*\d+\./);
    const expected = declared.match(/(\d+)\./)[1];

    const pins = [
      ...read("../live/index.html").matchAll(/mjml-browser@(\d+)/g),
    ].map((match) => match[1]);
    // Exactly one pin, on the renderer's major. An empty array here means the
    // import was removed or renamed rather than that the pin is fine.
    expect(pins).toEqual([expected]);
  });

  it("keeps the editor off unpkg", () => {
    // Named explicitly so the reason survives even if the host set above is
    // ever widened for an unrelated asset.
    expect(read("../live/index.html")).not.toMatch(/unpkg\.com\/@templatical\/editor/);
  });
});

describe("sync-editor-version", () => {
  // The release-time sync (root `changeset:version`) rewrites EDITOR_VERSION
  // from packages/editor/package.json. These guard the rewrite itself.
  it("rewrites the EDITOR_VERSION declaration to the given version", () => {
    const src = 'a\nexport const EDITOR_VERSION = "0.17.0";\nb\n';
    expect(applyEditorVersion(src, "1.2.3")).toBe(
      'a\nexport const EDITOR_VERSION = "1.2.3";\nb\n',
    );
  });

  it("throws when the declaration is absent (so a rename can't silently no-op)", () => {
    expect(() => applyEditorVersion("no declaration here", "1.2.3")).toThrow(
      /EDITOR_VERSION/,
    );
  });

  // A new EDITOR_VERSION changes what the live harness loads, but Claude Code
  // caches the plugin by plugin.json's version — so the release-time sync has to
  // bump that too or existing installs keep the old pin. See the doc comment on
  // bumpPluginVersion.
  it("patch-bumps a plain semver plugin version", () => {
    expect(bumpPatch("0.2.0")).toBe("0.2.1");
    expect(bumpPatch("1.9.9")).toBe("1.9.10");
  });

  it("refuses to guess at a non-semver plugin version", () => {
    for (const bad of ["0.2", "1.0.0-beta.1", "v1.0.0", "", undefined]) {
      expect(() => bumpPatch(bad as string)).toThrow(/plain x\.y\.z/);
    }
  });

  it("rewrites only the version string in plugin.json, preserving formatting", () => {
    const src = read("../.claude-plugin/plugin.json");
    const { src: next, from, to } = applyPluginPatchBump(src);

    expect(to).toBe(bumpPatch(from));
    // Same document, one field changed: byte-identical apart from the version,
    // so key order and 2-space formatting survive a release-time bump.
    expect(next.replace(`"version": "${to}"`, `"version": "${from}"`)).toBe(src);
    expect(JSON.parse(next).version).toBe(to);
    expect(Object.keys(JSON.parse(next))).toEqual(Object.keys(JSON.parse(src)));
  });

  it("throws when plugin.json has no version field", () => {
    expect(() => applyPluginPatchBump('{ "name": "x" }')).toThrow(/version/);
  });

  it("leaves the committed live-server.mjs unchanged (pin already synced)", () => {
    const editorPkg = JSON.parse(read("../../../packages/editor/package.json"));
    const src = read("../scripts/live-server.mjs");
    // Applying the current editor version must be a no-op — i.e. the committed
    // pin is already in sync (the same invariant cdn-pin guards, via the sync).
    expect(applyEditorVersion(src, editorPkg.version)).toBe(src);
  });
});
