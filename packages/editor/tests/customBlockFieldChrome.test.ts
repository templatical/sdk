// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { CustomBlockRepeatableField } from "@templatical/types";

import FieldWrapper from "../src/components/toolbar/fields/FieldWrapper.vue";
import RepeatableField from "../src/components/toolbar/fields/RepeatableField.vue";
import { mountEditor } from "./helpers/mount";
import { TRANSLATIONS_KEY } from "../src/keys";
import en from "../src/i18n/locales/en";
import fr from "../src/i18n/locales/fr";

/**
 * Two pieces of custom-block field chrome whose strings were translated in
 * seven locales and rendered nowhere.
 *
 * Both are the same defect as `image.placeholderUrlTooltip`: a control exists,
 * carries no text, and the string that would explain it sits unused. That is
 * forgotten wiring, not a dead key — the distinction being whether a control is
 * actually on screen.
 */

function mountWrapper(
  props: { label: string; required?: boolean; readOnly?: boolean },
  translations: typeof en = en,
) {
  return mountEditor(FieldWrapper, {
    props,
    provides: { [TRANSLATIONS_KEY]: translations },
  });
}

function repeatable(
  overrides: Partial<CustomBlockRepeatableField> = {},
): CustomBlockRepeatableField {
  return {
    key: "items",
    label: "Items",
    type: "repeatable",
    fields: [{ key: "title", label: "Title", type: "text" }],
    ...overrides,
  } as CustomBlockRepeatableField;
}

function mountRepeatable(
  field: CustomBlockRepeatableField,
  modelValue: Record<string, unknown>[],
  translations: typeof en = en,
) {
  return mountEditor(RepeatableField, {
    props: { field, modelValue },
    provides: { [TRANSLATIONS_KEY]: translations },
  });
}

describe("FieldWrapper required indicator", () => {
  it("keeps the asterisk out of the accessibility tree and names the state instead", () => {
    const wrapper = mountWrapper({ label: "Headline", required: true });

    const glyph = wrapper.find('[aria-hidden="true"]');
    expect(glyph.text()).toBe("*");

    // The text alternative, not the glyph, is what a screen reader reaches.
    expect(wrapper.find(".tpl-sr-only").text()).toBe(
      en.customBlocks.fields.required,
    );
  });

  it("explains the asterisk on hover too", () => {
    const wrapper = mountWrapper({ label: "Headline", required: true });
    expect(wrapper.find("span[title]").attributes("title")).toBe(
      en.customBlocks.fields.required,
    );
  });

  it("translates the requirement rather than hardcoding English", () => {
    const wrapper = mountWrapper({ label: "Titre", required: true }, fr);
    expect(wrapper.find(".tpl-sr-only").text()).toBe(
      fr.customBlocks.fields.required,
    );
    expect(wrapper.text()).not.toContain(en.customBlocks.fields.required);
  });

  it("renders no indicator at all when the field is optional", () => {
    const wrapper = mountWrapper({ label: "Subtitle" });
    expect(wrapper.find(".tpl-sr-only").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("*");
  });
});

describe("RepeatableField explains both absent controls", () => {
  it("says why Add is gone once maxItems is reached", () => {
    const wrapper = mountRepeatable(repeatable({ maxItems: 1 }), [
      { title: "a" },
    ]);
    expect(wrapper.text()).toContain(en.customBlocks.fields.maxItemsReached);
  });

  it("says why Remove is gone once minItems is reached, with the count filled in", () => {
    const wrapper = mountRepeatable(repeatable({ minItems: 2 }), [
      { title: "a" },
      { title: "b" },
    ]);
    // The count is the point: an unformatted string would leave a literal
    // "{count}" on screen, which the plain-substring assertion below catches.
    expect(wrapper.text()).toContain("Minimum 2 items required");
    expect(wrapper.text()).not.toContain("{count}");
  });

  it("stays quiet while both controls are still available", () => {
    const wrapper = mountRepeatable(repeatable({ minItems: 1, maxItems: 5 }), [
      { title: "a" },
      { title: "b" },
    ]);
    expect(wrapper.text()).not.toContain(en.customBlocks.fields.maxItemsReached);
    expect(wrapper.text()).not.toContain("Minimum");
  });

  it("says both for a fixed-length list, where each explains a different control", () => {
    const wrapper = mountRepeatable(repeatable({ minItems: 2, maxItems: 2 }), [
      { title: "a" },
      { title: "b" },
    ]);
    expect(wrapper.text()).toContain(en.customBlocks.fields.maxItemsReached);
    expect(wrapper.text()).toContain("Minimum 2 items required");
  });

  it("translates the minimum message", () => {
    const wrapper = mountRepeatable(
      repeatable({ minItems: 2 }),
      [{ title: "a" }, { title: "b" }],
      fr,
    );
    expect(wrapper.text()).toContain("Minimum 2 éléments requis");
  });

  it("shows neither message in read-only mode", () => {
    const wrapper = mountEditor(RepeatableField, {
      props: {
        field: repeatable({ minItems: 2, maxItems: 2 }),
        modelValue: [{ title: "a" }, { title: "b" }],
        readOnly: true,
      },
      provides: { [TRANSLATIONS_KEY]: en },
    });
    expect(wrapper.text()).not.toContain(en.customBlocks.fields.maxItemsReached);
    expect(wrapper.text()).not.toContain("Minimum");
  });
});
