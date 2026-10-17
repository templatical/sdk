// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import {
  createBackgroundImage,
  createSectionBlock,
  createTitleBlock,
} from "@templatical/types";
import type { DisplayCondition } from "@templatical/types";
import CommonBlockSettings from "../src/components/toolbar/CommonBlockSettings.vue";
import {
  ALLOW_CUSTOM_CONDITIONS_KEY,
  DISPLAY_CONDITIONS_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import en from "../src/i18n/locales/en";
import { mountEditor } from "./helpers/mount";

const pickerStubs = {
  ColorPicker: {
    name: "ColorPicker",
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template:
      "<button data-testid=\"bg\" @click=\"$emit('update:modelValue', '#111111')\" />",
  },
  SpacingControl: {
    name: "SpacingControl",
    props: ["modelValue", "label"],
    emits: ["update:modelValue"],
    template:
      '<button data-testid="pad" @click="$emit(\'update:modelValue\', { top: 12, right: 12, bottom: 12, left: 12 })" />',
  },
};

function mountSettings(
  block: ReturnType<typeof createTitleBlock>,
  extra: {
    isFirstSection?: boolean;
    provides?: Record<symbol, unknown>;
  } = {},
) {
  return mountEditor(CommonBlockSettings, {
    props: { block, isFirstSection: extra.isFirstSection },
    provides: {
      [TRANSLATIONS_KEY]: en,
      ...(extra.provides ?? {}),
    },
    global: { stubs: pickerStubs },
  });
}

function openSection(wrapper: ReturnType<typeof mountEditor>, title: string) {
  const header = wrapper
    .findAll("button")
    .find((b) => b.text().includes(title));
  if (!header) {
    throw new Error(`section "${title}" not found`);
  }
  return header.trigger("click");
}

describe("CommonBlockSettings", () => {
  it("hides the display-condition section when none are configured", () => {
    const wrapper = mountSettings(createTitleBlock());
    expect(
      wrapper.find('[data-testid="display-condition-section"]').exists(),
    ).toBe(false);
  });

  it("skips the top rule on the first section", () => {
    const first = mountSettings(createTitleBlock(), { isFirstSection: true });
    expect(first.classes()).not.toContain("tpl:mt-4");

    const later = mountSettings(createTitleBlock());
    expect(later.classes()).toContain("tpl:mt-4");
  });

  it("writes padding through styles without dropping the rest", async () => {
    const block = createTitleBlock({
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    });
    const wrapper = mountSettings(block);

    await openSection(wrapper, "Spacing");
    await wrapper.get('[data-testid="pad"]').trigger("click");

    expect(wrapper.emitted("update")?.[0]?.[0]).toEqual({
      styles: {
        ...block.styles,
        padding: { top: 12, right: 12, bottom: 12, left: 12 },
      },
    });
  });

  it("writes background color through styles", async () => {
    const block = createTitleBlock();
    const wrapper = mountSettings(block);

    await openSection(wrapper, "Background");
    await wrapper.get('[data-testid="bg"]').trigger("click");

    expect(wrapper.emitted("update")?.[0]?.[0]).toEqual({
      styles: { ...block.styles, backgroundColor: "#111111" },
    });
  });

  it("toggles visibility independently and treats unset as shown", async () => {
    const block = createTitleBlock();
    const wrapper = mountSettings(block);

    await openSection(wrapper, "Display");
    const switches = wrapper.findAll('[role="switch"]');
    expect(switches).toHaveLength(2);
    expect(switches[0].attributes("aria-checked")).toBe("true");
    expect(switches[1].attributes("aria-checked")).toBe("true");

    await switches[0].trigger("click");
    expect(wrapper.emitted("update")?.[0]?.[0]).toEqual({
      visibility: { desktop: false, mobile: true },
    });
  });

  it("applies, groups, and clears configured display conditions", async () => {
    const vip: DisplayCondition = {
      label: "VIP",
      before: "{% if vip %}",
      after: "{% endif %}",
      group: "Audience",
      description: "Paying customers",
    };
    const trial: DisplayCondition = {
      label: "Trial",
      before: "{% if trial %}",
      after: "{% endif %}",
    };
    const block = createTitleBlock();
    const wrapper = mountSettings(block, {
      provides: {
        [DISPLAY_CONDITIONS_KEY]: [vip, trial],
      },
    });

    await openSection(wrapper, "Display Condition");
    const select = wrapper.get('[data-testid="display-condition-select"]');
    expect(wrapper.find("optgroup").attributes("label")).toBe("Audience");

    await select.setValue("VIP");
    expect(wrapper.emitted("update")?.[0]?.[0]).toEqual({
      displayCondition: vip,
    });

    await wrapper.setProps({
      block: { ...block, displayCondition: vip },
    });
    await nextTick();
    expect(wrapper.text()).toContain("Paying customers");
    expect(wrapper.text()).toContain("{% if vip %}");

    await select.setValue("");
    expect(wrapper.emitted("update")?.[1]?.[0]).toEqual({
      displayCondition: undefined,
    });
  });

  it("applies a custom condition and refuses a blank opening tag", async () => {
    const block = createTitleBlock();
    const wrapper = mountSettings(block, {
      provides: {
        [ALLOW_CUSTOM_CONDITIONS_KEY]: true,
      },
    });

    await openSection(wrapper, "Display Condition");
    const select = wrapper.get('[data-testid="display-condition-select"]');
    await select.setValue("__custom__");
    await nextTick();

    const apply = wrapper.findAll("button").find((b) => b.text() === "Apply")!;
    expect((apply.element as HTMLButtonElement).disabled).toBe(true);

    const areas = wrapper.findAll("textarea");
    await areas[0].setValue("   ");
    await apply.trigger("click");
    expect(wrapper.emitted("update")).toBeUndefined();

    await areas[0].setValue("{% if plan == 'pro' %}");
    await areas[1].setValue("{% endif %}");
    await apply.trigger("click");

    expect(wrapper.emitted("update")?.[0]?.[0]).toEqual({
      displayCondition: {
        label: "Custom condition",
        before: "{% if plan == 'pro' %}",
        after: "{% endif %}",
      },
    });
  });
});

describe("CommonBlockSettings background image", () => {
  it("offers a background image for sections", async () => {
    const section = createSectionBlock();
    const wrapper = mountEditor(CommonBlockSettings, {
      props: { block: section },
      provides: { [TRANSLATIONS_KEY]: en },
      global: { stubs: pickerStubs },
    });
    await wrapper
      .get('[data-testid="block-settings-background"]')
      .trigger("click");

    await wrapper
      .get('[data-testid="section-bg-url"] input')
      .setValue("https://cdn.test/hero.jpg");

    const emitted = wrapper.emitted("update")!;
    expect(emitted[emitted.length - 1][0]).toEqual({
      backgroundImage: createBackgroundImage("https://cdn.test/hero.jpg"),
    });
  });

  it("hides size and repeat while the section renders as a hero", async () => {
    const section = createSectionBlock({
      backgroundImage: {
        ...createBackgroundImage("https://cdn.test/hero.jpg"),
        width: 1200,
        height: 800,
      },
      hero: { height: "image", verticalAlign: "middle" },
    });
    const wrapper = mountEditor(CommonBlockSettings, {
      props: { block: section },
      provides: { [TRANSLATIONS_KEY]: en },
      global: { stubs: pickerStubs },
    });
    await wrapper
      .get('[data-testid="block-settings-background"]')
      .trigger("click");
    expect(wrapper.find('[data-testid="section-bg-size"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="section-bg-repeat"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="section-hero"]').exists()).toBe(true);
  });

  it("does not offer a background image for other blocks", async () => {
    const wrapper = mountSettings(createTitleBlock());
    await wrapper
      .get('[data-testid="block-settings-background"]')
      .trigger("click");
    expect(wrapper.find('[data-testid="section-bg-url"]').exists()).toBe(
      false,
    );
  });
});
