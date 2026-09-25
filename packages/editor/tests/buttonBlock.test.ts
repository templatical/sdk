import { shallowRef } from "vue";
// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import {
  SYNTAX_PRESETS,
  createButtonBlock,
  uniformBorder,
} from "@templatical/types";
import type { ButtonBlock as ButtonBlockType } from "@templatical/types";
import enTranslations from "../src/i18n/locales/en";
import {
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import ButtonBlock from "../src/components/blocks/ButtonBlock.vue";

function mountButton(block: ButtonBlockType) {
  return mount(ButtonBlock, {
    props: { block, viewport: "desktop" },
    global: {
      provide: {
        [TRANSLATIONS_KEY as symbol]: enTranslations,
        [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.liquid,
        [MERGE_TAGS_KEY as symbol]: shallowRef([]),
      },
    },
  });
}

/**
 * The canvas is the WYSIWYG contract, and this component also backs
 * `BlockPreviewCanvas` — so a hardcoded alignment here would misreport what
 * gets sent in saved-block previews and the test-email dialog too.
 */
describe("ButtonBlock alignment", () => {
  it.each(["left", "center", "right"] as const)(
    "places the button %s",
    (align) => {
      const wrapper = mountButton(createButtonBlock({ text: "Go", align }));
      const wrapperEl = wrapper.element as HTMLElement;
      expect(wrapperEl.style.textAlign).toBe(align);
    },
  );

  it("centers a button stored without align", () => {
    const block = createButtonBlock({ text: "Go" });
    delete (block as { align?: unknown }).align;

    const wrapperEl = mountButton(block).element as HTMLElement;
    expect(wrapperEl.style.textAlign).toBe("center");
  });

  it("keeps the alignment on a full-width button", () => {
    // The anchor spans the column so there is nothing to move, but the wrapper
    // must still carry the stored value rather than silently normalizing it.
    const wrapper = mountButton(
      createButtonBlock({ text: "Go", align: "left", width: "full" }),
    );
    expect((wrapper.element as HTMLElement).style.textAlign).toBe("left");
    expect((wrapper.find("a").element as HTMLElement).style.width).toBe("100%");
  });
});

describe("ButtonBlock border", () => {
  it("borders the button itself, like the exported mj-button", () => {
    const wrapper = mountButton(
      createButtonBlock({
        border: uniformBorder({ width: 2, style: "solid", color: "#123456" }),
      }),
    );
    const style = (wrapper.find("a").element as HTMLElement).style;
    expect(style.borderWidth).toBe("2px");
    expect(style.borderStyle).toBe("solid");
  });

  it("gives each side its own width, style and color", () => {
    const none = { width: 0, style: "solid" as const, color: "#000000" };
    const wrapper = mountButton(
      createButtonBlock({
        border: {
          top: none,
          right: { width: 1, style: "dotted", color: "#654321" },
          bottom: { width: 2, style: "solid", color: "#123456" },
          left: none,
        },
      }),
    );
    const style = (wrapper.find("a").element as HTMLElement).style;
    expect(style.borderBottomWidth).toBe("2px");
    expect(style.borderBottomStyle).toBe("solid");
    expect(style.borderRightWidth).toBe("1px");
    expect(style.borderRightStyle).toBe("dotted");
    expect(style.borderTopWidth).toBe("");
  });

  it("rounds only the chosen corners", () => {
    const wrapper = mountButton(
      createButtonBlock({
        borderRadius: { topLeft: 0, topRight: 20, bottomRight: 20, bottomLeft: 0 },
      }),
    );
    expect((wrapper.find("a").element as HTMLElement).style.borderRadius).toBe(
      "0px 20px 20px 0px",
    );
  });

  it("sets no border when none is stored", () => {
    const wrapper = mountButton(createButtonBlock());
    expect((wrapper.find("a").element as HTMLElement).style.border).toBe("");
  });
});
