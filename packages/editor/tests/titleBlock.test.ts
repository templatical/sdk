// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createTitleBlock } from "@templatical/types";
import TitleBlock from "../src/components/blocks/TitleBlock.vue";
import { mountEditor } from "./helpers/mount";

function mount(
  overrides: Partial<Parameters<typeof createTitleBlock>[0]> = {},
) {
  const block = createTitleBlock({
    content: "<p>Hello title</p>",
    level: 2,
    ...overrides,
  });
  return mountEditor(TitleBlock, {
    props: { block, viewport: "desktop" as const },
  });
}

describe("TitleBlock canvas rendering", () => {
  it("renders block.level as an h{level} element, not a <p>", () => {
    const wrapper = mount({ level: 1 });
    const heading = wrapper.find("h1");
    expect(heading.exists()).toBe(true);
    expect(heading.text()).toBe("Hello title");
    // Regression for issue #69: the canvas must NOT render the title's
    // content wrapped in a <p> — that diverges from the exported MJML/HTML
    // output (which uses h${level}) and lets consumer "p" rules leak in.
    expect(wrapper.find(".tpl-text-content > p").exists()).toBe(false);
  });

  it("renders each heading level with the matching tag (h1..h4)", () => {
    // HeadingLevel is constrained to 1..4 in @templatical/types.
    for (const level of [1, 2, 3, 4] as const) {
      const wrapper = mount({ level });
      expect(wrapper.find(`h${level}`).exists()).toBe(true);
      // No other heading levels rendered.
      for (const other of [1, 2, 3, 4] as const) {
        if (other === level) continue;
        expect(wrapper.find(`h${other}`).exists()).toBe(false);
      }
    }
  });

  it("strips a single outer <p> wrapper from TipTap-stored content", () => {
    const wrapper = mount({ content: "<p>Plain title</p>", level: 2 });
    const heading = wrapper.find("h2");
    // The text is inside the heading directly, not nested under another <p>.
    expect(heading.element.querySelector("p")).toBeNull();
    expect(heading.text()).toBe("Plain title");
  });

  it("preserves inline formatting inside the heading", () => {
    const wrapper = mount({
      content: "<p>Hello <strong>bold</strong> world</p>",
      level: 3,
    });
    const heading = wrapper.find("h3");
    expect(heading.element.querySelector("strong")?.textContent).toBe("bold");
  });

  it("does NOT unwrap when content has multiple top-level paragraphs", () => {
    // Mirrors renderer behavior: only a single outer <p> is unwrapped.
    const wrapper = mount({
      content: "<p>First</p><p>Second</p>",
      level: 2,
    });
    const heading = wrapper.find("h2");
    expect(heading.exists()).toBe(true);
    expect(heading.element.querySelectorAll("p")).toHaveLength(2);
  });

  it("applies title style (font-size, color, text-align) on the heading wrapper", () => {
    const wrapper = mount({
      level: 2,
      color: "#ff0000",
      textAlign: "center",
    });
    const styled = wrapper.find('[style*="color"]');
    const style = styled.attributes("style") ?? "";
    expect(style).toContain("color: #ff0000");
    expect(style).toContain("text-align: center");
  });
});
