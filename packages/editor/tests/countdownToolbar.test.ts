// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { createCountdownBlock } from "@templatical/types";
import CountdownToolbar from "../src/components/toolbar/CountdownToolbar.vue";
import { mountEditor } from "./helpers/mount";
import { TRANSLATIONS_KEY } from "../src/keys";
import en from "../src/i18n/locales/en";

const fonts = [{ value: "Geist", label: "Geist" }];

function mountToolbar(
  overrides: Parameters<typeof createCountdownBlock>[0] = {},
) {
  const block = createCountdownBlock(overrides);
  return mountEditor(CountdownToolbar, {
    props: { block, fontFamilies: fonts },
    provides: { [TRANSLATIONS_KEY]: en },
    global: {
      stubs: {
        ColorPicker: {
          name: "ColorPicker",
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template:
            "<button data-testid=\"color\" @click=\"$emit('update:modelValue', '#111111')\" />",
        },
        NumberWithSuffix: {
          name: "NumberWithSuffix",
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template:
            '<button data-testid="number" @click="$emit(\'update:modelValue\', 24)" />',
        },
        SlidingPillSelect: {
          name: "SlidingPillSelect",
          props: ["modelValue", "options"],
          emits: ["update:modelValue"],
          template:
            "<button data-testid=\"sep\" @click=\"$emit('update:modelValue', '-')\" />",
        },
      },
    },
  });
}

describe("CountdownToolbar", () => {
  it("writes target date, timezone, and an empty font as unset", async () => {
    const wrapper = mountToolbar({
      targetDate: "2026-12-01T12:00",
      timezone: "UTC",
      fontFamily: "Geist",
    });

    const date = wrapper.find('input[type="datetime-local"]');
    await date.setValue("2026-12-25T09:00");
    expect(wrapper.emitted("update")?.[0]?.[0]).toEqual({
      targetDate: "2026-12-25T09:00",
    });

    const selects = wrapper.findAll("select");
    await selects[0].setValue("Europe/Berlin");
    expect(wrapper.emitted("update")?.[1]?.[0]).toEqual({
      timezone: "Europe/Berlin",
    });

    await selects[1].setValue("");
    expect(wrapper.emitted("update")?.[2]?.[0]).toEqual({
      fontFamily: undefined,
    });
  });

  it("toggles a unit off", async () => {
    const wrapper = mountToolbar({ showDays: true });
    const days = wrapper.findAll('[role="switch"]')[0];
    await days.trigger("click");
    expect(wrapper.emitted("update")?.[0]?.[0]).toEqual({ showDays: false });
  });

  it("writes separator, sizes, colours, labels, expiry and hide-on-expiry", async () => {
    const wrapper = mountToolbar();

    await wrapper.get('[data-testid="sep"]').trigger("click");
    expect(wrapper.emitted("update")?.[0]?.[0]).toEqual({ separator: "-" });

    await wrapper.get('[data-testid="number"]').trigger("click");
    expect(wrapper.emitted("update")?.[1]?.[0]).toEqual({ digitFontSize: 24 });

    await wrapper.get('[data-testid="color"]').trigger("click");
    expect(wrapper.emitted("update")?.[2]?.[0]).toEqual({
      digitColor: "#111111",
    });

    const labelInput = wrapper.findAll('input[type="text"]')[0];
    await labelInput.setValue("d");
    expect(
      wrapper.emitted("update")?.some((c) => "labelDays" in (c[0] as object)),
    ).toBe(true);

    const expiry = wrapper.findAll('input[type="text"]').at(-1)!;
    await expiry.setValue("Gone");
    expect(
      wrapper
        .emitted("update")
        ?.some(
          (c) =>
            (c[0] as { expiredMessage?: string }).expiredMessage === "Gone",
        ),
    ).toBe(true);

    const url = wrapper.find('input[type="url"]');
    await url.setValue("https://cdn.example.com/done.png");
    expect(wrapper.emitted("update")?.at(-1)?.[0]).toEqual({
      expiredImageUrl: "https://cdn.example.com/done.png",
    });

    const hide = wrapper.findAll('[role="switch"]').at(-1)!;
    await hide.trigger("click");
    expect(wrapper.emitted("update")?.at(-1)?.[0]).toHaveProperty(
      "hideOnExpiry",
    );
  });
});
