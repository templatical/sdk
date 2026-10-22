import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { COMPATIBILITY_RULES } from "../../../packages/quality/src";

const root = resolve(import.meta.dirname, "..");

describe("compatibility rules reach the skill", () => {
  it("names every compatibility rule ID in an agent-facing skill page", () => {
    const pages = [
      resolve(root, "SKILL.md"),
      ...readdirSync(resolve(root, "reference"))
        .filter((name) => name.endsWith(".md"))
        .map((name) => resolve(root, "reference", name)),
    ];
    const corpus = pages.map((page) => readFileSync(page, "utf8")).join("\n");
    const missing = COMPATIBILITY_RULES.map((rule) => rule.meta.id).filter((id) => !corpus.includes(`\`${id}\``));
    expect(missing).toEqual([]);
  });
});
