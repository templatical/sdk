import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  resolve(__dirname, "..", "src", "styles", "index.css"),
  "utf-8",
);

describe(".tpl-text-toolbar-btn--active non-color indicators", () => {
  it("applies an inset ring so the active state is visible without color", () => {
    expect(src).toMatch(
      /\.tpl-text-toolbar-btn--active\s*\{[\s\S]*box-shadow:\s*inset/,
    );
  });

  it("thickens the SVG stroke-width on active state", () => {
    expect(src).toContain(".tpl-text-toolbar-btn--active svg");
    expect(src).toContain("stroke-width: 2.75");
  });
});

describe(".tpl-block--lifted keyboard lift indicator", () => {
  it("renders a dashed outline distinct from selection/hover", () => {
    expect(src).toMatch(
      /\.tpl-block--lifted\s*\{[\s\S]*outline:\s*2px dashed/,
    );
  });

  it("applies a subtle scale + layered glow", () => {
    expect(src).toMatch(/\.tpl-block--lifted\s*\{[\s\S]*transform:\s*scale\(1\.01\)/);
    expect(src).toMatch(/\.tpl-block--lifted\s*\{[\s\S]*box-shadow:[\s\S]*var\(--tpl-shadow-xl\)/);
  });
});

describe(".tpl-sr-only utility for screen-reader-only content", () => {
  it("clips content to 1px and removes it from the visual flow", () => {
    expect(src).toMatch(/\.tpl-sr-only\s*\{[\s\S]*width:\s*1px/);
    expect(src).toMatch(/\.tpl-sr-only\s*\{[\s\S]*clip:\s*rect\(0, 0, 0, 0\)/);
  });
});
