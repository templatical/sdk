// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { mountEditor } from "./helpers/mount";
import { languageContent } from "./helpers/localization";
import {
  EDITOR_KEY,
  POPOVER_ROOT_KEY,
  TRANSLATIONS_KEY,
  TRANSLATION_FEATURE_KEY,
} from "../src/keys";
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
    height?: number | ((popup: HTMLElement) => number);
    host?: DOMRect;
    long?: boolean;
    confirmation?: boolean;
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
        return rect(
          0,
          0,
          300,
          typeof options.height === "function"
            ? options.height(this)
            : (options.height ?? 140),
        );
      return rect(0, 0, 0, 0);
    });
  const wrapper = mountEditor(LocaleStatusChip, {
    attachTo: host,
    props: {
      blockId: "title",
      state: options.confirmation
        ? "tags-differ"
        : options.long
          ? "default-stale"
          : "stale",
      count: options.long ? 20 : 1,
      stale: ["content"],
      setPaths: [],
      staleLocales: options.long ? ["de", "fr"] : [],
      excerpt: "Hello",
      eligibleGaps: !!options.confirmation,
      translationCount: 2,
      replacesCurrent: !!options.confirmation,
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
      [TRANSLATION_FEATURE_KEY]: options.confirmation
        ? {
            isAvailable: ref(true),
            running: ref(false),
            translate: vi.fn(),
          }
        : null,
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
  it("names and describes the confirmation with stable ids and restores the badge label on Cancel", async () => {
    const { wrapper, target } = open({ confirmation: true });
    const popup = await show(wrapper, target);
    const showConfirmation = async () => {
      popup
        .querySelector<HTMLButtonElement>('[data-testid="locale-retranslate"]')!
        .click();
      await nextTick();
    };
    await showConfirmation();
    const question = popup.querySelector("h3")!;
    const warning = popup.querySelector("p")!;
    expect(question.id).toBeTruthy();
    expect(warning.id).toBeTruthy();
    expect(question.id).not.toBe(warning.id);
    expect(popup.getAttribute("aria-labelledby")).toBe(question.id);
    expect(popup.getAttribute("aria-describedby")).toBe(warning.id);
    expect(popup.hasAttribute("aria-label")).toBe(false);
    expect(question.textContent?.trim()).toBe("Translate all 2 fields again?");
    expect(warning.textContent?.trim()).toBe(
      "This replaces the current Deutsch translations, including manual edits. You can undo it.",
    );
    expect(question.classList).toContain("tpl:font-semibold");
    expect(warning.classList).toContain("tpl:text-[var(--tpl-text-muted)]");
    const ids = [question.id, warning.id];
    popup
      .querySelector<HTMLButtonElement>(
        '[data-testid="translation-confirm-cancel"]',
      )!
      .click();
    await nextTick();
    expect(popup.getAttribute("aria-label")).toBe("Merge tags differ");
    expect(popup.hasAttribute("aria-labelledby")).toBe(false);
    expect(popup.hasAttribute("aria-describedby")).toBe(false);
    await showConfirmation();
    expect([
      popup.querySelector("h3")!.id,
      popup.querySelector("p")!.id,
    ]).toEqual(ids);
  });

  it("focuses Cancel after positioning the confirmation and returns focus to Re-translate on Cancel", async () => {
    const { wrapper, target } = open({ confirmation: true });
    const popup = await show(wrapper, target);
    popup
      .querySelector<HTMLButtonElement>('[data-testid="locale-retranslate"]')!
      .click();
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(
        popup.querySelector('[data-testid="translation-confirm-cancel"]'),
      ),
    );
    (document.activeElement as HTMLButtonElement).click();
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(
        popup.querySelector('[data-testid="locale-retranslate"]'),
      ),
    );
  });

  it("cancels only the confirmation on the first Escape and closes the popover on the second", async () => {
    const { wrapper, target } = open({ confirmation: true });
    const popup = await show(wrapper, target);
    popup
      .querySelector<HTMLButtonElement>('[data-testid="locale-retranslate"]')!
      .click();
    await nextTick();
    popup.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await nextTick();
    expect(target.contains(popup)).toBe(true);
    expect(
      popup.querySelector('[data-testid="translation-confirm"]'),
    ).toBeNull();
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(
        popup.querySelector('[data-testid="locale-retranslate"]'),
      ),
    );
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await nextTick();
    expect(target.querySelector('[data-testid="locale-popover"]')).toBeNull();
    expect(document.activeElement).toBe(
      wrapper.get('[data-testid="locale-chip"]').element,
    );
  });

  it("repositions the taller confirmation and the explanation after cancelling", async () => {
    const { wrapper, target } = open({
      anchor: rect(120, 460, 20, 20),
      confirmation: true,
      height: (popup) =>
        popup.querySelector('[data-testid="translation-confirm"]') ? 200 : 80,
    });
    const popup = await show(wrapper, target);
    expect(popup.style.top).toBe("484px");
    popup
      .querySelector<HTMLButtonElement>('[data-testid="locale-retranslate"]')!
      .click();
    await vi.waitFor(() => expect(popup.style.top).toBe("256px"));
    expect(Number.parseFloat(popup.style.top) + 200).toBeLessThanOrEqual(592);
    popup
      .querySelector<HTMLButtonElement>(
        '[data-testid="translation-confirm-cancel"]',
      )!
      .click();
    await vi.waitFor(() => expect(popup.style.top).toBe("484px"));
  });

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
