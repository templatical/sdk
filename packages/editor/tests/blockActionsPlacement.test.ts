// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { computed, nextTick } from "vue";
import { createImageBlock } from "@templatical/types";
import BlockWrapper from "../src/components/blocks/BlockWrapper.vue";
import { CAPABILITIES_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

/**
 * The selected block's action bar and the comment-count pill sit beside the
 * block, which leaves the canvas pane when the pane is narrow: the pane
 * (`.tpl-body`) scrolls, so whatever overflows is clipped under the properties
 * panel (#1052). Both are measured against the pane instead of positioned with
 * fixed offsets.
 *
 * happy-dom does no layout, so `layout()` stubs the boxes.
 */

afterEach(() => vi.restoreAllMocks());

/**
 * Lays out a 600 × 120 block at x = 316 in a canvas pane at x = 288, with a
 * 98 × 38 action bar and a 32 × 24 comment pill. Client rects are in screen
 * pixels (scaled by a host transform); offset and client sizes are in CSS
 * pixels.
 */
function layout(
  pane: HTMLElement,
  width: number,
  {
    scale = 1,
    scrollbar = 0,
    blockHeight = 120,
    badgeWidth = 0,
    badgeHeight = badgeWidth ? 20 : 0,
    actionsWidth = 98,
  }: {
    scale?: number;
    scrollbar?: number;
    blockHeight?: number;
    badgeWidth?: number;
    badgeHeight?: number;
    actionsWidth?: number;
  } = {},
) {
  const css: Record<
    string,
    { left: number; top?: number; width: number; height: number }
  > = {
    pane: { left: 288, width, height: 600 },
    block: { left: 316, width: 600, height: blockHeight },
    actions: { left: 0, width: actionsWidth, height: 38 },
    badges: {
      left: 316 + 600 - 4 - badgeWidth,
      top: 4,
      width: badgeWidth,
      height: badgeHeight,
    },
    // 4 px above the block, as past its top-right corner.
    pill: { left: 0, top: -4, width: 32, height: 24 },
  };
  const part = (element: HTMLElement) =>
    element === pane
      ? css.pane
      : element.classList.contains("tpl-block")
        ? css.block
        : element.classList.contains("tpl-block-actions")
          ? css.actions
          : element.classList.contains("tpl-block-badges")
            ? css.badges
            : element.classList.contains("tpl-comment-indicator")
              ? css.pill
              : null;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const box = part(this) ?? { left: 0, width: 0, height: 0 };
      const left = box.left * scale;
      const top = (box.top ?? 0) * scale;
      return {
        x: left,
        y: top,
        left,
        top,
        right: left + box.width * scale,
        bottom: top + box.height * scale,
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
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(
    function (this: HTMLElement) {
      return part(this)?.top ?? 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this === pane ? width - scrollbar : 0;
    },
  );
}

function makePane(): HTMLElement {
  const pane = document.createElement("div");
  pane.className = "tpl-body";
  document.body.append(pane);
  return pane;
}

function capabilities({
  savedBlocks = false,
  comments = 0,
  openForBlock = vi.fn(),
}: {
  savedBlocks?: boolean;
  comments?: number;
  openForBlock?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    ...(savedBlocks
      ? {
          savedBlocks: {
            isPicking: computed(() => false),
            isAvailable: computed(() => true),
            canCreate: computed(() => true),
          },
        }
      : {}),
    ...(comments
      ? { comments: { getBlockCount: () => comments, openForBlock } }
      : {}),
  };
}

async function settle(): Promise<void> {
  // Moving the pill into the badge row re-renders, and the bar is placed
  // against the row as it renders after that.
  await nextTick();
  await nextTick();
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
      const pane = makePane();
      layout(pane, width, { scale, scrollbar, blockHeight: height });
      const wrapper = mountEditor(BlockWrapper, {
        attachTo: pane,
        props: { block: createImageBlock(), isSelected: true },
      });
      try {
        await settle();
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

  it.each([{ scale: 1 }, { scale: 0.5 }])(
    "clears a short block's badge slot at scale $scale",
    async ({ scale }) => {
      const pane = makePane();
      layout(pane, 656, {
        scale,
        scrollbar: 15,
        blockHeight: 20,
        badgeWidth: 44,
      });
      const wrapper = mountEditor(BlockWrapper, {
        attachTo: pane,
        props: { block: createImageBlock(), isSelected: true },
      });
      try {
        await settle();
        const toolbar = wrapper.get(".tpl-block-actions")
          .element as HTMLElement;
        expect(toolbar.style.top).toBe("50%");
        expect(toolbar.style.left).toBe("446px");
        // 8 px clear of the slot, which starts at 600 - 4 - 44 = 552.
        expect(446 + 98).toBeLessThanOrEqual(552 - 8);
      } finally {
        wrapper.unmount();
        pane.remove();
      }
    },
  );

  it("keeps a four-button toolbar inside the pane when saved blocks add the bookmark", async () => {
    // The 30 px the bookmark adds is what pushed Delete past the pane at
    // common editor widths (#1052).
    const pane = makePane();
    layout(pane, 656, { actionsWidth: 128 });
    const wrapper = mountEditor(BlockWrapper, {
      attachTo: pane,
      props: { block: createImageBlock(), isSelected: true },
      provides: { [CAPABILITIES_KEY]: capabilities({ savedBlocks: true }) },
    });
    try {
      await settle();
      const toolbar = wrapper.get(".tpl-block-actions");
      expect(
        toolbar.findAll("button").map((b) => b.attributes("aria-label")),
      ).toEqual([
        "blockActions.drag",
        "blockActions.duplicate",
        "blockActions.saveAsBlock",
        "blockActions.delete",
      ]);
      // Pane right edge in block coordinates: 288 - 316 + 656 = 628.
      expect((toolbar.element as HTMLElement).style.left).toBe("496px");
      expect(496 + 128).toBeLessThanOrEqual(628 - 4);
    } finally {
      wrapper.unmount();
      pane.remove();
    }
  });

  it("follows the block's height when only the vertical position changes", async () => {
    // A block that grows while selected (typing) keeps the same horizontal
    // spot; the bar still re-centres.
    const pane = makePane();
    layout(pane, 656, { blockHeight: 120 });
    const wrapper = mountEditor(BlockWrapper, {
      attachTo: pane,
      props: { block: createImageBlock(), isSelected: true },
    });
    try {
      await settle();
      const toolbar = wrapper.get(".tpl-block-actions").element as HTMLElement;
      expect(toolbar.style.left).toBe("526px");
      expect(toolbar.style.top).toBe("60px");
      layout(pane, 656, { blockHeight: 200 });
      pane.dispatchEvent(new Event("scroll"));
      await settle();
      expect(toolbar.style.left).toBe("526px");
      expect(toolbar.style.top).toBe("100px");
    } finally {
      wrapper.unmount();
      pane.remove();
    }
  });

  it("keeps the bar and pill beside a block outside any canvas pane", async () => {
    // Nothing to clamp to: a wrapper rendered outside `.tpl-body` places its
    // chrome as if the room were unlimited.
    const host = document.createElement("div");
    document.body.append(host);
    layout(host, 400, { blockHeight: 120 });
    const wrapper = mountEditor(BlockWrapper, {
      attachTo: host,
      props: { block: createImageBlock(), isSelected: true },
      provides: { [CAPABILITIES_KEY]: capabilities({ comments: 3 }) },
    });
    try {
      await settle();
      const toolbar = wrapper.get(".tpl-block-actions").element as HTMLElement;
      expect(toolbar.style.left).toBe("608px");
      expect(toolbar.style.top).toBe("50%");
      expect(wrapper.get(".tpl-comment-indicator").classes()).toContain(
        "tpl:absolute",
      );
    } finally {
      wrapper.unmount();
      host.remove();
    }
  });

  it("keeps the toolbar below a badge row that holds the comment pill", async () => {
    // The pill is 24 px tall against the lint badge's 20, so the bar clears
    // the row's measured bottom (4 + 24) plus 4 px, not a fixed 28.
    const pane = makePane();
    layout(pane, 656, { blockHeight: 80, badgeWidth: 56, badgeHeight: 24 });
    const wrapper = mountEditor(BlockWrapper, {
      attachTo: pane,
      props: { block: createImageBlock(), isSelected: true },
      provides: { [CAPABILITIES_KEY]: capabilities({ comments: 3 }) },
    });
    try {
      await settle();
      const toolbar = wrapper.get(".tpl-block-actions").element as HTMLElement;
      expect(toolbar.style.top).toBe("51px");
      expect(toolbar.style.left).toBe("526px");
    } finally {
      wrapper.unmount();
      pane.remove();
    }
  });
});

describe("action bar beside the comment pill", () => {
  it.each([
    // The pill ends 20 px down; the bar starts 4 px under it.
    { height: 40, top: "43px" },
    // Centred, the bar already starts below the pill.
    { height: 120, top: "50%" },
  ])(
    "starts below the pill on a $height px block",
    async ({ height, top }) => {
      const pane = makePane();
      layout(pane, 1000, { blockHeight: height });
      const wrapper = mountEditor(BlockWrapper, {
        attachTo: pane,
        props: { block: createImageBlock(), isSelected: true },
        provides: { [CAPABILITIES_KEY]: capabilities({ comments: 3 }) },
      });
      try {
        await settle();
        expect(wrapper.get(".tpl-comment-indicator").classes()).toContain(
          "tpl:absolute",
        );
        const toolbar = wrapper.get(".tpl-block-actions")
          .element as HTMLElement;
        expect(toolbar.style.left).toBe("608px");
        expect(toolbar.style.top).toBe(top);
      } finally {
        wrapper.unmount();
        pane.remove();
      }
    },
  );
});

describe("comment-count pill", () => {
  it("sits outside the block's top-right corner while the pane has room", async () => {
    const pane = makePane();
    layout(pane, 1000);
    const wrapper = mountEditor(BlockWrapper, {
      attachTo: pane,
      props: { block: createImageBlock(), isSelected: false },
      provides: { [CAPABILITIES_KEY]: capabilities({ comments: 3 }) },
    });
    try {
      await settle();
      const pill = wrapper.get(".tpl-comment-indicator");
      expect(pill.text()).toBe("3");
      // Out of the badge row's flow, past the corner.
      expect(pill.classes()).toContain("tpl:absolute");
      expect(pill.classes()).toContain("tpl:left-full");
      expect(pill.element.parentElement?.classList).toContain(
        "tpl-block-badges",
      );
    } finally {
      wrapper.unmount();
      pane.remove();
    }
  });

  it("joins the badge row when it would leave the pane, selected or not", async () => {
    // Beside the block it needs 600 + 4 + 32 + 4 = 640 px of the 628 px the
    // pane leaves in block coordinates.
    const pane = makePane();
    layout(pane, 656);
    const openForBlock = vi.fn();
    const block = createImageBlock();
    const wrapper = mountEditor(BlockWrapper, {
      attachTo: pane,
      props: { block, isSelected: false },
      provides: {
        [CAPABILITIES_KEY]: capabilities({ comments: 3, openForBlock }),
      },
    });
    try {
      await settle();
      const pill = wrapper.get(".tpl-comment-indicator");
      expect(pill.classes()).not.toContain("tpl:absolute");
      expect(pill.element.parentElement?.classList).toContain(
        "tpl-block-badges",
      );
      // First in the row: the lint badge keeps the corner.
      expect(pill.element.parentElement?.firstElementChild).toBe(pill.element);
      await pill.trigger("click");
      expect(openForBlock).toHaveBeenCalledWith(block.id);

      await wrapper.setProps({ isSelected: true });
      await settle();
      expect(
        wrapper.get(".tpl-comment-indicator").classes(),
      ).not.toContain("tpl:absolute");
    } finally {
      wrapper.unmount();
      pane.remove();
    }
  });

  it("returns outside the corner when the pane widens", async () => {
    const pane = makePane();
    layout(pane, 656);
    const wrapper = mountEditor(BlockWrapper, {
      attachTo: pane,
      props: { block: createImageBlock(), isSelected: false },
      provides: { [CAPABILITIES_KEY]: capabilities({ comments: 3 }) },
    });
    try {
      await settle();
      expect(wrapper.get(".tpl-comment-indicator").classes()).not.toContain(
        "tpl:absolute",
      );
      layout(pane, 1000);
      pane.dispatchEvent(new Event("scroll"));
      await settle();
      expect(wrapper.get(".tpl-comment-indicator").classes()).toContain(
        "tpl:absolute",
      );
    } finally {
      wrapper.unmount();
      pane.remove();
    }
  });

  it("renders nothing without comments on the block", async () => {
    const pane = makePane();
    layout(pane, 656);
    const wrapper = mountEditor(BlockWrapper, {
      attachTo: pane,
      props: { block: createImageBlock(), isSelected: true },
    });
    try {
      await settle();
      expect(wrapper.find(".tpl-comment-indicator").exists()).toBe(false);
      expect(wrapper.get(".tpl-block-badges").element.children).toHaveLength(
        0,
      );
    } finally {
      wrapper.unmount();
      pane.remove();
    }
  });
});
