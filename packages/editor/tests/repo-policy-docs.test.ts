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

  it("names exactly the FSL packages as FSL", () => {
    const fsl = packageJsons
      .filter(({ pkg }) => pkg.license === "FSL-1.1-MIT")
      .map(({ dir }) => dir)
      .sort();
    const line = src.split("\n").find((l) => l.startsWith("- **FSL-1.1-MIT**")) ?? "";
    expect([...line.matchAll(/`([a-z-]+)`/g)].map(([, name]) => name).sort()).toEqual(fsl);
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
