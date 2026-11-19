import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = join(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(join(REPO, path), "utf8");

const packageJsons = readdirSync(join(REPO, "packages"))
  .filter((dir) => existsSync(join(REPO, "packages", dir, "package.json")))
  .map((dir) => ({ dir, pkg: JSON.parse(read(`packages/${dir}/package.json`)) }));

describe("SECURITY.md", () => {
  it("supports the release line that ships", () => {
    const major = JSON.parse(read("packages/editor/package.json")).version.split(".")[0];
    expect(read("SECURITY.md")).toContain(`| Latest \`${major}.x\` minor |`);
  });

  it("scopes by repository, not by a hand-kept package list", () => {
    const scope = read("SECURITY.md").split("## Scope")[1].split("## Safe harbor")[0];
    expect(scope).not.toMatch(/@templatical\//);
  });
});

describe("CONTRIBUTING.md", () => {
  const src = read("CONTRIBUTING.md");

  it("points only at repo files that exist", () => {
    const paths = [...src.matchAll(/`((?:packages|apps|skills)\/[^`<>*\s]+\.[a-z]+)`/g)].map(
      ([, path]) => path,
    );
    expect(paths.length).toBeGreaterThan(2);
    expect(paths.filter((path) => !existsSync(join(REPO, path)))).toEqual([]);
  });

  it("does not pin a Vitest major in prose", () => {
    expect(src).not.toMatch(/Vitest \d/);
  });

  it("states the Node floor the engines field enforces", () => {
    const { node } = JSON.parse(read("package.json")).engines;
    expect(node).toMatch(/^>=\d+\.\d+\.\d+$/);
    expect(src).toContain(
      `Node.js >= ${node.slice(2)} (the engine requirement)`,
    );
  });

  it("describes `pnpm run ci` as the steps the script runs, here and in the PR template", () => {
    const steps: string[] = JSON.parse(read("package.json"))
      .scripts.ci.split("&&")
      .map((step: string) => step.trim().replace(/^pnpm run /, ""));
    expect(steps.length).toBeGreaterThan(2);
    const checklist = `- [ ] \`pnpm run ci\` passes locally (${steps.join(" + ")})`;
    expect(src).toContain(checklist);
    expect(read(".github/PULL_REQUEST_TEMPLATE.md")).toContain(checklist);
    const loop =
      src.split("\n").find((line) => line.startsWith("pnpm run ci ")) ?? "";
    for (const step of steps) expect(loop, step).toContain(step);
    expect(src).not.toMatch(/matches CI/i);
  });

  it("derives the tsdown packages from their config instead of listing them", () => {
    const row =
      src.split("\n").find((line) => line.includes("**tsdown**")) ?? "";
    expect(row).toContain("`tsdown.config.ts`");
    const tsdownPackages = packageJsons
      .filter(({ dir }) =>
        existsSync(join(REPO, "packages", dir, "tsdown.config.ts")),
      )
      .map(({ dir }) => dir);
    expect(tsdownPackages.length).toBeGreaterThan(5);
    expect(tsdownPackages.filter((dir) => row.includes(`\`${dir}\``))).toEqual(
      [],
    );
  });

  it("says locale parity covers every locale, not only en and de", () => {
    expect(src).toContain("if any locale's keys diverge from `en.ts`");
    expect(src).not.toContain("if `en.ts` and `de.ts` keys diverge");
  });
});

describe("package licences", () => {
  const skillManifests = readdirSync(join(REPO, "skills"))
    .filter((dir) => existsSync(join(REPO, "skills", dir, "package.json")))
    .map((dir) => ({
      id: `skills/${dir}`,
      license: JSON.parse(read(`skills/${dir}/package.json`)).license as string,
    }));
  const manifests = [
    ...packageJsons.map(({ dir, pkg }) => ({
      id: `packages/${dir}`,
      license: pkg.license as string,
    })),
    ...skillManifests,
  ];
  const licenseFiles = [
    "LICENSE",
    ...readdirSync(join(REPO, "packages"))
      .filter((dir) => existsSync(join(REPO, "packages", dir, "LICENSE")))
      .map((dir) => `packages/${dir}/LICENSE`)
      .sort(),
  ];

  it("licenses every package and the skill as MIT, and every LICENSE file matches the renderer", () => {
    expect(manifests.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "packages/editor",
        "packages/core",
        "packages/media-library",
        "packages/renderer",
        "skills/templatical",
      ]),
    );
    expect(manifests.length).toBe(17);
    for (const { id, license } of manifests) {
      expect(license, id).toBe("MIT");
    }

    const canon = readFileSync(join(REPO, "packages/renderer/LICENSE"));
    expect(canon.subarray(0, "MIT License".length).toString("utf8")).toBe("MIT License");
    expect(licenseFiles).toEqual(
      expect.arrayContaining([
        "LICENSE",
        "packages/editor/LICENSE",
        "packages/core/LICENSE",
        "packages/media-library/LICENSE",
        "packages/renderer/LICENSE",
      ]),
    );
    expect(licenseFiles.length).toBe(16);
    for (const path of licenseFiles) {
      expect(readFileSync(join(REPO, path)), path).toEqual(canon);
    }
  });
});
