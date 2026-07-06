import { describe, expect, it } from "vitest";
import { canDropInSectionColumn } from "../src/utils/sectionColumnDrop";

/**
 * The `put` predicate receives a Sortable drag element; only its `dataset`
 * matters here, so a minimal stand-in keeps the test free of a DOM env.
 */
function dragEl(dataset: Record<string, string>): HTMLElement {
  return { dataset } as unknown as HTMLElement;
}

describe("canDropInSectionColumn", () => {
  it("rejects a section dragged from the canvas (data-block-type)", () => {
    expect(canDropInSectionColumn(dragEl({ blockType: "section" }))).toBe(
      false,
    );
  });

  it("rejects a section dragged from the sidebar palette (data-palette-type)", () => {
    // The hole behind #292: palette items carry `data-palette-type`, not
    // `data-block-type`, so a block-type-only check let sections through.
    expect(canDropInSectionColumn(dragEl({ paletteType: "section" }))).toBe(
      false,
    );
  });

  it("allows a non-section block from the canvas", () => {
    expect(canDropInSectionColumn(dragEl({ blockType: "paragraph" }))).toBe(
      true,
    );
  });

  it("allows a non-section block from the palette", () => {
    expect(canDropInSectionColumn(dragEl({ paletteType: "image" }))).toBe(true);
  });

  it("allows an element carrying neither data attribute", () => {
    expect(canDropInSectionColumn(dragEl({}))).toBe(true);
  });
});
