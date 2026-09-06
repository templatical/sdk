import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// @ts-expect-error — plain .mjs build script, no declarations
import {
  buildOrder,
  readFixtureRoots,
  readWorkspacePackages,
  resolveWorkspaceClosure,
  tarballPlaceholder,
} from "../scripts/consumer-fixture.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const FIXTURES_DIR = join(__dirname, "e2e-fixtures");

type Manifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const fake = (entries: Record<string, Manifest>) =>
  new Map(Object.entries(entries));

const readFixture = (name: string): Manifest & { overrides?: unknown } =>
  JSON.parse(
    readFileSync(join(FIXTURES_DIR, name, "package.json.tpl"), "utf8"),
  );

const fixtureNames = () =>
  readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

describe("tarballPlaceholder", () => {
  it("derives the token from the unscoped name", () => {
    expect(tarballPlaceholder("@templatical/editor")).toBe(
      "EDITOR_TARBALL_PLACEHOLDER",
    );
  });

  it("replaces every hyphen so multi-word names round-trip", () => {
    expect(tarballPlaceholder("@templatical/import-beefree")).toBe(
      "IMPORT_BEEFREE_TARBALL_PLACEHOLDER",
    );
    expect(tarballPlaceholder("@templatical/media-library")).toBe(
      "MEDIA_LIBRARY_TARBALL_PLACEHOLDER",
    );
  });
});

describe("readFixtureRoots", () => {
  it("collects scoped deps from both dependency fields", () => {
    expect(
      readFixtureRoots({
        dependencies: {
          "@templatical/editor": "EDITOR_TARBALL_PLACEHOLDER",
          vite: "^6.0.0",
        },
        devDependencies: {
          "@templatical/quality": "QUALITY_TARBALL_PLACEHOLDER",
        },
      }),
    ).toEqual(["@templatical/editor", "@templatical/quality"]);
  });

  it("rejects a spec that isn't the placeholder it substitutes", () => {
    expect(() =>
      readFixtureRoots({
        dependencies: { "@templatical/editor": "^0.27.1" },
      }),
    ).toThrow(
      'fixture declares @templatical/editor: "^0.27.1" — expected the placeholder "EDITOR_TARBALL_PLACEHOLDER"',
    );
  });
});

describe("resolveWorkspaceClosure", () => {
  const manifests = fake({
    "@templatical/editor": {
      peerDependencies: {
        "@templatical/renderer": "workspace:*",
        "@templatical/quality": "workspace:*",
      },
      devDependencies: { "@templatical/types": "workspace:*" },
    },
    "@templatical/renderer": {
      dependencies: { "@templatical/types": "workspace:*" },
    },
    "@templatical/quality": {
      dependencies: { "@templatical/types": "workspace:*" },
    },
    "@templatical/core": {
      dependencies: { "@templatical/types": "workspace:*" },
    },
    "@templatical/media-library": {
      dependencies: {
        "@templatical/core": "workspace:*",
        "@templatical/types": "workspace:*",
      },
    },
    "@templatical/types": {
      devDependencies: { "@templatical/media-library": "workspace:*" },
    },
  });

  it("pins nothing extra for the editor alone — it bundles types", () => {
    expect(resolveWorkspaceClosure(["@templatical/editor"], manifests)).toEqual(
      {
        closure: ["@templatical/editor"],
        transitive: [],
      },
    );
  });

  it("pulls types in through the renderer", () => {
    expect(
      resolveWorkspaceClosure(
        ["@templatical/editor", "@templatical/renderer"],
        manifests,
      ).transitive,
    ).toEqual(["@templatical/types"]);
  });

  it("pulls types in through quality just the same — the renderer is not special", () => {
    expect(
      resolveWorkspaceClosure(
        ["@templatical/editor", "@templatical/quality"],
        manifests,
      ).transitive,
    ).toEqual(["@templatical/types"]);
  });

  it("follows dependencies more than one level deep", () => {
    expect(
      resolveWorkspaceClosure(["@templatical/media-library"], manifests),
    ).toEqual({
      closure: [
        "@templatical/core",
        "@templatical/media-library",
        "@templatical/types",
      ],
      transitive: ["@templatical/core", "@templatical/types"],
    });
  });

  it("ignores peerDependencies — the editor's three are optional, so npm never installs them", () => {
    expect(
      resolveWorkspaceClosure(["@templatical/editor"], manifests).closure,
    ).not.toContain("@templatical/renderer");
  });

  it("throws on a root that isn't a workspace package", () => {
    expect(() =>
      resolveWorkspaceClosure(["@templatical/nope"], manifests),
    ).toThrow("@templatical/nope is not a workspace package under packages/");
  });
});

describe("buildOrder", () => {
  const manifests = fake({
    "@templatical/editor": {
      peerDependencies: { "@templatical/renderer": "workspace:*" },
      devDependencies: { "@templatical/types": "workspace:*" },
    },
    "@templatical/renderer": {
      dependencies: { "@templatical/types": "workspace:*" },
    },
    "@templatical/types": {},
  });

  it("builds a dependency before its dependent", () => {
    const order = buildOrder(
      ["@templatical/editor", "@templatical/renderer", "@templatical/types"],
      manifests,
    );
    expect(order).toEqual([
      "@templatical/types",
      "@templatical/renderer",
      "@templatical/editor",
    ]);
  });

  it("orders on peerDependencies too — the editor type-resolves the renderer's dist", () => {
    expect(
      buildOrder(
        ["@templatical/editor", "@templatical/renderer"],
        manifests,
      ).indexOf("@templatical/renderer"),
    ).toBe(0);
  });

  it("throws rather than emitting an arbitrary order for a cycle", () => {
    const cyclic = fake({
      "@templatical/a": { dependencies: { "@templatical/b": "workspace:*" } },
      "@templatical/b": { dependencies: { "@templatical/a": "workspace:*" } },
    });
    expect(() =>
      buildOrder(["@templatical/a", "@templatical/b"], cyclic),
    ).toThrow("cycle in @templatical build order");
  });
});

describe("the real workspace and fixtures", () => {
  const manifests = readWorkspacePackages(REPO_ROOT);

  it("reads every published package", () => {
    expect([...manifests.keys()].sort()).toEqual([
      "@templatical/core",
      "@templatical/editor",
      "@templatical/import-beefree",
      "@templatical/import-html",
      "@templatical/import-mjml",
      "@templatical/import-unlayer",
      "@templatical/media-library",
      "@templatical/quality",
      "@templatical/renderer",
      "@templatical/types",
    ]);
  });

  it("keeps the publish-order graph acyclic, so any closure can be ordered", () => {
    expect(buildOrder([...manifests.keys()], manifests)[0]).toBe(
      "@templatical/types",
    );
  });

  it("confirms the editor is the only package that bundles types", () => {
    const externalizes = [...manifests.values()]
      .filter((m: any) => m.dependencies?.["@templatical/types"])
      .map((m: any) => m.name)
      .sort();
    expect(externalizes).toEqual([
      "@templatical/core",
      "@templatical/import-beefree",
      "@templatical/import-html",
      "@templatical/import-mjml",
      "@templatical/import-unlayer",
      "@templatical/media-library",
      "@templatical/quality",
      "@templatical/renderer",
    ]);
  });

  it.each(fixtureNames())(
    "%s declares every scoped dep with the placeholder the script substitutes",
    (name) => {
      const roots = readFixtureRoots(readFixture(name));
      expect(roots).toContain("@templatical/editor");
      expect(resolveWorkspaceClosure(roots, manifests).closure).toContain(
        "@templatical/editor",
      );
    },
  );

  it.each(fixtureNames())(
    "%s hand-writes no overrides — the materializer synthesizes them",
    (name) => {
      expect(readFixture(name).overrides).toBeUndefined();
    },
  );

  it("pins types for the fixtures that install the renderer", () => {
    for (const name of ["vanilla-consumer", "webpack-consumer"]) {
      expect(
        resolveWorkspaceClosure(readFixtureRoots(readFixture(name)), manifests)
          .transitive,
      ).toEqual(["@templatical/types"]);
    }
  });

  it("pins nothing for the turbopack fixture, which installs the editor alone", () => {
    expect(
      resolveWorkspaceClosure(
        readFixtureRoots(readFixture("turbopack-consumer")),
        manifests,
      ).transitive,
    ).toEqual([]);
  });
});
