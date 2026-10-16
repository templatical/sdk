// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ToolbarSelect from "../src/components/toolbar/ToolbarSelect.vue";

/**
 * Imported or pasted text can carry a value the presets don't offer. The
 * select lists it first, so it shows what's applied instead of going blank.
 */

const SIZES = ["14px", "16px"];
const SPACING = [
  { label: "Normal", value: "normal" },
  { label: "1px", value: "1px" },
];

function render(
  modelValue: string,
  options: readonly (string | { value: string; label: string })[] = SIZES,
) {
  const wrapper = mount(ToolbarSelect, {
    props: { modelValue, options, label: "Size", placeholder: "Default" },
  });
  const select = wrapper.find("select").element as HTMLSelectElement;
  const optionEls = Array.from(select.options);
  return {
    wrapper,
    bound: select.value,
    options: optionEls.map((o) => [o.value, o.text.trim()]),
  };
}

describe("ToolbarSelect with a value its options don't list", () => {
  it("lists the value first, after the placeholder, and binds it", () => {
    const select = render("15px");
    expect(select.bound).toBe("15px");
    expect(select.options).toEqual([
      ["", "Default"],
      ["15px", "15px"],
      ["14px", "14px"],
      ["16px", "16px"],
    ]);
  });

  it("does the same for labelled options", () => {
    expect(render("0.8px", SPACING).options).toEqual([
      ["", "Default"],
      ["0.8px", "0.8px"],
      ["normal", "Normal"],
      ["1px", "1px"],
    ]);
  });

  it("leaves a listed value's options alone", () => {
    expect(render("16px").options).toEqual([
      ["", "Default"],
      ["14px", "14px"],
      ["16px", "16px"],
    ]);
    expect(render("1px", SPACING).options).toHaveLength(3);
  });

  it("shows the placeholder for no value or a CSS-wide keyword", () => {
    for (const value of ["", "inherit", "revert-layer"]) {
      const select = render(value);
      expect(select.bound).toBe("");
      expect(select.options).toHaveLength(3);
    }
  });

  it("emits the option chosen instead", async () => {
    const select = render("15px");
    await select.wrapper.find("select").setValue("16px");
    expect(select.wrapper.emitted("update:modelValue")).toEqual([["16px"]]);
  });
});
