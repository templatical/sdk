// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { h } from "vue";
import { createTitleBlock } from "@templatical/types";
import type { BlockVisibility, ViewportSize } from "@templatical/types";
import BlockWrapper from "../src/components/blocks/BlockWrapper.vue";
import { mountEditor } from "./helpers/mount";

/**
 * Preview-mode visibility gate.
 *
 * In EDIT mode a block hidden on the current viewport stays rendered (dimmed
 * + "Hidden on …" badge) so it remains selectable. In PREVIEW mode it must
 * actually disappear, matching the exported MJML which drops it via
 * `@media` + `tpl-hide-*` css-classes. Before this gate the editor only ever
 * dimmed the block, so preview never reflected the real email.
 */

const HIDDEN_ON_MOBILE: BlockVisibility = {
  desktop: true,
  tablet: true,
  mobile: false,
};

function mountWrapper(opts: {
  previewMode: boolean;
  viewport: ViewportSize;
  visibility?: BlockVisibility;
}) {
  const block = createTitleBlock({ content: "<p>Hi</p>", level: 2 });
  if (opts.visibility) block.visibility = opts.visibility;
  return mountEditor(BlockWrapper, {
    props: {
      block,
      isSelected: false,
      viewport: opts.viewport,
      previewMode: opts.previewMode,
    },
    slots: { default: () => h("div", { class: "tpl-test-child" }, "child") },
  });
}

describe("BlockWrapper viewport visibility", () => {
  it("preview mode: a block hidden on the current viewport renders nothing", () => {
    const wrapper = mountWrapper({
      previewMode: true,
      viewport: "mobile",
      visibility: HIDDEN_ON_MOBILE,
    });
    expect(wrapper.find(".tpl-block").exists()).toBe(false);
    expect(wrapper.find(".tpl-test-child").exists()).toBe(false);
  });

  it("preview mode: a block visible on the current viewport renders normally", () => {
    const wrapper = mountWrapper({
      previewMode: true,
      viewport: "desktop",
      visibility: HIDDEN_ON_MOBILE,
    });
    expect(wrapper.find(".tpl-block").exists()).toBe(true);
    expect(wrapper.find(".tpl-test-child").text()).toBe("child");
    // No dim overlay in preview when the block is visible.
    expect(wrapper.find(".tpl-block-hidden-overlay").exists()).toBe(false);
  });

  it("edit mode: a block hidden on the current viewport stays rendered with a dim overlay", () => {
    const wrapper = mountWrapper({
      previewMode: false,
      viewport: "mobile",
      visibility: HIDDEN_ON_MOBILE,
    });
    // Still in the DOM so it remains selectable while editing.
    expect(wrapper.find(".tpl-block").exists()).toBe(true);
    expect(wrapper.find(".tpl-test-child").text()).toBe("child");
    expect(wrapper.find(".tpl-block-hidden-overlay").exists()).toBe(true);
  });

  it("edit mode: a block visible on the current viewport has no dim overlay", () => {
    const wrapper = mountWrapper({
      previewMode: false,
      viewport: "desktop",
      visibility: HIDDEN_ON_MOBILE,
    });
    expect(wrapper.find(".tpl-block").exists()).toBe(true);
    expect(wrapper.find(".tpl-block-hidden-overlay").exists()).toBe(false);
  });

  it("preview mode: a block with no visibility set always renders", () => {
    const wrapper = mountWrapper({ previewMode: true, viewport: "mobile" });
    expect(wrapper.find(".tpl-block").exists()).toBe(true);
    expect(wrapper.find(".tpl-test-child").text()).toBe("child");
  });
});
