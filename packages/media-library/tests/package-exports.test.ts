import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every subpath in `package.json#exports` must point at a file the build
 * writes. `./style.css` pointed at `dist/style.css` from the first release,
 * while Vite names the library's CSS after `build.lib.fileName`
 * (`templatical-media-library.css`), so `import
 * '@templatical/media-library/style.css'` — the import the README documents —
 * failed to resolve, and the real file wasn't exported either. npm consumers
 * had no way to load the stylesheet.
 *
 * Runs against the build output. Requires `pnpm run build` first; in CI the
 * test job runs after build.
 */

const PKG_DIR = join(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(PKG_DIR, "package.json"), "utf8")) as {
  exports: Record<string, string | Record<string, string>>;
};

/** Every file path an export entry names, conditions flattened. */
function targets(entry: string | Record<string, string>): string[] {
  return typeof entry === "string" ? [entry] : Object.values(entry);
}

describe("package exports", () => {
  it("point at files the build writes", () => {
    const paths = Object.values(pkg.exports).flatMap(targets);
    // Guard against an exports map that silently lists nothing.
    expect(paths.length).toBeGreaterThanOrEqual(3);

    const missing = paths.filter((path) => !existsSync(join(PKG_DIR, path)));
    expect(
      missing,
      "Run `pnpm --filter @templatical/media-library run build` first, " +
        "or point the export at the file the build writes.",
    ).toEqual([]);
  });

  it("export the stylesheet the standalone library renders with", () => {
    const style = pkg.exports["./style.css"];
    expect(typeof style).toBe("string");

    const css = readFileSync(join(PKG_DIR, style as string), "utf8");
    // The `.tpl` theme and the scoped chrome reset both ship in it.
    expect(css).toContain("--tpl-base-size");
    expect(css).toContain(".tpl-email-surface");
  });
});
