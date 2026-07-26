import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildBanner,
  TARGETS,
  vendoredVersion,
  VENDOR_DIR,
} from "../tools/bundle-vendor.mjs";

const vendored = (file: string) =>
  readFileSync(resolve(VENDOR_DIR, file), "utf8");

describe("vendored dependencies", () => {
  // The bundles are committed so the skill needs no `npm install` — Claude
  // Code's plugin cache is keyed by version, so an installed node_modules never
  // survives an update. That only holds while each bundle tracks the version the
  // workspace resolves: a Renovate bump of ajv, or a release of
  // @templatical/quality, must be followed by a re-bundle. At release time
  // tools/sync-editor-version.mjs does it automatically; this is the safety net
  // for every other path.
  it.each(TARGETS.map((t) => [t.name, t.file, t.version] as const))(
    "%s bundle tracks the version the workspace resolves",
    (_name, file, version) => {
      expect(vendoredVersion(vendored(file))).toBe(version());
    },
  );

  it.each(TARGETS.map((t) => [t.name, t.file] as const))(
    "%s bundle carries its licence attribution",
    (_name, file) => {
      expect(vendored(file)).toContain("MIT License");
    },
  );

  it("records versions in the exact shape the freshness check parses", () => {
    // Guards the banner/parser pair itself: a reformat that broke both sides
    // would otherwise make every check above pass vacuously on a stale bundle.
    expect(
      vendoredVersion(buildBanner({ name: "x", version: "9.9.9", notice: "n" })),
    ).toBe("9.9.9");
    expect(vendoredVersion("no banner here")).toBeNull();
  });

  it("ajv validates with no node_modules resolution", async () => {
    // Absolute-path import: proves the artifact is self-contained rather than
    // silently falling back to a hoisted copy in the workspace.
    const { default: Ajv } = await import(resolve(VENDOR_DIR, "ajv.mjs"));
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validate = ajv.compile({
      type: "object",
      properties: { a: { type: "string" } },
      required: ["a"],
    });

    expect(validate({ a: "ok" })).toBe(true);
    expect(validate({})).toBe(false);
    expect(validate.errors?.[0].message).toBe(
      "must have required property 'a'",
    );
  });

  it("quality lints with no node_modules resolution", async () => {
    // Bundled from dist rather than src — the rule registries use Vite's
    // import.meta.glob, which esbuild cannot resolve. A src-built bundle throws
    // "(intermediate value).glob is not a function" on import, so importing and
    // actually running a rule here is what catches that regression.
    const { lintTemplate } = await import(resolve(VENDOR_DIR, "quality.mjs"));
    const issues = lintTemplate({
      blocks: [
        {
          id: "img_1",
          type: "image",
          styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
          src: "https://example.com/x.png",
          alt: "",
          width: 100,
          align: "center",
        },
      ],
      settings: {
        width: 600,
        backgroundColor: "#ffffff",
        textColor: "#000000",
        linkUnderline: true,
        fontFamily: "Arial, sans-serif",
        locale: "en",
      },
    });

    expect(issues.map((i: { ruleId: string }) => i.ruleId)).toContain(
      "a11y.img-missing-alt",
    );
  });
});
