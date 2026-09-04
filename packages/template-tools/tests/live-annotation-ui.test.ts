import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HARNESS = readFileSync(
  resolve(import.meta.dirname, "../live/index.html"),
  "utf8",
);

describe("annotation capture UI", () => {
  it("posts notes to the bridge's annotation endpoint", () => {
    expect(HARNESS).toContain("/annotations");
  });

  it("derives the block id from data-block-id", () => {
    expect(HARNESS).toContain("data-block-id");
  });

  it("walks composedPath, not event.target", () => {
    // The editor mounts in shadow DOM by default, so a click retargets at the
    // boundary and event.target is the host element, not the block.
    expect(HARNESS).toContain("composedPath");
    expect(HARNESS).not.toMatch(/\bevent\.target\.dataset\b/);
  });

  it("has a note affordance and a note input", () => {
    expect(HARNESS).toContain('id="note-panel"');
    expect(HARNESS).toContain('id="note-text"');
  });
});
