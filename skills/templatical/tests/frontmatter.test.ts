import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SKILL_MD = readFileSync(resolve(import.meta.dirname, "../SKILL.md"), "utf8");

/** The `description` value as a YAML loader sees it: a plain scalar, or a
 *  folded `>` / `>-` block whose lines join with single spaces. */
function readDescription(src: string): string {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(src)?.[1] ?? "";
  const lines = frontmatter.split("\n");
  const start = lines.findIndex((line) => line.startsWith("description:"));
  if (start === -1) return "";
  const inline = lines[start].slice("description:".length).trim();
  if (!/^>-?$/.test(inline)) return inline;
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!/^\s/.test(line)) break;
    body.push(line.trim());
  }
  return body.join(" ");
}

// The Agent Skills spec (agentskills.io/specification) caps `description` at
// 1024 characters. It is the only text an agent reads before deciding to load
// the skill, so every new mode's trigger phrase lands here, and the text had
// grown past the cap before this guard existed.
describe("SKILL.md frontmatter", () => {
  it("reads a folded description the way YAML does", () => {
    expect(readDescription("---\nname: x\ndescription: >-\n  one two\n  three\nlicense: MIT\n---\n")).toBe(
      "one two three",
    );
    expect(readDescription("---\ndescription: plain text\n---\n")).toBe("plain text");
  });

  it("keeps the description within the spec's 1024-character cap", () => {
    const description = readDescription(SKILL_MD);
    expect(description.length).toBeGreaterThan(0);
    expect([...description].length).toBeLessThanOrEqual(1024);
  });
});
