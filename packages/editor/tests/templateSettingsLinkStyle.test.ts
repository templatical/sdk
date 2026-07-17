// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { ref } from "vue";
import type { TemplateSettings } from "@templatical/types";
import TemplateSettingsPanel from "../src/components/TemplateSettings.vue";
import ColorPicker from "../src/components/ColorPicker.vue";
import { FONTS_MANAGER_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

/**
 * Document-level link styling in the settings tab (issue #352).
 *
 * The Appearance card exposes a link-color ColorPicker and an underline
 * toggle, right after the text-color picker. Unlike text color, link color is
 * optional (unset = links inherit the text color), so the picker uses the
 * unset/inherit convention (empty model value, clearing emits `undefined`).
 * The underline toggle is a required boolean switch.
 */

function makeSettings(
  overrides: Partial<TemplateSettings> = {},
): TemplateSettings {
  return {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    linkUnderline: false,
    fontFamily: "Arial",
    locale: "en",
    ...overrides,
  };
}

const fontsManager = {
  fonts: ref([{ label: "Default", value: "Arial" }]),
  defaultFont: ref("Arial"),
  loadCustomFonts: async () => {},
  cleanupFontLinks: () => {},
  setCustomFontsEnabled: () => {},
};

function mountSettings(settings: TemplateSettings) {
  return mountEditor(TemplateSettingsPanel, {
    props: { settings },
    provides: { [FONTS_MANAGER_KEY]: fontsManager },
  });
}

// Appearance card order: [0] Background color, [1] Text color, [2] Link color.
function linkColorPicker(wrapper: ReturnType<typeof mountSettings>) {
  const pickers = wrapper.findAllComponents(ColorPicker);
  expect(pickers.length).toBeGreaterThanOrEqual(3);
  return pickers[2];
}

function underlineToggle(wrapper: ReturnType<typeof mountSettings>) {
  const toggle = wrapper.find('button[role="switch"]');
  expect(toggle.exists()).toBe(true);
  return toggle;
}

describe("TemplateSettings link color", () => {
  it("binds the link-color picker to a custom settings.linkColor", () => {
    const wrapper = mountSettings(makeSettings({ linkColor: "#ff6600" }));
    expect(linkColorPicker(wrapper).props("modelValue")).toBe("#ff6600");
  });

  it("shows the picker as unset (empty) when linkColor is undefined", () => {
    const wrapper = mountSettings(makeSettings());
    expect(linkColorPicker(wrapper).props("modelValue")).toBe("");
  });

  it("emits the chosen link color on update", async () => {
    const wrapper = mountSettings(makeSettings());
    await linkColorPicker(wrapper).vm.$emit("update:modelValue", "#123456");
    expect(wrapper.emitted("update")).toContainEqual([
      { linkColor: "#123456" },
    ]);
  });

  it("emits linkColor: undefined when the picker is cleared", async () => {
    const wrapper = mountSettings(makeSettings({ linkColor: "#ff6600" }));
    await linkColorPicker(wrapper).vm.$emit("update:modelValue", "");
    expect(wrapper.emitted("update")).toContainEqual([
      { linkColor: undefined },
    ]);
  });
});

describe("TemplateSettings link underline", () => {
  it("reflects settings.linkUnderline in the toggle's aria-checked", () => {
    expect(
      underlineToggle(
        mountSettings(makeSettings({ linkUnderline: true })),
      ).attributes("aria-checked"),
    ).toBe("true");
    expect(
      underlineToggle(
        mountSettings(makeSettings({ linkUnderline: false })),
      ).attributes("aria-checked"),
    ).toBe("false");
  });

  it("toggles linkUnderline on from false", async () => {
    const wrapper = mountSettings(makeSettings({ linkUnderline: false }));
    await underlineToggle(wrapper).trigger("click");
    expect(wrapper.emitted("update")).toContainEqual([{ linkUnderline: true }]);
  });

  it("toggles linkUnderline off from true", async () => {
    const wrapper = mountSettings(makeSettings({ linkUnderline: true }));
    await underlineToggle(wrapper).trigger("click");
    expect(wrapper.emitted("update")).toContainEqual([
      { linkUnderline: false },
    ]);
  });
});
