import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const SKILL_ROOT = resolve(import.meta.dirname, "..");
const REFERENCE_DIR = resolve(SKILL_ROOT, "reference");
const SKILL_MD = readFileSync(resolve(SKILL_ROOT, "SKILL.md"), "utf8");

/** Island basenames on disk, e.g. "build" for reference/build.md. */
function islandsOnDisk(): string[] {
  return readdirSync(REFERENCE_DIR)
    .filter((f) => f.endsWith(".md") && f !== "block-guide.md")
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

/** Entry islands, parsed from the Commands table. Captures the link's label
 *  AND its href: a row whose href points somewhere the label does not is
 *  exactly the dead-route case this table exists to prevent. */
function entryIslands(): string[] {
  return [...SKILL_MD.matchAll(
    /^\|\s*`([a-z0-9-]+)`\s*\|[^|]*\|\s*\[reference\/([a-z0-9-]+)\.md\]\(reference\/([a-z0-9-]+)\.md\)/gm,
  )]
    .map(([, mode, label, href]) => {
      expect(mode, "a Commands row's mode must match its island filename").toBe(label);
      expect(href, "a Commands row's link target must match its label").toBe(label);
      return href;
    })
    .sort();
}

/** Every reference/<x>.md linked from `src`. */
function linksIn(src: string): string[] {
  return [...src.matchAll(/\]\((?:reference\/)?([a-z0-9-]+)\.md\)/g)].map(([, f]) => f);
}

describe("the island graph", () => {
  it("has exactly the ten entry islands the design names", () => {
    expect(entryIslands()).toEqual([
      "build", "diagnose", "docs", "edit", "export",
      "import", "integrate", "live", "scaffold", "validate",
    ]);
  });

  it("resolves every Commands-table row to a file that exists", () => {
    for (const island of entryIslands()) {
      expect(existsSync(resolve(REFERENCE_DIR, `${island}.md`)), `reference/${island}.md`).toBe(true);
    }
  });

  it("resolves every link between islands", () => {
    const known = new Set([...islandsOnDisk(), "block-guide"]);
    for (const island of islandsOnDisk()) {
      const src = readFileSync(resolve(REFERENCE_DIR, `${island}.md`), "utf8");
      for (const target of linksIn(src)) {
        expect(known.has(target), `${island}.md links to ${target}.md, which does not exist`).toBe(true);
      }
    }
  });

  it("leaves no island orphaned — every island is reachable from the router by following links", () => {
    // Reachability from SKILL.md, not "something links to it". Two consult
    // islands that link only to each other each have an incoming edge while
    // being unreachable from any entry point, and an island an agent cannot
    // navigate to is dead weight however many siblings cite it.
    //
    // The router is the only root: talking.md is cross-cutting guidance
    // belonging to every route, so SKILL.md is the one honest place to link
    // it from, and a walk seeded from the islands alone would miss it.
    const known = new Set(islandsOnDisk());
    const reached = new Set<string>();
    const queue = linksIn(SKILL_MD).filter((f) => known.has(f));
    while (queue.length > 0) {
      const island = queue.shift() as string;
      if (reached.has(island)) continue;
      reached.add(island);
      const src = readFileSync(resolve(REFERENCE_DIR, `${island}.md`), "utf8");
      for (const next of linksIn(src)) {
        if (known.has(next) && !reached.has(next)) queue.push(next);
      }
    }
    const orphans = [...known].filter((i) => !reached.has(i)).sort();
    expect(
      orphans,
      "islands unreachable from SKILL.md — link them from a playbook that is itself reachable, or delete them",
    ).toEqual([]);
  });

  it("names every entry island in argument-hint, and no consult island", () => {
    const hint = /^argument-hint:\s*"(.+)"$/m.exec(SKILL_MD)?.[1] ?? "";
    expect(hint, "SKILL.md has no argument-hint").not.toBe("");
    for (const island of entryIslands()) {
      expect(hint.includes(island), `argument-hint omits entry island ${island}`).toBe(true);
    }
    const consult = islandsOnDisk().filter((i) => !entryIslands().includes(i));
    for (const island of consult) {
      expect(hint.includes(island), `argument-hint names consult island ${island}`).toBe(false);
    }
  });

  it("tells the agent to load the phase island before the first command", () => {
    expect(SKILL_MD).toContain("reference/cli.md");
    expect(SKILL_MD).toContain("reference/talking.md");
    expect(existsSync(resolve(REFERENCE_DIR, "cli.md"))).toBe(true);
    expect(existsSync(resolve(REFERENCE_DIR, "talking.md"))).toBe(true);
  });

  it("has no anchor links — intra-document ones point into a document that's gone, and cross-file ones aren't seen by link resolution either", () => {
    const offenders: string[] = [];
    for (const island of islandsOnDisk()) {
      // block-guide.md is exempt: one self-contained document whose own
      // contents list anchors into its own headings.
      if (island === "block-guide") continue;
      const src = readFileSync(resolve(REFERENCE_DIR, `${island}.md`), "utf8");
      // Any `#` inside a markdown link's target, not just `(#anchor)`: a
      // cross-file form like `(rules.md#colors)` still doesn't end in `.md)`,
      // so linksIn() above can't see it either — the case is caught here or
      // nowhere.
      for (const [match] of src.matchAll(/\]\([^)]*#[^)]*\)/g)) {
        offenders.push(`${island}.md: ${match}`);
      }
    }
    expect(offenders, "anchor links resolve to nothing once content is split").toEqual([]);
  });
});
