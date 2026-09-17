// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import {
  createTitleBlock,
  createWrapperBlock,
  type Block,
} from "@templatical/types";
import WrapperBlock from "../src/components/blocks/WrapperBlock.vue";
import TitleBlock from "../src/components/blocks/TitleBlock.vue";
import { BLOCK_REGISTRY_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";
import type { UseBlockRegistryReturn } from "../src/composables/useBlockRegistry";

function titleRegistry() {
  return {
    getComponent: vi.fn((block: Block) =>
      block.type === "title" ? TitleBlock : undefined,
    ),
  } as unknown as UseBlockRegistryReturn;
}

describe("WrapperBlock", () => {
  it("paints the band background and shows child text", () => {
    const title = createTitleBlock({
      content: "<p>Card body</p>",
      level: 2,
    });
    const block = createWrapperBlock({
      styles: {
        backgroundColor: "#ffffff",
        padding: { top: 24, right: 24, bottom: 24, left: 24 },
      },
      borderRadius: 12,
      children: [title],
    });
    const registry = titleRegistry();

    const wrapper = mountEditor(WrapperBlock, {
      props: { block, viewport: "desktop" },
      provides: { [BLOCK_REGISTRY_KEY]: registry },
    });

    const root = wrapper.get('[data-testid="layout-wrapper"]');
    expect(root.attributes("style")).toContain("background-color: #ffffff");
    // Equal sides serialize as the CSS shorthand `padding: 24px`.
    expect(root.attributes("style")).toContain("padding: 24px");
    expect(root.attributes("style")).toContain("border-radius: 12px");
    expect(root.text()).toBe("Card body");
    expect(registry.getComponent).toHaveBeenCalledWith(title);
    expect(wrapper.get(`[data-block-id="${title.id}"]`).exists()).toBe(true);
  });
});
