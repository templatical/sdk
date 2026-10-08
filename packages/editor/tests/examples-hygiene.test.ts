import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// @ts-expect-error — plain .mjs build script, no declarations
import { shouldCopyExampleEntry } from "../scripts/consumer-fixture.mjs";

const REPO = join(import.meta.dirname, "../../..");
const EXAMPLES = join(REPO, "examples");

const LOCKFILES = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
];

// What each example's production build writes, which must never be committed.
const BUILD_OUTPUT: Record<string, string> = {
  nextjs: ".next/",
  nuxt: ".output/",
  sveltekit: "build/",
  "react-router": "build/",
  "react-vite": "dist/",
};

// The component that mounts the editor in each example. Each one must
// unmount an editor whose init() resolves after its cleanup has already run:
// React StrictMode does that to every effect in development, and agents copy
// these files.
const EDITOR_COMPONENTS: Record<string, string> = {
  nextjs: "app/email-editor.tsx",
  nuxt: "app/components/EmailEditor.client.vue",
  sveltekit: "src/lib/EmailEditor.svelte",
  "react-router": "app/components/email-editor.tsx",
  "react-vite": "src/email-editor.tsx",
};
const LATE_UNMOUNT =
  /if \((?:cancelled|unmounted)\) \{\s*(?:ed|instance)\.unmount\(\);\s*return;\s*\}/;

const examples = readdirSync(EXAMPLES)
  .filter((name) => statSync(join(EXAMPLES, name)).isDirectory())
  .sort();

/** The lockfiles among `files`, which are repo-relative paths. */
const lockfilesAmong = (files: string[]) =>
  files.filter((file) => LOCKFILES.includes(file.split("/").pop() ?? ""));

describe("examples/", () => {
  it("names a build output and an editor component for every example on disk", () => {
    expect(examples).toEqual(Object.keys(BUILD_OUTPUT).sort());
    expect(examples).toEqual(Object.keys(EDITOR_COMPONENTS).sort());
  });

  it("recognises a lockfile at any depth under examples/", () => {
    expect(
      lockfilesAmong([
        "examples/nextjs/package.json",
        "examples/nextjs/package-lock.json",
        "examples/nuxt/bun.lockb",
        "examples/README.md",
      ]),
    ).toEqual(["examples/nextjs/package-lock.json", "examples/nuxt/bun.lockb"]);
  });

  it("commits no lockfile", () => {
    const tracked = execFileSync("git", ["ls-files", "--", "examples"], {
      cwd: REPO,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
    expect(lockfilesAmong(tracked)).toEqual([]);
  });

  it("has an index README", () => {
    expect(existsSync(join(EXAMPLES, "README.md"))).toBe(true);
  });

  it("runs every example in CI's examples matrix", () => {
    // The examples job's matrix decides which apps CI builds and runs; an
    // example missing from it would never be checked.
    const ci = readFileSync(join(REPO, ".github/workflows/ci.yml"), "utf8");
    const matrix = /^\s+example:\s*\[([^\]]*)\]/m.exec(ci)?.[1] ?? "";
    expect(
      matrix
        .split(",")
        .map((name) => name.trim())
        .sort(),
    ).toEqual(examples);
  });
});

describe.each(examples)("examples/%s", (name) => {
  const dir = join(EXAMPLES, name);

  it("has a README", () => {
    expect(existsSync(join(dir, "README.md"))).toBe(true);
  });

  it("has no committable file the copy filter would drop", () => {
    // examples-verify.mjs copies an example through shouldCopyExampleEntry,
    // which skips install, build, data and lockfile names at any depth. Any
    // file git would commit under such a name, say a source folder called
    // dist/, would vanish from the copy.
    const files = execFileSync(
      "git",
      [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "--",
        `examples/${name}`,
      ],
      { cwd: REPO, encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean);
    expect(files.length).toBeGreaterThan(0);
    const dropped = files.filter((file) => {
      const parts = file.split("/").slice(2);
      return parts.some(
        (_, i) => !shouldCopyExampleEntry(join(dir, ...parts.slice(0, i + 1))),
      );
    });
    expect(dropped).toEqual([]);
  });

  it("is private, with dev, build, start and typecheck scripts", () => {
    const manifest = JSON.parse(
      readFileSync(join(dir, "package.json"), "utf8"),
    );
    expect(manifest.private).toBe(true);
    expect(Object.keys(manifest.scripts)).toEqual(
      expect.arrayContaining(["dev", "build", "start", "typecheck"]),
    );
  });

  it("ignores node_modules, data, its build output and every lockfile", () => {
    const ignored = readFileSync(join(dir, ".gitignore"), "utf8")
      .split("\n")
      .map((line) => line.trim());
    expect(ignored).toEqual(
      expect.arrayContaining([
        "node_modules/",
        "data/",
        BUILD_OUTPUT[name],
        ...LOCKFILES,
      ]),
    );
  });

  it("unmounts an editor that resolves after its cleanup ran", () => {
    expect(readFileSync(join(dir, EDITOR_COMPONENTS[name]), "utf8")).toMatch(
      LATE_UNMOUNT,
    );
  });
});
