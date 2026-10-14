import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error - plain .mjs script, no types
import { exampleManifests } from "../scripts/sync-pins.mjs";

// Every examples/<name> app installs @templatical/* from npm at exactly the
// current release: ^<version of the changesets fixed group>. sync-pins job 3
// writes that range at release time; this guard fails when an example drifts
// from it between releases, which would install a different version than the
// docs and the CI smoke test describe.
const REPO_ROOT = resolve(import.meta.dirname, "../../..");

describe("example @templatical ranges", () => {
  const version = JSON.parse(
    readFileSync(resolve(REPO_ROOT, "packages/editor/package.json"), "utf8"),
  ).version;

  it("covers at least one example", () => {
    expect(exampleManifests()).toContain("examples/nextjs/package.json");
  });

  it("pins every @templatical dependency to ^<release version>", () => {
    const wrong: string[] = [];
    for (const label of exampleManifests()) {
      const manifest = JSON.parse(
        readFileSync(resolve(REPO_ROOT, label), "utf8"),
      );
      let found = 0;
      for (const field of ["dependencies", "devDependencies"]) {
        for (const [name, range] of Object.entries(manifest[field] ?? {})) {
          if (!name.startsWith("@templatical/")) continue;
          found += 1;
          if (range !== `^${version}`) wrong.push(`${label}: ${name}@${range}`);
        }
      }
      if (found === 0) wrong.push(`${label}: no @templatical dependency`);
    }
    expect(
      wrong,
      `expected ^${version} (run: pnpm --filter @templatical/template-tools run sync-pins)`,
    ).toEqual([]);
  });
});
