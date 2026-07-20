// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import {
  createParagraphBlock,
  createSectionBlock,
} from "@templatical/types";
import SectionToolbar from "../src/components/toolbar/SectionToolbar.vue";
import { TRANSLATIONS_KEY } from "../src/keys";
import en from "../src/i18n/locales/en";

function mountToolbar(block: ReturnType<typeof createSectionBlock>) {
  return mount(SectionToolbar, {
    props: { block },
    global: {
      // Real en translations so every label the toolbar (and its children)
      // references resolves — no hand-maintained stub to drift.
      provide: {
        [TRANSLATIONS_KEY as symbol]: en,
      },
      // The wrapper controls mount ColorPicker + SpacingControl; stub them so
      // these tests exercise SectionToolbar's own logic, not their internals.
      stubs: {
        ColorPicker: true,
        SpacingControl: true,
      },
    },
  });
}

describe("SectionToolbar columns change", () => {
  it("emits both columns and rebalanced children when growing 1 → 2", async () => {
    const section = createSectionBlock();
    section.columns = "1";
    const a = createParagraphBlock();
    section.children = [[a]];

    const wrapper = mountToolbar(section);
    await wrapper.find("select").setValue("2");

    const emits = wrapper.emitted("update");
    expect(emits).toHaveLength(1);
    const payload = emits![0][0] as { columns: string; children: unknown[][] };
    expect(payload.columns).toBe("2");
    expect(payload.children).toHaveLength(2);
    expect(payload.children[0]).toEqual([a]);
    expect(payload.children[1]).toEqual([]);
  });

  it("merges trailing column blocks into the last kept column when shrinking 2 → 1", async () => {
    const section = createSectionBlock();
    section.columns = "2";
    const a = createParagraphBlock();
    const b = createParagraphBlock();
    section.children = [[a], [b]];

    const wrapper = mountToolbar(section);
    await wrapper.find("select").setValue("1");

    const payload = wrapper.emitted("update")![0][0] as {
      columns: string;
      children: unknown[][];
    };
    expect(payload.columns).toBe("1");
    expect(payload.children).toHaveLength(1);
    expect(payload.children[0]).toEqual([a, b]);
  });

  it("emits 2 columns for both '1-2' and '2-1' layouts", async () => {
    const section = createSectionBlock();
    section.columns = "1";
    section.children = [[]];

    const wrapper = mountToolbar(section);
    await wrapper.find("select").setValue("1-2");
    const first = wrapper.emitted("update")![0][0] as {
      columns: string;
      children: unknown[][];
    };
    expect(first.columns).toBe("1-2");
    expect(first.children).toHaveLength(2);

    await wrapper.find("select").setValue("2-1");
    const second = wrapper.emitted("update")![1][0] as {
      columns: string;
      children: unknown[][];
    };
    expect(second.columns).toBe("2-1");
    expect(second.children).toHaveLength(2);
  });

  it("renders the current columns value as selected option", () => {
    const section = createSectionBlock();
    section.columns = "3";
    section.children = [[], [], []];

    const wrapper = mountToolbar(section);
    expect((wrapper.find("select").element as HTMLSelectElement).value).toBe(
      "3",
    );
  });
});

describe("SectionToolbar border radius", () => {
  it("shows 0 when borderRadius is unset", () => {
    const wrapper = mountToolbar(createSectionBlock());
    const input = wrapper.find('input[type="number"]');
    expect((input.element as HTMLInputElement).value).toBe("0");
  });

  it("reflects an existing borderRadius", () => {
    const wrapper = mountToolbar(createSectionBlock({ borderRadius: 14 }));
    const input = wrapper.find('input[type="number"]');
    expect((input.element as HTMLInputElement).value).toBe("14");
  });

  it("emits an update with the new borderRadius on input", async () => {
    const wrapper = mountToolbar(createSectionBlock());
    await wrapper.find('input[type="number"]').setValue("20");

    const emits = wrapper.emitted("update");
    expect(emits).toHaveLength(1);
    expect(emits![0][0]).toEqual({ borderRadius: 20 });
  });
});

describe("SectionToolbar wrapper (outer frame)", () => {
  const framed = () =>
    createSectionBlock({
      wrapper: {
        backgroundColor: "#0000ff",
        padding: { top: 20, right: 20, bottom: 20, left: 20 },
      },
    });

  it("enabling the wrapper emits a default frame with padding", async () => {
    const wrapper = mountToolbar(createSectionBlock());
    const checkbox = wrapper.find('input[type="checkbox"]');
    expect((checkbox.element as HTMLInputElement).checked).toBe(false);

    await checkbox.setValue(true);

    const emits = wrapper.emitted("update");
    expect(emits).toHaveLength(1);
    expect(emits![0][0]).toEqual({
      wrapper: { padding: { top: 20, right: 20, bottom: 20, left: 20 } },
    });
  });

  it("disabling the wrapper clears it (wrapper: undefined)", async () => {
    const wrapper = mountToolbar(framed());
    const checkbox = wrapper.find('input[type="checkbox"]');
    expect((checkbox.element as HTMLInputElement).checked).toBe(true);

    await checkbox.setValue(false);

    const emits = wrapper.emitted("update");
    expect(emits).toHaveLength(1);
    expect((emits![0][0] as { wrapper?: unknown }).wrapper).toBeUndefined();
  });

  it("changing the wrapper radius merges with the existing frame", async () => {
    const wrapper = mountToolbar(framed());
    // With a wrapper present there are two number inputs:
    // [0] the section's own borderRadius, [1] the wrapper's borderRadius.
    const inputs = wrapper.findAll('input[type="number"]');
    expect(inputs).toHaveLength(2);

    await inputs[1].setValue("16");

    expect(wrapper.emitted("update")![0][0]).toEqual({
      wrapper: {
        backgroundColor: "#0000ff",
        padding: { top: 20, right: 20, bottom: 20, left: 20 },
        borderRadius: 16,
      },
    });
  });
});

describe("SectionToolbar stack-on-mobile toggle", () => {
  const twoCol = (stackOnMobile?: boolean) =>
    createSectionBlock({ columns: "2", stackOnMobile });

  // The wrapper checkbox is always present; target the stack toggle by its
  // label text so the two don't get confused.
  const stackCheckbox = (wrapper: ReturnType<typeof mountToolbar>) => {
    const label = wrapper
      .findAll("label")
      .find((l) => l.text().includes(en.section.stackOnMobile));
    return label?.find('input[type="checkbox"]');
  };

  it("is not rendered for a single-column section", () => {
    const wrapper = mountToolbar(createSectionBlock({ columns: "1" }));
    expect(stackCheckbox(wrapper)).toBeUndefined();
  });

  it("is checked by default for a multi-column section (columns stack)", () => {
    const checkbox = stackCheckbox(mountToolbar(twoCol()));
    expect((checkbox!.element as HTMLInputElement).checked).toBe(true);
  });

  it("emits stackOnMobile:false when unchecked", async () => {
    const wrapper = mountToolbar(twoCol());
    await stackCheckbox(wrapper)!.setValue(false);

    const emits = wrapper.emitted("update");
    expect(emits).toHaveLength(1);
    expect(emits![0][0]).toEqual({ stackOnMobile: false });
  });

  it("shows unchecked when opted out and re-checking emits stackOnMobile:true", async () => {
    const wrapper = mountToolbar(twoCol(false));
    const checkbox = stackCheckbox(wrapper)!;
    expect((checkbox.element as HTMLInputElement).checked).toBe(false);

    await checkbox.setValue(true);
    expect(wrapper.emitted("update")![0][0]).toEqual({ stackOnMobile: true });
  });
});
