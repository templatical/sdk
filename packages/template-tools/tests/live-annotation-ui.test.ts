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

  it("registers the click listener on the capture phase", () => {
    // BlockWrapper.handleClick calls stopPropagation() on every block click,
    // so a bubble-phase listener on `document` never sees it — capture runs
    // root-to-target, before that stopPropagation is reached. Flipping this
    // to false (or dropping the third argument) makes every alt-click on a
    // block a silent no-op: the note panel simply never opens, with nothing
    // in the console to explain why.
    const match = HARNESS.match(
      /document\.addEventListener\(\s*["']click["'][\s\S]*?\n\s*(true|false),\s*\n\s*\);/,
    );
    expect(match?.[1]).toBe("true");
  });
});
