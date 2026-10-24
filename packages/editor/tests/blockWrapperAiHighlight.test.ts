// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { h } from "vue";
import { createTitleBlock } from "@templatical/types";
import BlockWrapper from "../src/components/blocks/BlockWrapper.vue";
import { CAPABILITIES_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

describe("BlockWrapper and the asker's AI outline (D42)", () => {
  it("outlines a block the editor's own AI turn changed, without collaboration", () => {
    const block = createTitleBlock({ content: "<p>Hi</p>" });
    const wrapper = mountEditor(BlockWrapper, {
      props: {
        block,
        isSelected: false,
        viewport: "desktop",
        previewMode: false,
      },
      slots: { default: () => h("div", "child") },
      provides: {
        [CAPABILITIES_KEY]: {
          ai: {
            isFeatureEnabled: () => true,
            open: () => {},
            highlightOf: (id: string) => (id === block.id ? 3 : null),
          },
        },
      },
    });

    expect(wrapper.find('[data-testid="block-agent-highlight"]').exists()).toBe(
      true,
    );
  });
});
