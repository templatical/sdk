import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const APP = join(ROOT, "src/App.vue");

const BANNED = [
  "showFeatureOverlay",
  "chooseTemplate",
  "tpl-playground-features-dismissed",
  "tpl-playground-onboarding-dismissed",
] as const;

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, acc);
    else acc.push(path);
  }
  return acc;
}

describe("kitchen-sink leftovers", () => {
  it("App.vue does not contain showFeatureOverlay or chooseTemplate", () => {
    const src = readFileSync(APP, "utf8");
    expect(src).not.toContain("showFeatureOverlay");
    expect(src).not.toContain("chooseTemplate");
  });

  it("banned sink symbols are gone from apps/playground", () => {
    const files = walkFiles(join(ROOT, "src")).concat(
      walkFiles(join(ROOT, "e2e")),
      walkFiles(join(ROOT, "tests")).filter(
        (file) => !file.endsWith("no-sink.test.ts"),
      ),
    );
    const hits: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const token of BANNED) {
        if (src.includes(token)) hits.push(`${file}:${token}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("e2e specs do not call selectFirstTemplate", () => {
    const files = walkFiles(join(ROOT, "e2e"));
    const hits = files.filter((file) =>
      readFileSync(file, "utf8").includes("selectFirstTemplate"),
    );
    expect(hits).toEqual([]);
  });
});
