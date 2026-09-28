import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const annotations = readFileSync(
  resolve(import.meta.dirname, "../reference/annotations.md"),
  "utf8",
);
const live = readFileSync(
  resolve(import.meta.dirname, "../reference/live.md"),
  "utf8",
);

describe("live annotation instructions", () => {
  it("tells the agent to consume notes only on the apply path", () => {
    expect(annotations).toContain("--consume-annotations");
    expect(annotations).toContain("parentBlockId");
    expect(annotations).toContain("N notes are still waiting in the browser.");
    expect(annotations).not.toContain("live wait");
  });

  it("stops telling the agent that every reload clears notes", () => {
    expect(live).not.toContain("clears `annotations`");
    expect(live).toContain("leaves notes in place");
    expect(live).toContain("--consume-annotations");
  });
});
