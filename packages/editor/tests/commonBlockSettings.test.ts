// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import {
  createBackgroundImage,
  createSectionBlock,
  createTitleBlock,
  resolveLocale,
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
import {
  chooseLanguage,
  languageContent,
  openLanguages,
} from "./helpers/localization";

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

  it("keeps an unchanged custom condition populated after Apply", async () => {
    const content = languageContent();
    const condition = {
      label: "Custom condition",
      before: "{% if vip %}",
      after: "{% endif %}",
    };
    content.blocks[0].displayCondition = condition;
    const { wrapper, editor } = await openLanguages({
      content,
      displayConditions: { conditions: [], allowCustom: true },
    });
    await chooseLanguage(wrapper, "de");
    editor.selectBlock("title");
    await vi.dynamicImportSettled();
    const settings = wrapper.getComponent(CommonBlockSettings);
    await settings
      .get('[data-testid="display-condition-section"]')
      .trigger("click");
    const areas = settings.findAll("textarea");
    const apply = settings.findAll("button").find((b) => b.text() === "Apply")!;

    for (const padding of ["", "  "]) {
      if (padding) {
        await areas[0].setValue(`${padding}{% if vip %}${padding}`);
        await areas[1].setValue(`${padding}{% endif %}${padding}`);
      }
      await apply.trigger("click");

      expect(
        resolveLocale(editor.content.value, "de").blocks[0].displayCondition,
      ).toEqual(condition);
      expect((areas[0].element as HTMLTextAreaElement).value).toBe(
        "{% if vip %}",
      );
      expect((areas[1].element as HTMLTextAreaElement).value).toBe(
        "{% endif %}",
      );
      expect((apply.element as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it("preserves a custom-condition draft across language-view projections and loads another block's condition", async () => {
    const content = languageContent();
    const condition = {
      label: "Custom condition",
      before: "{% if vip %}",
      after: "{% endif %}",
    };
    content.blocks[0].displayCondition = condition;
    content.blocks.push(
      createTitleBlock({
        id: "other-title",
        content: "Another title",
        displayCondition: { ...condition },
      }),
    );
    const { wrapper, editor } = await openLanguages({
      content,
      displayConditions: { conditions: [], allowCustom: true },
    });
    await chooseLanguage(wrapper, "de");
    editor.selectBlock("title");
    await vi.dynamicImportSettled();
    const settings = wrapper.getComponent(CommonBlockSettings);
    await settings
      .get('[data-testid="display-condition-section"]')
      .trigger("click");
    const areas = settings.findAll("textarea");
    expect((areas[0].element as HTMLTextAreaElement).value).toBe(
      "{% if vip %}",
    );
    await areas[0].setValue("{% if draft_vip %}");
    await areas[1].setValue("{% endif %} draft");

    editor.updateBlock("image", { alt: "Anderes Bild" });
    await nextTick();
    expect((areas[0].element as HTMLTextAreaElement).value).toBe(
      "{% if draft_vip %}",
    );
    expect((areas[1].element as HTMLTextAreaElement).value).toBe(
      "{% endif %} draft",
    );
    expect(editor.selectedBlock.value?.displayCondition).toEqual(condition);

    editor.selectBlock("other-title");
    await nextTick();
    expect((areas[0].element as HTMLTextAreaElement).value).toBe(
      "{% if vip %}",
    );
    expect((areas[1].element as HTMLTextAreaElement).value).toBe("{% endif %}");

    editor.updateBlock("other-title", {
      displayCondition: {
        ...condition,
        before: "{% if paid %}",
        after: "{% endif %} paid",
      },
    });
    await nextTick();
    expect((areas[0].element as HTMLTextAreaElement).value).toBe(
      "{% if paid %}",
    );
    expect((areas[1].element as HTMLTextAreaElement).value).toBe(
      "{% endif %} paid",
    );
  });

  it("leaves a custom draft when selecting a block with a configured condition", async () => {
    const condition = {
      label: "VIP",
      before: "{% if vip %}",
      after: "{% endif %}",
      description: "Paying customers",
    };
    const content = languageContent();
    content.blocks.push(
      createTitleBlock({
        id: "vip-title",
        content: "VIP title",
        displayCondition: condition,
      }),
    );
    const { wrapper, editor } = await openLanguages({
      content,
      displayConditions: { conditions: [condition], allowCustom: true },
    });
    await chooseLanguage(wrapper, "de");
    editor.selectBlock("title");
    await vi.dynamicImportSettled();
    const settings = wrapper.getComponent(CommonBlockSettings);
    await settings
      .get('[data-testid="display-condition-section"]')
      .trigger("click");
    await settings
      .get('[data-testid="display-condition-select"]')
      .setValue("__custom__");
    await settings.get("textarea").setValue("{% if draft %}");

    editor.selectBlock("vip-title");
    await nextTick();
    expect(
      (
        settings.get('[data-testid="display-condition-select"]')
          .element as HTMLSelectElement
      ).value,
    ).toBe("VIP");
    expect(settings.find("textarea").exists()).toBe(false);
    expect(settings.text()).toContain("Paying customers");
  });

  it("reloads the condition when another template reuses the selected block id and condition values", async () => {
    const { wrapper, editor } = await openLanguages({
      templates: {
        load: async (id) => {
          const content = languageContent();
          content.blocks[0].displayCondition = {
            label: "Custom condition",
            before: "{% if vip %}",
            after: "{% endif %}",
          };
          return { id, content };
        },
        create: false,
        save: false,
      },
      displayConditions: { conditions: [], allowCustom: true },
    });
    await editor.load("first-template");
    await chooseLanguage(wrapper, "de");
    editor.selectBlock("title");
    await vi.dynamicImportSettled();
    const settings = wrapper.getComponent(CommonBlockSettings);
    await settings
      .get('[data-testid="display-condition-section"]')
      .trigger("click");
    const areas = settings.findAll("textarea");
    await areas[0].setValue("{% if first_template_draft %}");

    await editor.load("second-template");
    await nextTick();
    expect(editor.selectedBlock.value?.id).toBe("title");
    expect((areas[0].element as HTMLTextAreaElement).value).toBe(
      "{% if vip %}",
    );
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
        naturalWidth: 1200,
        naturalHeight: 800,
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
    expect(wrapper.find('[data-testid="section-bg-size"]').exists()).toBe(
      false,
    );
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
    expect(wrapper.find('[data-testid="section-bg-url"]').exists()).toBe(false);
  });
});
