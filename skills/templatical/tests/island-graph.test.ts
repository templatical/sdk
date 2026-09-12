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

/** Entry islands, parsed from the Commands table's third column. */
function entryIslands(): string[] {
  return [...SKILL_MD.matchAll(/^\|\s*`([a-z-]+)`\s*\|[^|]*\|\s*\[reference\/([a-z-]+)\.md\]/gm)]
    .map(([, mode, file]) => {
      expect(mode, "a Commands row's mode must match its island filename").toBe(file);
      return file;
    })
    .sort();
}

/** Every reference/<x>.md linked from `src`. */
function linksIn(src: string): string[] {
  return [...src.matchAll(/\]\((?:reference\/)?([a-z-]+)\.md\)/g)].map(([, f]) => f);
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

  it("leaves no island orphaned — every consult island is linked from an island or the router", () => {
    const entry = new Set(entryIslands());
    // SKILL.md counts as a parent: talking.md is cross-cutting guidance that
    // belongs to every route, so the router is the only honest place to link
    // it from. Scanning islands alone would report it unreachable.
    const linked = new Set([
      ...linksIn(SKILL_MD),
      ...islandsOnDisk().flatMap((i) =>
        linksIn(readFileSync(resolve(REFERENCE_DIR, `${i}.md`), "utf8")),
      ),
    ]);
    const orphans = islandsOnDisk().filter((i) => !entry.has(i) && !linked.has(i));
    expect(orphans, "unreachable islands — link them or delete them").toEqual([]);
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
    expect(existsSync(resolve(REFERENCE_DIR, "cli.md"))).toBe(true);
  });

  it("has no intra-document anchor links — the document they pointed into is gone", () => {
    const offenders: string[] = [];
    for (const island of islandsOnDisk()) {
      // block-guide.md is exempt: one self-contained document whose own
      // contents list anchors into its own headings.
      if (island === "block-guide") continue;
      const src = readFileSync(resolve(REFERENCE_DIR, `${island}.md`), "utf8");
      for (const [match] of src.matchAll(/\]\(#[a-z0-9-]+\)/g)) {
        offenders.push(`${island}.md: ${match}`);
      }
    }
    expect(offenders, "anchor links resolve to nothing once content is split").toEqual([]);
  });
});
