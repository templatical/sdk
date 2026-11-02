// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { computed, defineComponent, h, nextTick, ref } from "vue";
import {
  createImageBlock,
  createParagraphBlock,
  createSectionBlock,
  resolveContentDirection,
} from "@templatical/types";
import BlockWrapper from "../src/components/blocks/BlockWrapper.vue";
import { useLocalizedDisplay } from "../src/composables/useLocalizedDisplay";
import {
  CAPABILITIES_KEY,
  EDITOR_KEY,
  LOCALIZATION_KEY,
  TEMPLATE_LINT_KEY,
} from "../src/keys";
import { languageContent } from "./helpers/localization";
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
    rtl = false,
    blockWidth = 600,
    blockLeft = 316,
  }: {
    scale?: number;
    scrollbar?: number;
    blockHeight?: number;
    badgeWidth?: number;
    badgeHeight?: number;
    actionsWidth?: number;
    rtl?: boolean;
    blockWidth?: number;
    blockLeft?: number;
  } = {},
) {
  const css: Record<
    string,
    { left: number; top?: number; width: number; height: number }
  > = {
    pane: { left: 288, width, height: 600 },
    block: { left: blockLeft, width: blockWidth, height: blockHeight },
    actions: { left: 0, width: actionsWidth, height: 38 },
    badges: {
      left: blockLeft + (rtl ? 4 : blockWidth - 4 - badgeWidth),
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
            ? {
                ...css.badges,
                left:
                  element.closest("[dir]")?.getAttribute("dir") === "rtl"
                    ? blockLeft + 4
                    : element.closest("[dir]")
                      ? blockLeft + blockWidth - 4 - badgeWidth
                      : css.badges.left,
              }
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
  it("repositions a selected short nested block with both badges when language or projected direction changes", async () => {
    const pane = document.createElement("div");
    pane.className = "tpl-body";
    document.body.append(pane);
    layout(pane, 244, { blockHeight: 20, badgeWidth: 44, blockWidth: 200 });
    const child = createParagraphBlock({ id: "short", content: "Hello" });
    const content = ref(languageContent());
    content.value.settings.direction = "auto";
    content.value.settings.locales = ["de", "ar"];
    content.value.blocks = [createSectionBlock({ children: [[child]] })];
    const editor = {
      content,
      activeLocale: ref("de"),
      state: { template: null },
    };
    const { settings } = useLocalizedDisplay(editor);
    const direction = computed(() => resolveContentDirection(settings.value));
    const Parent = defineComponent({
      setup: () => () =>
        h(
          "div",
          { dir: direction.value, style: { direction: direction.value } },
          [h(BlockWrapper, { block: child, isSelected: true, nested: true })],
        ),
    });
    const wrapper = mountEditor(Parent, {
      attachTo: pane,
      provides: {
        [EDITOR_KEY]: editor,
        [LOCALIZATION_KEY]: { locales: ["de", "ar"] },
        [TEMPLATE_LINT_KEY]: {
          issues: ref([
            {
              blockId: "short",
              severity: "warning",
              ruleId: "links.relative-url",
            },
          ]),
        },
      },
    });
    try {
      await vi.dynamicImportSettled();
      await nextTick();
      const selected = wrapper.get('[data-block-id="short"]');
      const toolbar = selected.get(".tpl-block-actions").element as HTMLElement;
      expect(selected.get(".tpl-block-badges").element.children).toHaveLength(
        2,
      );
      expect(toolbar.style.left).toBe("46px");
      for (const [locale, explicitDirection, expectedDirection, left] of [
        ["ar", "auto", "rtl", "56px"],
        ["de", "auto", "ltr", "46px"],
        ["de", "rtl", "rtl", "56px"],
        ["de", "ltr", "ltr", "46px"],
      ] as const) {
        editor.activeLocale.value = locale;
        content.value.settings.direction = explicitDirection;
        await nextTick();
        await nextTick();
        expect(getComputedStyle(selected.element).direction).toBe(
          expectedDirection,
        );
        expect(selected.classes()).toContain("tpl-block--selected");
        expect(selected.get(".tpl-block-actions").element).toBe(toolbar);
        expect(selected.get(".tpl-block-badges").element.children).toHaveLength(
          2,
        );
        expect((selected.element as HTMLElement).offsetWidth).toBe(200);
        expect(
          selected.get(".tpl-block-badges").element.getBoundingClientRect()
            .width,
        ).toBe(44);
        expect(toolbar.offsetWidth).toBe(98);
        expect(toolbar.style.top).toBe("50%");
        expect(toolbar.style.left).toBe(left);
      }
    } finally {
      wrapper.unmount();
      pane.remove();
    }
  });

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

  it.each([
    { direction: "ltr", scale: 1, left: "446px" },
    { direction: "rtl", scale: 1, left: "56px" },
    { direction: "ltr", scale: 0.5, left: "446px" },
    { direction: "rtl", scale: 0.5, left: "56px" },
  ])(
    "clears a short block's badge slot in $direction at scale $scale",
    async ({ direction, scale, left }) => {
      const pane = makePane();
      pane.style.direction = direction;
      layout(pane, 656, {
        scale,
        scrollbar: 15,
        blockHeight: 20,
        badgeWidth: 44,
        rtl: direction === "rtl",
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
        expect(toolbar.style.left).toBe(left);
        const x = Number.parseFloat(toolbar.style.left);
        if (direction === "ltr") expect(x + 98).toBeLessThanOrEqual(552 - 8);
        else expect(x).toBeGreaterThanOrEqual(48 + 8);
        expect(28 + x).toBeGreaterThanOrEqual(4);
        expect(28 + x + 98).toBeLessThanOrEqual(656 - 15 - 4);
        expect(toolbar.classList).toContain("tpl:z-20");
      } finally {
        wrapper.unmount();
        pane.remove();
      }
    },
  );

  it.each([
    { direction: "ltr", height: 20, left: "10px", top: "50%" },
    { direction: "rtl", height: 20, left: "92px", top: "50%" },
    { direction: "ltr", height: 80, left: "114px", top: "51px" },
    { direction: "rtl", height: 80, left: "114px", top: "51px" },
  ])(
    "clears the comment, lint and locale row in $direction on a $height px block",
    async ({ direction, height, left, top }) => {
      const pane = makePane();
      pane.style.direction = direction;
      layout(pane, 244, {
        blockWidth: 200,
        blockHeight: height,
        badgeWidth: 80,
        badgeHeight: 24,
        rtl: direction === "rtl",
      });
      const block = createParagraphBlock({ id: "short", content: "Hello" });
      const content = ref(languageContent());
      content.value.blocks = [block];
      const wrapper = mountEditor(BlockWrapper, {
        attachTo: pane,
        props: { block, isSelected: true },
        provides: {
          [EDITOR_KEY]: {
            content,
            activeLocale: ref("de"),
            state: { template: null },
          },
          [LOCALIZATION_KEY]: { locales: ["de", "ar"] },
          [TEMPLATE_LINT_KEY]: {
            issues: ref([
              {
                blockId: "short",
                severity: "warning",
                ruleId: "links.relative-url",
              },
            ]),
          },
          [CAPABILITIES_KEY]: capabilities({ comments: 3 }),
        },
      });
      try {
        await vi.dynamicImportSettled();
        await settle();
        const row = wrapper.get(".tpl-block-badges");
        const pill = wrapper.get(".tpl-comment-indicator");
        expect([...row.element.children]).toEqual([
          pill.element,
          wrapper.get(".tpl-block-issue-badge").element,
          wrapper.get('[data-testid="locale-chip"]').element,
        ]);
        expect(pill.classes()).not.toContain("tpl:absolute");
        const toolbar = wrapper.get(".tpl-block-actions")
          .element as HTMLElement;
        expect(toolbar.style.left).toBe(left);
        expect(toolbar.style.top).toBe(top);
        expect(28 + Number.parseFloat(left)).toBeGreaterThanOrEqual(4);
        expect(28 + Number.parseFloat(left) + 98).toBeLessThanOrEqual(244 - 4);
      } finally {
        wrapper.unmount();
        pane.remove();
      }
    },
  );

  it.each([
    { direction: "ltr", width: 244, badgeWidth: 120, left: "-24px" },
    { direction: "rtl", width: 160, badgeWidth: 44, left: "30px" },
  ])(
    "clamps the short-block fallback to the pane in $direction",
    async ({ direction, width, badgeWidth, left }) => {
      const pane = makePane();
      pane.style.direction = direction;
      layout(pane, width, {
        blockWidth: 200,
        blockHeight: 20,
        badgeWidth,
        rtl: direction === "rtl",
      });
      const wrapper = mountEditor(BlockWrapper, {
        attachTo: pane,
        props: { block: createImageBlock(), isSelected: true },
      });
      try {
        await settle();
        const toolbar = wrapper.get(".tpl-block-actions")
          .element as HTMLElement;
        expect(toolbar.style.left).toBe(left);
        expect(toolbar.style.top).toBe("50%");
        const x = Number.parseFloat(left);
        expect(28 + x).toBeGreaterThanOrEqual(4);
        expect(28 + x + 98).toBeLessThanOrEqual(width - 4);
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
  ])("starts below the pill on a $height px block", async ({ height, top }) => {
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
      const toolbar = wrapper.get(".tpl-block-actions").element as HTMLElement;
      expect(toolbar.style.left).toBe("608px");
      expect(toolbar.style.top).toBe(top);
    } finally {
      wrapper.unmount();
      pane.remove();
    }
  });
});

describe("comment-count pill", () => {
  it("repositions a comment-only block after the language or projected direction updates", async () => {
    const pane = makePane();
    layout(pane, 1000);
    const block = createImageBlock();
    const content = ref(languageContent());
    content.value.settings.direction = "auto";
    content.value.settings.locales = ["de", "ar"];
    const editor = {
      content,
      activeLocale: ref("de"),
      state: { template: null },
    };
    const { settings } = useLocalizedDisplay(editor);
    const direction = computed(() => resolveContentDirection(settings.value));
    const Parent = defineComponent({
      setup: () => () =>
        h(
          "div",
          { dir: direction.value, style: { direction: direction.value } },
          [h(BlockWrapper, { block, isSelected: false })],
        ),
    });
    const wrapper = mountEditor(Parent, {
      attachTo: pane,
      provides: {
        [EDITOR_KEY]: editor,
        [CAPABILITIES_KEY]: capabilities({ comments: 3 }),
      },
    });
    try {
      await settle();
      const pill = wrapper.get(".tpl-comment-indicator");
      expect(pill.classes()).toContain("tpl:absolute");
      for (const [locale, explicitDirection, expectedDirection, outside] of [
        ["ar", "auto", "rtl", false],
        ["de", "auto", "ltr", true],
        ["de", "rtl", "rtl", false],
        ["de", "ltr", "ltr", true],
      ] as const) {
        editor.activeLocale.value = locale;
        content.value.settings.direction = explicitDirection;
        await settle();
        expect(getComputedStyle(pill.element).direction).toBe(
          expectedDirection,
        );
        expect(wrapper.get(".tpl-comment-indicator").element).toBe(
          pill.element,
        );
        expect(pill.classes().includes("tpl:absolute")).toBe(outside);
        expect(wrapper.find(".tpl-block-actions").exists()).toBe(false);
      }
    } finally {
      wrapper.unmount();
      pane.remove();
    }
  });

  it("keeps the wide-pane RTL bar centred with the exterior pill on the other side", async () => {
    const pane = makePane();
    pane.style.direction = "rtl";
    layout(pane, 1000, { rtl: true, blockLeft: 400, blockHeight: 40 });
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
      const toolbar = wrapper.get(".tpl-block-actions").element as HTMLElement;
      expect(toolbar.style.left).toBe("608px");
      expect(toolbar.style.top).toBe("50%");
    } finally {
      wrapper.unmount();
      pane.remove();
    }
  });

  it("uses the left corner's available room in RTL and returns outside when it fits", async () => {
    const pane = makePane();
    pane.style.direction = "rtl";
    layout(pane, 1000, { rtl: true });
    const wrapper = mountEditor(BlockWrapper, {
      attachTo: pane,
      props: { block: createImageBlock(), isSelected: false },
      provides: { [CAPABILITIES_KEY]: capabilities({ comments: 3 }) },
    });
    try {
      await settle();
      const pill = wrapper.get(".tpl-comment-indicator");
      // Plenty of room on the right cannot make the pill fit on the left.
      expect(pill.classes()).not.toContain("tpl:absolute");
      layout(pane, 1000, { rtl: true, blockLeft: 400 });
      pane.dispatchEvent(new Event("scroll"));
      await settle();
      expect(pill.classes()).toContain("tpl:absolute");
      for (const name of ["tpl:inset-s-full", "tpl:ms-2"])
        expect(pill.classes()).toContain(name);
    } finally {
      wrapper.unmount();
      pane.remove();
    }
  });

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
      expect(pill.classes()).toContain("tpl:inset-s-full");
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
      expect(wrapper.get(".tpl-comment-indicator").classes()).not.toContain(
        "tpl:absolute",
      );
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
      expect(wrapper.get(".tpl-block-badges").element.children).toHaveLength(0);
    } finally {
      wrapper.unmount();
      pane.remove();
    }
  });
});
