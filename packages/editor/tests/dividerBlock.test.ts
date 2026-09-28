// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createDividerBlock, type DividerBlock } from "@templatical/types";
import DividerBlockComponent from "../src/components/blocks/DividerBlock.vue";

function lineStyle(width: DividerBlock["width"]): string {
  const wrapper = mount(DividerBlockComponent, {
    props: { block: createDividerBlock({ width }), viewport: "desktop" },
  });
  return wrapper.find("hr").attributes("style") ?? "";
}

describe("DividerBlock width", () => {
  it("spans the column when full", () => {
    expect(lineStyle("full")).toContain("width: 100%");
  });

  it("draws a number as pixels, centred", () => {
    const style = lineStyle(240);
    expect(style).toContain("width: 240px");
    expect(style).toContain("margin: 0px auto");
  });

  it("draws a percentage as a share of the column, centred like the export", () => {
    const style = lineStyle("40%");
    expect(style).toContain("width: 40%");
    expect(style).toContain("margin: 0px auto");
  });
});
