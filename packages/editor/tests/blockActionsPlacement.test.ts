// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { createImageBlock } from "@templatical/types";
import BlockWrapper from "../src/components/blocks/BlockWrapper.vue";
import { mountEditor } from "./helpers/mount";

afterEach(() => vi.restoreAllMocks());

/**
 * Lays out a 600 × 120 block at x = 316 in a canvas pane at x = 288, with a
 * 98 × 38 action bar. Client rects are in screen pixels (scaled by a host
 * transform); offset and client sizes are in CSS pixels.
 */
function layout(
  pane: HTMLElement,
  width: number,
  scale = 1,
  scrollbar = 0,
  blockHeight = 120,
) {
  const css: Record<string, { left: number; width: number; height: number }> = {
    pane: { left: 288, width, height: 600 },
    block: { left: 316, width: 600, height: blockHeight },
    actions: { left: 0, width: 98, height: 38 },
  };
  const part = (element: HTMLElement) =>
    element === pane
      ? css.pane
      : element.classList.contains("tpl-block")
        ? css.block
        : element.classList.contains("tpl-block-actions")
          ? css.actions
          : null;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const box = part(this) ?? { left: 0, width: 0, height: 0 };
      const left = box.left * scale;
      return {
        x: left,
        y: 0,
        left,
        top: 0,
        right: left + box.width * scale,
        bottom: box.height * scale,
        width: box.width * scale,
        height: box.height * scale,
        toJSON: () => ({}),
      } as DOMRect;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return part(this)?.width ?? 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return part(this)?.height ?? 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this === pane ? width - scrollbar : 0;
    },
  );
}

describe("selected block actions", () => {
  it.each([
    {
      pane: 1000,
      scale: 1,
      scrollbar: 0,
      height: 120,
      left: "608px",
      top: "50%",
    },
    {
      pane: 656,
      scale: 1,
      scrollbar: 0,
      height: 120,
      left: "526px",
      top: "60px",
    },
    {
      pane: 656,
      scale: 1,
      scrollbar: 15,
      height: 120,
      left: "511px",
      top: "60px",
    },
    {
      pane: 656,
      scale: 0.5,
      scrollbar: 0,
      height: 120,
      left: "526px",
      top: "60px",
    },
    // Below the corner badges the bar would hang 46 px past a 20 px block
    // onto the next one; it straddles its own block instead.
    {
      pane: 656,
      scale: 1,
      scrollbar: 0,
      height: 20,
      left: "526px",
      top: "50%",
    },
    // 28 px down still ends within 8 px of a 60 px block.
    {
      pane: 656,
      scale: 1,
      scrollbar: 0,
      height: 60,
      left: "526px",
      top: "47px",
    },
  ])(
    "places the toolbar inside a $pane px pane (scale $scale, scrollbar $scrollbar, block $height px)",
    async ({ pane: width, scale, scrollbar, height, left, top }) => {
      const pane = document.createElement("div");
      pane.className = "tpl-body";
      document.body.append(pane);
      layout(pane, width, scale, scrollbar, height);
      const wrapper = mountEditor(BlockWrapper, {
        attachTo: pane,
        props: { block: createImageBlock(), isSelected: true },
      });
      try {
        await nextTick();
        const toolbar = wrapper.get(".tpl-block-actions")
          .element as HTMLElement;
        expect(toolbar.style.left).toBe(left);
        expect(toolbar.style.top).toBe(top);
        // The toolbar's right edge stays inside the pane's content box.
        expect(316 - 288 + Number.parseFloat(left) + 98).toBeLessThanOrEqual(
          width - scrollbar - 4,
        );
        // Above the corner badges of this block's descendants and neighbours.
        expect(toolbar.classList).toContain("tpl:z-20");
        await wrapper.setProps({ isSelected: false });
        expect(wrapper.find(".tpl-block-actions").exists()).toBe(false);
      } finally {
        wrapper.unmount();
        pane.remove();
      }
    },
  );
});
