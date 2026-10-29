// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { mountEditor } from "./helpers/mount";
import { languageContent } from "./helpers/localization";
import { EDITOR_KEY, POPOVER_ROOT_KEY, TRANSLATIONS_KEY } from "../src/keys";
import en from "../src/i18n/locales/en";
import LocaleStatusChip from "../src/components/localization/LocaleStatusChip.vue";

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
});
function rect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}
function open(
  options: {
    anchor?: DOMRect;
    height?: number;
    host?: DOMRect;
    long?: boolean;
  } = {},
) {
  const host = document.createElement("div");
  const target = document.createElement("div");
  host.append(target);
  document.body.append(host);
  cleanups.push(() => host.remove());
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(600);
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(800);
  const bounding = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      if (this === host || this === target)
        return options.host ?? rect(0, 0, 800, 600);
      if (this.dataset.testid === "locale-chip")
        return options.anchor ?? rect(120, 550, 140, 24);
      if (this.dataset.testid === "locale-popover")
        return rect(0, 0, 300, options.height ?? 140);
      return rect(0, 0, 0, 0);
    });
  const wrapper = mountEditor(LocaleStatusChip, {
    attachTo: host,
    props: {
      blockId: "title",
      state: options.long ? "default-stale" : "stale",
      count: options.long ? 20 : 1,
      stale: ["content"],
      setPaths: [],
      staleLocales: options.long ? ["de", "fr"] : [],
      excerpt: "Hello",
      eligibleGaps: false,
      editable: true,
    },
    provides: {
      [EDITOR_KEY]: {
        activeLocale: ref(options.long ? null : "de"),
        content: ref(languageContent()),
        state: { template: { id: "one" } },
      },
      [POPOVER_ROOT_KEY]: ref(target),
      [TRANSLATIONS_KEY]: en,
    },
  });
  cleanups.push(() => wrapper.unmount());
  return { wrapper, target, bounding };
}
async function show(
  wrapper: ReturnType<typeof open>["wrapper"],
  target: HTMLElement,
) {
  await wrapper.get('[data-testid="locale-chip"]').trigger("click");
  await nextTick();
  return target.querySelector<HTMLElement>('[data-testid="locale-popover"]')!;
}

describe("locale popover viewport placement", () => {
  it("measures the popup and flips above a bottom-edge chip without scrolling focus", async () => {
    const { wrapper, target } = open();
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const popup = await show(wrapper, target);
    expect(popup.style.top).toBe("406px");
    expect(popup.style.left).toBe("120px");
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    await wrapper
      .get('[data-testid="locale-chip"]')
      .trigger("keydown", { key: "Escape" });
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
  });

  it("caps a long language list at the visible viewport and keeps internal scrolling open", async () => {
    const { wrapper, target } = open({
      anchor: rect(700, 20, 90, 24),
      height: 1200,
      long: true,
    });
    const popup = await show(wrapper, target);
    expect(popup.style.maxHeight).toBe("584px");
    expect(popup.style.top).toBe("8px");
    expect(popup.style.left).toBe("492px");
    expect(popup.classList.contains("tpl:overflow-y-auto")).toBe(true);
    popup.dispatchEvent(new Event("scroll"));
    await nextTick();
    expect(target.contains(popup)).toBe(true);
  });

  it("constrains to the intersection of the editor and viewport, using popover-root coordinates", async () => {
    const { wrapper, target } = open({
      host: rect(100, 80, 500, 700),
      anchor: rect(500, 120, 80, 24),
    });
    const popup = await show(wrapper, target);
    expect(popup.style.left).toBe("192px");
    expect(popup.style.top).toBe("68px");
    expect(popup.style.maxHeight).toBe("504px");
  });
});
