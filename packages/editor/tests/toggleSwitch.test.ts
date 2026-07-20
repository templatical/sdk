// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ToggleSwitch from "../src/components/ToggleSwitch.vue";

const knob = (wrapper: ReturnType<typeof mount>) =>
  wrapper.get('button[role="switch"] span');

describe("ToggleSwitch", () => {
  it("reflects modelValue=true via aria-checked and knob position", () => {
    const wrapper = mount(ToggleSwitch, {
      props: { modelValue: true, label: "On" },
    });
    expect(
      wrapper.get('button[role="switch"]').attributes("aria-checked"),
    ).toBe("true");
    expect(knob(wrapper).classes()).toContain("tpl:translate-x-4");
  });

  it("reflects modelValue=false via aria-checked and knob position", () => {
    const wrapper = mount(ToggleSwitch, {
      props: { modelValue: false, label: "Off" },
    });
    expect(
      wrapper.get('button[role="switch"]').attributes("aria-checked"),
    ).toBe("false");
    expect(knob(wrapper).classes()).toContain("tpl:translate-x-0");
  });

  it("emits the inverted value on click (false → true)", async () => {
    const wrapper = mount(ToggleSwitch, {
      props: { modelValue: false, label: "x" },
    });
    await wrapper.get('button[role="switch"]').trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([[true]]);
  });

  it("emits the inverted value on click (true → false)", async () => {
    const wrapper = mount(ToggleSwitch, {
      props: { modelValue: true, label: "x" },
    });
    await wrapper.get('button[role="switch"]').trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
  });

  it("is disabled and does not emit when disabled", async () => {
    const wrapper = mount(ToggleSwitch, {
      props: { modelValue: false, label: "x", disabled: true },
    });
    const btn = wrapper.get('button[role="switch"]');
    expect(btn.attributes("disabled")).toBeDefined();
    await btn.trigger("click");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("renders the label as text and as the switch's accessible name", () => {
    const wrapper = mount(ToggleSwitch, {
      props: { modelValue: false, label: "Open in new tab" },
    });
    expect(wrapper.text()).toContain("Open in new tab");
    expect(wrapper.get('button[role="switch"]').attributes("aria-label")).toBe(
      "Open in new tab",
    );
  });

  it("renders a required marker only when required", () => {
    const off = mount(ToggleSwitch, {
      props: { modelValue: false, label: "Name" },
    });
    expect(off.text()).not.toContain("*");

    const on = mount(ToggleSwitch, {
      props: { modelValue: false, label: "Name", required: true },
    });
    expect(on.text()).toContain("*");
  });

  it("shows slot content in place of the label but keeps aria-label from the prop", () => {
    const wrapper = mount(ToggleSwitch, {
      props: { modelValue: false, label: "Decorative" },
      slots: { default: "<span>Decorative image</span>" },
    });
    expect(wrapper.text()).toContain("Decorative image");
    expect(wrapper.get('button[role="switch"]').attributes("aria-label")).toBe(
      "Decorative",
    );
  });
});
