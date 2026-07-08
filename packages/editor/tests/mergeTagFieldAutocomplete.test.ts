// @vitest-environment happy-dom
//
// End-to-end wiring test: mounts the real MergeTagInput / MergeTagTextarea via
// mountEditor and drives the actual DOM so the field's event bindings, the
// autocomplete driver, and the SHARED popup controller (the same one the
// rich-text editor uses) are all exercised together — the guarantee that the
// field and TipTap surfaces behave identically.

import { describe, expect, it, afterEach } from "vitest";
import type { MergeTag } from "@templatical/types";
import MergeTagInput from "../src/components/MergeTagInput.vue";
import MergeTagTextarea from "../src/components/MergeTagTextarea.vue";
import { mountEditor } from "./helpers/mount";
import { MERGE_TAGS_KEY, MERGE_TAG_AUTOCOMPLETE_KEY } from "../src/keys";

const TAGS: MergeTag[] = [
  { label: "First Name", value: "{{first_name}}" },
  { label: "Last Name", value: "{{last_name}}" },
];

function popup(): HTMLElement | null {
  return document.querySelector('[data-testid="merge-tag-suggestion-popup"]');
}

function optionValues(): string[] {
  return Array.from(
    document.querySelectorAll("[data-merge-tag-value]"),
  ).map((el) => el.getAttribute("data-merge-tag-value") ?? "");
}

async function type(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  input.value = value;
  input.setSelectionRange(value.length, value.length);
}

afterEach(() => {
  // The popup mounts to document.body (no popover root provided) — clear any
  // stragglers between tests.
  document.body.innerHTML = "";
});

describe("MergeTagInput autocomplete", () => {
  it("opens the shared popup with filtered tags when the trigger is typed", async () => {
    const wrapper = mountEditor(MergeTagInput, {
      props: { modelValue: "" },
      provides: { [MERGE_TAGS_KEY]: TAGS },
    });
    const input = wrapper.find("input");
    await type(input.element as HTMLInputElement, "{{fir");
    await input.trigger("input");

    expect(popup()).not.toBeNull();
    expect(optionValues()).toEqual(["{{first_name}}"]);

    wrapper.unmount();
  });

  it("inserts the selected tag on Enter and closes the popup", async () => {
    const wrapper = mountEditor(MergeTagInput, {
      props: { modelValue: "" },
      provides: { [MERGE_TAGS_KEY]: TAGS },
    });
    const input = wrapper.find("input");
    await type(input.element as HTMLInputElement, "{{fir");
    await input.trigger("input");
    expect(popup()).not.toBeNull();

    await input.trigger("keydown", { key: "Enter" });

    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).not.toBeUndefined();
    expect(emitted!.at(-1)).toEqual(["{{first_name}}"]);
    expect(popup()).toBeNull();

    wrapper.unmount();
  });

  it("navigates with ArrowDown before selecting", async () => {
    const wrapper = mountEditor(MergeTagInput, {
      props: { modelValue: "" },
      provides: { [MERGE_TAGS_KEY]: TAGS },
    });
    const input = wrapper.find("input");
    await type(input.element as HTMLInputElement, "{{");
    await input.trigger("input");
    expect(optionValues()).toEqual(["{{first_name}}", "{{last_name}}"]);

    await input.trigger("keydown", { key: "ArrowDown" });
    await input.trigger("keydown", { key: "Enter" });

    expect(
      wrapper.emitted("update:modelValue")!.at(-1),
    ).toEqual(["{{last_name}}"]);

    wrapper.unmount();
  });

  it("closes the popup on Escape without inserting", async () => {
    const wrapper = mountEditor(MergeTagInput, {
      props: { modelValue: "" },
      provides: { [MERGE_TAGS_KEY]: TAGS },
    });
    const input = wrapper.find("input");
    await type(input.element as HTMLInputElement, "{{fir");
    await input.trigger("input");
    expect(popup()).not.toBeNull();

    await input.trigger("keydown", { key: "Escape" });

    expect(popup()).toBeNull();
    // Only the input-driven emit fired; no tag was inserted.
    expect(wrapper.emitted("update:modelValue")!.at(-1)).toEqual(["{{fir"]);

    wrapper.unmount();
  });

  it("does not open when autocomplete is disabled by config", async () => {
    const wrapper = mountEditor(MergeTagInput, {
      props: { modelValue: "" },
      provides: {
        [MERGE_TAGS_KEY]: TAGS,
        [MERGE_TAG_AUTOCOMPLETE_KEY]: false,
      },
    });
    const input = wrapper.find("input");
    await type(input.element as HTMLInputElement, "{{fir");
    await input.trigger("input");

    expect(popup()).toBeNull();

    wrapper.unmount();
  });

  it("does not open when no merge tags are configured", async () => {
    const wrapper = mountEditor(MergeTagInput, {
      props: { modelValue: "" },
      provides: { [MERGE_TAGS_KEY]: [] },
    });
    const input = wrapper.find("input");
    await type(input.element as HTMLInputElement, "{{fir");
    await input.trigger("input");

    expect(popup()).toBeNull();

    wrapper.unmount();
  });
});

describe("MergeTagTextarea autocomplete", () => {
  it("opens the shared popup and inserts on Enter", async () => {
    const wrapper = mountEditor(MergeTagTextarea, {
      props: { modelValue: "" },
      provides: { [MERGE_TAGS_KEY]: TAGS },
    });
    const textarea = wrapper.find("textarea");
    await type(textarea.element as HTMLTextAreaElement, "Hi {{la");
    await textarea.trigger("input");

    expect(popup()).not.toBeNull();
    expect(optionValues()).toEqual(["{{last_name}}"]);

    await textarea.trigger("keydown", { key: "Enter" });

    expect(
      wrapper.emitted("update:modelValue")!.at(-1),
    ).toEqual(["Hi {{last_name}}"]);

    wrapper.unmount();
  });
});
