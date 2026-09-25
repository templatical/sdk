// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ColorPicker from "../src/components/ColorPicker.vue";
import { mountEditor } from "./helpers/mount";

const SRC = resolve(import.meta.dirname, "../src");

function read(rel: string): string {
  return readFileSync(resolve(SRC, rel), "utf8");
}

describe("transparent is a background-fill control", () => {
  it("offers the checker only when allowTransparent is set", async () => {
    const closed = mountEditor(ColorPicker, {
      props: { modelValue: "#333333" },
    });
    await closed.find("button").trigger("click");
    expect(
      closed.find('[data-testid="color-picker-transparent"]').exists(),
    ).toBe(false);

    const open = mountEditor(ColorPicker, {
      props: { modelValue: "#333333", allowTransparent: true },
    });
    await open.find("button").trigger("click");
    const chip = open.get('[data-testid="color-picker-transparent"]');
    expect(chip.attributes("aria-pressed")).toBe("false");
    await chip.trigger("click");
    expect(open.emitted("update:modelValue")?.[0]).toEqual(["transparent"]);
  });

  it("paints a stored transparent value as the checker, and clear still unsets", async () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: "transparent", allowTransparent: true },
    });
    expect(wrapper.find(".tpl-color-swatch-transparent").exists()).toBe(true);
    expect(wrapper.find(".tpl-color-swatch-empty").exists()).toBe(false);
    expect(wrapper.find("input").element).toHaveProperty(
      "value",
      "transparent",
    );

    await wrapper
      .find('button[aria-label="colorPicker.clear"]')
      .trigger("click");
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual([""]);
  });

  it("keeps a partial-alpha rgba in the field", () => {
    const wrapper = mountEditor(ColorPicker, {
      props: { modelValue: "rgba(255, 0, 0, 0.5)", allowTransparent: true },
    });
    expect(wrapper.find("input").element).toHaveProperty(
      "value",
      "rgba(255, 0, 0, 0.5)",
    );
    expect(wrapper.find(".tpl-color-swatch-transparent").exists()).toBe(false);
  });

  it("is wired to background fills and not to text or border colors", () => {
    const button = read("components/toolbar/ButtonToolbar.vue");
    const background = button.slice(
      button.indexOf("t.button.background"),
      button.indexOf("t.button.textColor"),
    );
    const text = button.slice(button.indexOf("t.button.textColor"));
    expect(background).toContain("allow-transparent");
    expect(text).not.toContain("allow-transparent");

    expect(read("components/toolbar/CommonBlockSettings.vue")).toContain(
      "allow-transparent",
    );
    expect(read("components/toolbar/SectionToolbar.vue")).toContain(
      "allow-transparent",
    );
    expect(read("components/toolbar/BorderControl.vue")).not.toContain(
      "allow-transparent",
    );
  });
});
