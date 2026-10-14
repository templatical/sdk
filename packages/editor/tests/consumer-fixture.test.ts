import { readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// @ts-expect-error — plain .mjs build script, no declarations
import {
  buildOrder,
  readExampleRoots,
  readFixtureRoots,
  readWorkspacePackages,
  resolveWorkspaceClosure,
  shouldCopyExampleEntry,
  tarballPlaceholder,
  vanillaConsumerDir,
  withTarballs,
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

const EXAMPLES_DIR = join(REPO_ROOT, "examples");

const readExample = (name: string): Manifest =>
  JSON.parse(readFileSync(join(EXAMPLES_DIR, name, "package.json"), "utf8"));

const exampleNames = () =>
  readdirSync(EXAMPLES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

describe("vanillaConsumerDir", () => {
  // A consumer inside the repo also resolves bare imports from the repo-root
  // node_modules, where pnpm links workspace packages; it then cannot model
  // an optional peer the app did not install.
  it("sits outside the repo, in the OS temp folder", () => {
    const dir = vanillaConsumerDir(REPO_ROOT);
    expect(relative(REPO_ROOT, dir).startsWith("..")).toBe(true);
    expect(dir.startsWith(tmpdir())).toBe(true);
  });

  it("is stable for one checkout and differs between checkouts", () => {
    // Playwright re-imports its config per process, so the path cannot be
    // random; two worktrees running at once must not share one.
    expect(vanillaConsumerDir("/work/sdk")).toBe(
      vanillaConsumerDir("/work/sdk"),
    );
    expect(vanillaConsumerDir("/work/sdk")).not.toBe(
      vanillaConsumerDir("/work/sdk-worktree"),
    );
  });
});

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

  it("orders on peerDependencies too", () => {
    const order = buildOrder(
      ["@templatical/editor", "@templatical/renderer"],
      manifests,
    );
    expect(order.indexOf("@templatical/renderer")).toBeLessThan(
      order.indexOf("@templatical/editor"),
    );
  });

  it("builds a member's workspace devDependencies, and what they depend on, before it", () => {
    // The editor bundles core, and core needs types' dist/ to build.
    const bundling = fake({
      "@templatical/editor": {
        devDependencies: { "@templatical/core": "workspace:*" },
      },
      "@templatical/core": {
        dependencies: { "@templatical/types": "workspace:*" },
      },
      "@templatical/types": {},
    });
    expect(buildOrder(["@templatical/editor"], bundling)).toEqual([
      "@templatical/types",
      "@templatical/core",
      "@templatical/editor",
    ]);
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

/**
 * The first workspace dependency cycle reachable in `manifests`, as an arrow
 * chain, or `null` when the graph is acyclic.
 *
 * pnpm 12+ refuses to run a recursive script whose selection contains a cycle
 * (`ERR_PNPM_TASK_CYCLE`), and it aborts before executing anything — so one
 * cycle among `packages/*` takes out `pnpm run typecheck` and `pnpm run test`
 * wholesale. It walks `devDependencies` too, because pnpm's task graph does.
 */
const findWorkspaceCycle = (
  manifests: Map<string, Manifest>,
): string | null => {
  const DONE = 1;
  const VISITING = 0;
  const state = new Map<string, number>();
  const path: string[] = [];

  const visit = (name: string): string | null => {
    if (state.get(name) === DONE) return null;
    if (state.get(name) === VISITING) {
      return [...path.slice(path.indexOf(name)), name].join(" -> ");
    }
    state.set(name, VISITING);
    path.push(name);
    const edges = (
      ["dependencies", "devDependencies", "peerDependencies"] as const
    )
      .flatMap((field) => Object.keys(manifests.get(name)?.[field] ?? {}))
      .filter((dep) => manifests.has(dep));
    for (const dep of edges) {
      const cycle = visit(dep);
      if (cycle) return cycle;
    }
    path.pop();
    state.set(name, DONE);
    return null;
  };

  for (const name of manifests.keys()) {
    const cycle = visit(name);
    if (cycle) return cycle;
  }
  return null;
};

describe("the real workspace, fixtures and examples", () => {
  const manifests = readWorkspacePackages(REPO_ROOT);

  it("reads every published package", () => {
    expect([...manifests.keys()].sort()).toEqual([
      "@templatical/core",
      "@templatical/editor",
      "@templatical/import-beefree",
      "@templatical/import-chamaileon",
      "@templatical/import-easy-email-pro",
      "@templatical/import-html",
      "@templatical/import-mjml",
      "@templatical/import-stripo",
      "@templatical/import-topol",
      "@templatical/import-unlayer",
      "@templatical/media-library",
      "@templatical/quality",
      "@templatical/renderer",
      "@templatical/template-tools",
      "@templatical/types",
    ]);
  });

  it("keeps the build graph acyclic, so any closure can be ordered", () => {
    expect(buildOrder([...manifests.keys()], manifests)[0]).toBe(
      "@templatical/types",
    );
  });

  it("has no workspace dependency cycle, so pnpm can order recursive tasks", () => {
    expect(findWorkspaceCycle(manifests)).toBe(null);
  });

  it("detects a cycle when one exists", () => {
    // Positive control, and the shape to never reintroduce: a types
    // dependency on media-library closes types -> media-library -> core ->
    // types.
    expect(
      findWorkspaceCycle(
        fake({
          "@templatical/types": {
            devDependencies: { "@templatical/media-library": "workspace:*" },
          },
          "@templatical/media-library": {
            dependencies: { "@templatical/core": "workspace:*" },
          },
          "@templatical/core": {
            dependencies: { "@templatical/types": "workspace:*" },
          },
        }),
      ),
    ).toBe(
      "@templatical/types -> @templatical/media-library -> @templatical/core -> @templatical/types",
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
      "@templatical/import-chamaileon",
      "@templatical/import-easy-email-pro",
      "@templatical/import-html",
      "@templatical/import-mjml",
      "@templatical/import-stripo",
      "@templatical/import-topol",
      "@templatical/import-unlayer",
      "@templatical/media-library",
      "@templatical/quality",
      "@templatical/renderer",
      "@templatical/template-tools",
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

  // The editor's build reads its four workspace devDependencies from their
  // dist/: `vite build` bundles core and types, and `vue-tsc` type-resolves
  // all four. A fresh checkout has none of them, so each is built first.
  const EDITOR_BUILD = [
    "@templatical/types",
    "@templatical/core",
    "@templatical/media-library",
    "@templatical/quality",
    "@templatical/renderer",
    "@templatical/editor",
  ];

  it.each(fixtureNames())(
    "%s builds every package the editor's build reads, ahead of the editor",
    (name) => {
      const { closure } = resolveWorkspaceClosure(
        readFixtureRoots(readFixture(name)),
        manifests,
      );
      expect(buildOrder(closure, manifests)).toEqual(EDITOR_BUILD);
    },
  );

  it.each(exampleNames())(
    "examples/%s builds every package the editor's build reads, ahead of the editor",
    (name) => {
      const { closure } = resolveWorkspaceClosure(
        readExampleRoots(readExample(name), manifests),
        manifests,
      );
      expect(buildOrder(closure, manifests)).toEqual(EDITOR_BUILD);
    },
  );
});

describe("example materialization helpers", () => {
  const manifests = new Map<
    string,
    { name: string; version: string; dependencies?: Record<string, string> }
  >([
    ["@templatical/editor", { name: "@templatical/editor", version: "0.43.3" }],
    [
      "@templatical/renderer",
      {
        name: "@templatical/renderer",
        version: "0.43.3",
        dependencies: { "@templatical/types": "workspace:*" },
      },
    ],
    ["@templatical/types", { name: "@templatical/types", version: "0.43.3" }],
  ]);

  it("accepts ranges equal to ^<workspace version> and returns the roots in declaration order", () => {
    expect(
      readExampleRoots(
        {
          dependencies: {
            next: "^16.0.0",
            "@templatical/editor": "^0.43.3",
            "@templatical/renderer": "^0.43.3",
          },
        },
        manifests,
      ),
    ).toEqual(["@templatical/editor", "@templatical/renderer"]);
  });

  it("rejects a stale range and names sync-pins", () => {
    expect(() =>
      readExampleRoots(
        { dependencies: { "@templatical/editor": "^0.42.0" } },
        manifests,
      ),
    ).toThrow(
      'example declares @templatical/editor: "^0.42.0" — expected "^0.43.3" (run: pnpm --filter @templatical/template-tools run sync-pins)',
    );
  });

  it("rejects a @templatical package that is not in the workspace", () => {
    expect(() =>
      readExampleRoots(
        { dependencies: { "@templatical/nope": "^0.43.3" } },
        manifests,
      ),
    ).toThrow("@templatical/nope is not a workspace package under packages/");
  });

  it("reads devDependencies after dependencies, with the same range rule", () => {
    expect(
      readExampleRoots(
        {
          dependencies: { "@templatical/editor": "^0.43.3" },
          devDependencies: { "@templatical/types": "^0.43.3" },
        },
        manifests,
      ),
    ).toEqual(["@templatical/editor", "@templatical/types"]);
    expect(() =>
      readExampleRoots(
        { devDependencies: { "@templatical/types": "^0.42.0" } },
        manifests,
      ),
    ).toThrow(
      'example declares @templatical/types: "^0.42.0" — expected "^0.43.3"',
    );
  });

  it("rewrites direct @templatical deps to tarballs and pins only the transitive ones", () => {
    const input = {
      name: "x",
      dependencies: { react: "^19.0.0", "@templatical/editor": "^0.43.3" },
    };
    const tarballs = new Map([
      ["@templatical/editor", "file:/p/templatical-editor-0.43.3.tgz"],
      ["@templatical/types", "file:/p/templatical-types-0.43.3.tgz"],
    ]);
    const out = withTarballs(input, tarballs, ["@templatical/types"]);
    expect(out.dependencies).toEqual({
      react: "^19.0.0",
      "@templatical/editor": "file:/p/templatical-editor-0.43.3.tgz",
    });
    expect(out.overrides).toEqual({
      "@templatical/types": "file:/p/templatical-types-0.43.3.tgz",
    });
    expect(typeof out["//overrides"]).toBe("string");
    expect(input.dependencies["@templatical/editor"]).toBe("^0.43.3");
  });

  it("adds no overrides when nothing is transitive", () => {
    const out = withTarballs(
      { dependencies: { "@templatical/types": "^0.43.3" } },
      new Map([["@templatical/types", "file:/p/t.tgz"]]),
      [],
    );
    expect(out).toEqual({
      dependencies: { "@templatical/types": "file:/p/t.tgz" },
    });
  });

  it("rewrites @templatical devDependencies to tarballs as well", () => {
    expect(
      withTarballs(
        {
          devDependencies: {
            "@templatical/types": "^0.43.3",
            typescript: "^6.0.0",
          },
        },
        new Map([["@templatical/types", "file:/p/t.tgz"]]),
        [],
      ),
    ).toEqual({
      devDependencies: {
        "@templatical/types": "file:/p/t.tgz",
        typescript: "^6.0.0",
      },
    });
  });

  it.each([
    ["/x/examples/nextjs/node_modules", false],
    ["/x/examples/nextjs/.next", false],
    ["/x/examples/nuxt/.nuxt", false],
    ["/x/examples/nuxt/.output", false],
    ["/x/examples/sveltekit/.svelte-kit", false],
    ["/x/examples/react-router/.react-router", false],
    ["/x/examples/react-router/build", false],
    ["/x/examples/react-vite/dist", false],
    ["/x/examples/nextjs/data", false],
    ["/x/examples/nextjs/package-lock.json", false],
    ["/x/examples/nextjs/pnpm-lock.yaml", false],
    ["/x/examples/nextjs/yarn.lock", false],
    ["/x/examples/nextjs/bun.lock", false],
    ["/x/examples/nextjs/bun.lockb", false],
    ["/x/examples/nextjs/app/page.tsx", true],
    ["/x/examples/nextjs/package.json", true],
  ])("shouldCopyExampleEntry(%s) is %s", (path, expected) => {
    expect(shouldCopyExampleEntry(path)).toBe(expected);
  });
});
