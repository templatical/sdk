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
import { EDITOR_KEY, LOCALIZATION_KEY, TEMPLATE_LINT_KEY } from "../src/keys";
import { languageContent } from "./helpers/localization";
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
  badgeWidth = 0,
  rtl = false,
  blockWidth = 600,
) {
  const css: Record<string, { left: number; width: number; height: number }> = {
    pane: { left: 288, width, height: 600 },
    block: { left: 316, width: blockWidth, height: blockHeight },
    actions: { left: 0, width: 98, height: 38 },
    badges: {
      left: 316 + (rtl ? 4 : blockWidth - 4 - badgeWidth),
      width: badgeWidth,
      height: badgeWidth ? 20 : 0,
    },
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
                    ? 320
                    : element.closest("[dir]")
                      ? 316 + blockWidth - 4 - badgeWidth
                      : css.badges.left,
              }
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
  it("repositions a selected short nested block with both badges when language or projected direction changes", async () => {
    const pane = document.createElement("div");
    pane.className = "tpl-body";
    document.body.append(pane);
    layout(pane, 244, 1, 0, 20, 44, false, 200);
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
    { direction: "ltr", scale: 1, left: "446px" },
    { direction: "rtl", scale: 1, left: "56px" },
    { direction: "ltr", scale: 0.5, left: "446px" },
    { direction: "rtl", scale: 0.5, left: "56px" },
  ])(
    "clears a short block's badge slot in $direction at scale $scale",
    async ({ direction, scale, left }) => {
      const pane = document.createElement("div");
      pane.className = "tpl-body";
      pane.style.direction = direction;
      document.body.append(pane);
      layout(pane, 656, scale, 15, 20, 44, direction === "rtl");
      const wrapper = mountEditor(BlockWrapper, {
        attachTo: pane,
        props: { block: createImageBlock(), isSelected: true },
      });
      try {
        await nextTick();
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
