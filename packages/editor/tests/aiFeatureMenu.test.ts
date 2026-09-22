// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { computed } from "vue";
import { mount } from "@vue/test-utils";
import AiFeatureMenu from "../src/cloud/components/AiFeatureMenu.vue";
import { AI_CONFIG_KEY, CLOUD_TRANSLATIONS_KEY } from "../src/keys";
import cloudEn from "../src/i18n/locales/cloud/en";
import type { AiConfig } from "@templatical/types";

function mountMenu(
  enabled: Partial<Record<keyof AiConfig, boolean>>,
  activeFeature: "ai-chat" | "design-reference" | "scoring" | null = null,
) {
  return mount(AiFeatureMenu, {
    props: { activeFeature },
    global: {
      provide: {
        [CLOUD_TRANSLATIONS_KEY as symbol]: cloudEn,
        [AI_CONFIG_KEY as symbol]: {
          isFeatureEnabled: (feature: keyof AiConfig) =>
            enabled[feature] !== false,
          hasAnyMenuFeature: computed(() => true),
        },
      },
    },
  });
}

describe("AiFeatureMenu", () => {
  it("lists every enabled feature and emits the selected key", async () => {
    const wrapper = mountMenu({});
    const labels = wrapper.findAll("button").map((b) => b.text());
    expect(labels.some((t) => t.includes("AI Assistant"))).toBe(true);
    expect(labels.some((t) => t.includes("Design to Template"))).toBe(true);
    expect(labels.some((t) => t.includes("Template Score"))).toBe(true);

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Template Score"))!
      .trigger("click");
    expect(wrapper.emitted("select")).toEqual([["scoring"]]);
  });

  it("hides features the plan withheld", () => {
    const wrapper = mountMenu({ chat: false, designToTemplate: false });
    expect(wrapper.text()).not.toContain("AI Assistant");
    expect(wrapper.text()).not.toContain("Design to Template");
    expect(wrapper.text()).toContain("Template Score");
    expect(wrapper.findAll("button")).toHaveLength(1);
  });

  it("marks the active feature", () => {
    const wrapper = mountMenu({}, "ai-chat");
    const active = wrapper
      .findAll("button")
      .find((b) => b.text().includes("AI Assistant"))!;
    expect(active.attributes("style")).toContain("primary-light");
  });
});
