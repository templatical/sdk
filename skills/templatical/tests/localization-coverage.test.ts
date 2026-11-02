import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import * as quality from "../../../packages/quality/src";

const root = resolve(import.meta.dirname, "..");

describe("localization rules reach the skill", () => {
  it("names every localization rule ID in an agent-facing skill page", () => {
    const pages = [
      resolve(root, "SKILL.md"),
      ...readdirSync(resolve(root, "reference"))
        .filter((name) => name.endsWith(".md"))
        .map((name) => resolve(root, "reference", name)),
    ];
    const corpus = pages.map((page) => readFileSync(page, "utf8")).join("\n");
    const ids = [
      "localization.untranslated",
      "localization.stale",
      "localization.merge-tags-differ",
    ];
    expect(ids.filter((id) => !corpus.includes(id))).toEqual([]);
    expect(quality.LOCALIZATION_RULES.map((rule) => rule.meta.id)).toEqual(ids);
  });
});
