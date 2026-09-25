// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { BorderRadiusValue } from "@templatical/types";
import RadiusControl from "../src/components/toolbar/RadiusControl.vue";
import { mountEditor } from "./helpers/mount";

function mountIt(modelValue: BorderRadiusValue | undefined) {
  return mountEditor(RadiusControl, {
    props: { modelValue, label: "Radius", testidPrefix: "test" },
  });
}

type Wrapper = ReturnType<typeof mountIt>;

function lastEmitted(wrapper: Wrapper): BorderRadiusValue {
  const emitted = wrapper.emitted("update:modelValue")!;
  return emitted[emitted.length - 1][0] as BorderRadiusValue;
}

const linkToggle = (wrapper: Wrapper) =>
  wrapper.find('[data-testid="test-border-radius-link"]');
const cornerInput = (wrapper: Wrapper, corner: string) =>
  wrapper.find(`[data-testid="test-border-radius-${corner}-input"]`);

describe("RadiusControl", () => {
  it("shows one input and emits a plain number while linked", async () => {
    const wrapper = mountIt(6);
    const input = wrapper.find('[data-testid="test-border-radius-input"]');
    expect((input.element as HTMLInputElement).value).toBe("6");

    await input.setValue("10");
    expect(lastEmitted(wrapper)).toBe(10);
  });

  it("ignores a negative radius", async () => {
    const wrapper = mountIt(6);
    await wrapper
      .find('[data-testid="test-border-radius-input"]')
      .setValue("-4");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("unlinking shows a field per corner seeded from the shared radius", async () => {
    const wrapper = mountIt(6);
    await linkToggle(wrapper).trigger("click");

    for (const corner of ["topLeft", "topRight", "bottomRight", "bottomLeft"]) {
      expect(
        (cornerInput(wrapper, corner).element as HTMLInputElement).value,
      ).toBe("6");
    }
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("edits one corner at a time once unlinked", async () => {
    const wrapper = mountIt(6);
    await linkToggle(wrapper).trigger("click");
    await cornerInput(wrapper, "bottomLeft").setValue("0");

    expect(lastEmitted(wrapper)).toEqual({
      topLeft: 6,
      topRight: 6,
      bottomRight: 6,
      bottomLeft: 0,
    });
  });

  it("opens unlinked when the stored corners differ", () => {
    const wrapper = mountIt({
      topLeft: 8,
      topRight: 8,
      bottomRight: 0,
      bottomLeft: 0,
    });
    expect(linkToggle(wrapper).attributes("aria-pressed")).toBe("false");
    expect(cornerInput(wrapper, "topLeft").exists()).toBe(true);
  });

  it("linking collapses the corners to the top-left radius", async () => {
    const wrapper = mountIt({
      topLeft: 8,
      topRight: 2,
      bottomRight: 0,
      bottomLeft: 0,
    });
    await linkToggle(wrapper).trigger("click");
    expect(lastEmitted(wrapper)).toBe(8);
  });
});
