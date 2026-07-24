import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EDITOR_VERSION } from "../scripts/live-server.mjs";
import { applyEditorVersion } from "../scripts/sync-editor-version.mjs";

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

  it("leaves the committed live-server.mjs unchanged (pin already synced)", () => {
    const editorPkg = JSON.parse(read("../../../packages/editor/package.json"));
    const src = read("../scripts/live-server.mjs");
    // Applying the current editor version must be a no-op — i.e. the committed
    // pin is already in sync (the same invariant cdn-pin guards, via the sync).
    expect(applyEditorVersion(src, editorPkg.version)).toBe(src);
  });
});
