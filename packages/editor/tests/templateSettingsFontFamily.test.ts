// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { ref } from "vue";
import type { TemplateSettings } from "@templatical/types";
import TemplateSettingsPanel from "../src/components/TemplateSettings.vue";
import { FONTS_MANAGER_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

function makeSettings(fontFamily: string): TemplateSettings {
  return {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#1a1a1a",
    fontFamily,
    locale: "en",
  };
}

function mountSettings(fontFamily: string, defaultFont = "Arial") {
  const fontsManager = {
    fonts: ref([
      { label: "Arial", value: "Arial" },
      { label: "Georgia", value: "Georgia" },
    ]),
    defaultFont: ref(defaultFont),
    loadCustomFonts: async () => {},
    cleanupFontLinks: () => {},
  };
  const wrapper = mountEditor(TemplateSettingsPanel, {
    props: { settings: makeSettings(fontFamily) },
    provides: { [FONTS_MANAGER_KEY]: fontsManager },
  });
  const select = wrapper.find<HTMLSelectElement>(
    '[data-testid="template-settings-font-family"] select',
  ).element;
  return {
    value: select.value,
    selectedLabel: select.options[select.selectedIndex]?.textContent?.trim(),
    labels: Array.from(select.options).map((o) => o.textContent?.trim()),
  };
}

describe("TemplateSettings font family", () => {
  it("selects the listed family for a stack that starts with it", () => {
    const select = mountSettings("Georgia, serif");
    expect(select.value).toBe("Georgia, serif");
    expect(select.selectedLabel).toBe("Georgia");
    expect(select.labels).toEqual(["Arial", "Georgia"]);
  });

  it("lists a family the picker doesn't offer, instead of the default", () => {
    const select = mountSettings("Helvetica Neue");
    expect(select.value).toBe("Helvetica Neue");
    expect(select.labels).toEqual(["Helvetica Neue", "Arial", "Georgia"]);
  });

  it("falls back to the default font only when none is set", () => {
    expect(mountSettings("", "Georgia").selectedLabel).toBe("Georgia");
    expect(mountSettings("inherit !important", "Georgia").selectedLabel).toBe(
      "Georgia",
    );
    expect(mountSettings("  ", "Arial, sans-serif").selectedLabel).toBe(
      "Arial",
    );
  });
});
