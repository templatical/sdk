// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { ref } from "vue";
import type { TemplateSettings } from "@templatical/types";
import TemplateSettingsPanel from "../src/components/TemplateSettings.vue";
import ColorPicker from "../src/components/ColorPicker.vue";
import { FONTS_MANAGER_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

/**
 * Document-level text color in the settings tab (issue #355).
 *
 * The Appearance card exposes it as a second ColorPicker, right after
 * Background color. It's a required setting (defaulting to #1a1a1a), so the
 * picker always reflects a value and mirrors how the Background color control
 * behaves — it isn't an unset/inherit control (that's per-block).
 */

function makeSettings(
  overrides: Partial<TemplateSettings> = {},
): TemplateSettings {
  return {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
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

// Appearance card order: [0] = Background color, [1] = Text color.
function textColorPicker(wrapper: ReturnType<typeof mountSettings>) {
  const pickers = wrapper.findAllComponents(ColorPicker);
  expect(pickers.length).toBeGreaterThanOrEqual(2);
  return pickers[1];
}

describe("TemplateSettings document text color", () => {
  it("binds the text-color picker to a custom settings.textColor", () => {
    const wrapper = mountSettings(makeSettings({ textColor: "#336699" }));
    expect(textColorPicker(wrapper).props("modelValue")).toBe("#336699");
  });

  it("reflects the #1a1a1a default when settings use the defaults", () => {
    const wrapper = mountSettings(makeSettings());
    expect(textColorPicker(wrapper).props("modelValue")).toBe("#1a1a1a");
  });

  it("emits the chosen color on update", async () => {
    const wrapper = mountSettings(makeSettings());
    await textColorPicker(wrapper).vm.$emit("update:modelValue", "#123456");
    expect(wrapper.emitted("update")).toContainEqual([
      { textColor: "#123456" },
    ]);
  });
});
