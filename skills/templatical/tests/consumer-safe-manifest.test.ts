import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PACKAGE_JSON_PATH = resolve(import.meta.dirname, "../package.json");

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

describe("package.json is consumer-safe", () => {
  it("declares no workspace:* range in any dependency field", () => {
    // A `workspace:*` range resolves only inside this pnpm workspace. This
    // skill is also fetched outside it — `npx skills add`, a plugin install,
    // or a folder copy — each followed by a plain `npm install`, which fails
    // outright on an unresolvable workspace protocol. That's why the skill
    // reaches @templatical/editor's version and the docs it copies by
    // relative path (tools/generate-reference.mjs) rather than declaring
    // either as a dependency at all.
    const pkg: Record<string, unknown> = JSON.parse(
      readFileSync(PACKAGE_JSON_PATH, "utf8"),
    );
    const offenders: string[] = [];
    for (const field of DEPENDENCY_FIELDS) {
      const deps = pkg[field] as Record<string, string> | undefined;
      if (!deps) continue;
      for (const [name, range] of Object.entries(deps)) {
        if (range.startsWith("workspace:")) offenders.push(`${field}.${name}`);
      }
    }
    expect(
      offenders,
      `package.json declares workspace:* for: ${offenders.join(", ")}. That range only resolves ` +
        "inside this pnpm workspace and breaks `npm install` for anyone installing this skill on " +
        "its own.",
    ).toEqual([]);
  });
});
