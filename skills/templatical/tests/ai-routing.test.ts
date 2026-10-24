import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const { evals } = JSON.parse(read("evals/evals.json")) as {
  evals: { id: number; expected_output: string }[];
};

describe("AI and collaboration agent jobs", () => {
  it.each([
    [23, "/guide/bring-your-own-ai"],
    [24, "/backend/collaboration"],
    [25, "/backend/ai"],
    [26, "/api/ai-kit"],
    [27, "/backend/ai"],
    [28, "/quality/"],
  ] as const)(
    "eval %i names the public contract %s and forbidden advice",
    (id, path) => {
      const entry = evals.find((entry) => entry.id === id);
      expect(entry, `missing eval ${id}`).toBeDefined();
      expect(entry?.expected_output).toContain(path);
      expect(entry?.expected_output).toMatch(/must not/i);
    },
  );

  it("preserves the attachment job from task 7", () => {
    expect(evals.find((entry) => entry.id === 22)?.expected_output).toContain(
      "chatAttachments",
    );
  });

  it("does not promise current Cloud AI in the integration route", () => {
    expect(read("reference/integrate.md")).not.toMatch(/AI wired in/i);
  });
});

describe("provider setup and diagnosis", () => {
  it("allows required setup and contract links after the first docs page", () => {
    const src = read("reference/docs.md");
    expect(src).not.toContain("Fetch one docs page, not several");
    expect(src).toMatch(/required setup and contract links/);
  });
  it("allows the AI kit for an explicitly requested provider integration", () => {
    expect(read("reference/scaffold.md")).toContain("@templatical/ai-kit");
  });
  it.each(["providers", "diagnose", "failure-modes"])(
    "%s covers missing AI lint actions",
    (page) => {
      const src = read(`reference/${page}.md`);
      expect(src).toContain("Fix with AI");
      expect(src).toContain("Write alt text");
      expect(src).toContain("@templatical/quality");
      expect(src).toMatch(/lint (?:off|is off|disabled)/);
    },
  );
});
