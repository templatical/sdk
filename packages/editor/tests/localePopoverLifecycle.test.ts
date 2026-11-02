// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, reactive, ref } from "vue";
import { localizeBlock } from "@templatical/types";
import { mountEditor } from "./helpers/mount";
import { languageContent } from "./helpers/localization";
import BlockWrapper from "../src/components/blocks/BlockWrapper.vue";
import {
  EDITOR_KEY,
  EDITOR_ROOT_KEY,
  LOCALIZATION_KEY,
  POPOVER_ROOT_KEY,
  TRANSLATION_FEATURE_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import en from "../src/i18n/locales/en";

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup());
  vi.restoreAllMocks();
});

function setup(shadow: boolean, hidden = false) {
  const host = document.createElement("div");
  document.body.append(host);
  cleanups.push(() => host.remove());
  const root = shadow ? host.attachShadow({ mode: "open" }) : document;
  const scroller = document.createElement("div");
  const mountPoint = document.createElement("div");
  const target = document.createElement("div");
  scroller.append(mountPoint);
  (shadow ? root : host).append(scroller, target);
  let anchorTop = 200;
  let anchorLeft = 0;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const top = this.dataset.testid === "locale-chip" ? anchorTop : 0;
      return {
        x: this.dataset.testid === "locale-chip" ? anchorLeft : 0,
        y: top,
        top,
        left: this.dataset.testid === "locale-chip" ? anchorLeft : 0,
        right: 300,
        bottom: top + 100,
        width: 300 - (this.dataset.testid === "locale-chip" ? anchorLeft : 0),
        height: 100,
        toJSON: () => ({}),
      };
    },
  );
  const editor = {
    activeLocale: ref("de"),
    content: ref(languageContent()),
    state: reactive({ template: { id: "one" } }),
    keepTranslations: vi.fn(),
    resetLocaleFields: vi.fn(),
    setBlockHidden: vi.fn(),
  };
  if (hidden) editor.content.value.blocks[0].l10n!.de.hidden = true;
  const translate = vi.fn();
  const render = ref(0);
  const Parent = defineComponent({
    setup: () => () => {
      const block = editor.content.value.blocks[0];
      return h(BlockWrapper, {
        block,
        displayBlock: localizeBlock(block, "de", "en"),
        isSelected: render.value % 2 === 1,
      });
    },
  });
  const wrapper = mountEditor(Parent, {
    attachTo: mountPoint,
    provides: {
      [EDITOR_KEY]: editor,
      [EDITOR_ROOT_KEY]: root,
      [POPOVER_ROOT_KEY]: ref(target),
      [LOCALIZATION_KEY]: { locales: ["de"] },
      [TRANSLATIONS_KEY]: en,
      [TRANSLATION_FEATURE_KEY]: {
        isAvailable: ref(true),
        running: ref(false),
        translate,
      },
    },
  });
  cleanups.push(() => wrapper.unmount());
  const chip = mountPoint.querySelector<HTMLButtonElement>(
    '[data-testid="locale-chip"]',
  )!;
  const popup = () =>
    target.querySelector<HTMLElement>('[data-testid="locale-popover"]');
  return {
    editor,
    render,
    chip,
    popup,
    scroller,
    translate,
    collapseLabel: () => {
      anchorLeft = 280;
    },
    moveAnchor: () => {
      anchorTop -= 30;
    },
  };
}

describe.each([false, true])(
  "locale popover lifecycle (shadow: %s)",
  (shadow) => {
    it("keeps the action attached when focus collapses the gutter label before a queued scroll", async () => {
      const context = setup(shadow);
      context.chip.focus();
      context.chip.click();
      await nextTick();
      await nextTick();
      const popup = context.popup()!;
      const keep = popup.querySelector<HTMLButtonElement>(
        '[data-testid="locale-keep"]',
      )!;
      // Popup focus removes :focus from the chip. Its label grows leftward,
      // so only its left edge changes; the gutter icon stays at the same spot.
      context.collapseLabel();
      context.scroller.dispatchEvent(new Event("scroll"));
      await nextTick();
      expect(context.popup()).toBe(popup);
      expect(keep.isConnected).toBe(true);
      keep.click();
      expect(context.editor.keepTranslations).toHaveBeenCalledWith("title", [
        "content",
      ]);
    });

    it.each(["keep", "show", "retranslate", "use-default"])(
      "keeps %s attached through queued pre-open scrolls and fresh display projections",
      async (action) => {
        const context = setup(shadow, action === "show");
        context.chip.click();
        await nextTick();
        await nextTick();
        const popup = context.popup()!;
        const button = popup.querySelector<HTMLButtonElement>(
          `[data-testid="locale-${action}"]`,
        )!;
        // scrollIntoView/focus can queue this before opening; its anchor is already current.
        context.scroller.dispatchEvent(new Event("scroll"));
        for (let i = 0; i < 3; i++) {
          context.render.value++;
          await nextTick();
          expect(context.popup()).toBe(popup);
          expect(button.isConnected).toBe(true);
        }
        button.click();
        if (action === "keep")
          expect(context.editor.keepTranslations).toHaveBeenCalledWith(
            "title",
            ["content"],
          );
        if (action === "show")
          expect(context.editor.setBlockHidden).toHaveBeenCalledWith(
            "title",
            false,
          );
        if (action === "retranslate")
          expect(context.translate).toHaveBeenCalledWith({
            only: "gaps",
            blockId: "title",
          });
        if (action === "use-default")
          expect(context.editor.resetLocaleFields).toHaveBeenCalledWith(
            "title",
            ["content"],
          );
      },
    );

    it("compares template ids by value and still closes when the block, template or language changes", async () => {
      const context = setup(shadow);
      for (const change of [
        () => {
          context.editor.content.value.blocks[0].id = "another-block";
        },
        () => {
          context.editor.state.template = { id: "another-template" };
        },
        () => {
          context.editor.activeLocale.value = "fr";
        },
      ]) {
        context.chip.click();
        await nextTick();
        const popup = context.popup();
        expect(popup).not.toBeNull();
        context.editor.state.template = { ...context.editor.state.template };
        context.render.value++;
        await nextTick();
        expect(context.popup()).toBe(popup);
        change();
        await nextTick();
        expect(context.popup()).toBeNull();
      }
    });

    it("keeps a keyboard-opened popup through a queued focus scroll, then dismisses when the anchor moves", async () => {
      const context = setup(shadow);
      context.chip.focus();
      context.chip.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      await nextTick();
      const popup = context.popup();
      context.scroller.dispatchEvent(new Event("scroll"));
      await nextTick();
      expect(context.popup()).toBe(popup);
      context.moveAnchor();
      context.scroller.dispatchEvent(new Event("scroll"));
      await nextTick();
      expect(context.popup()).toBeNull();
    });
  },
);
