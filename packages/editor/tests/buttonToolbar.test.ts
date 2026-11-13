// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { ref } from "vue";
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createSectionBlock,
} from "@templatical/types";
import type { ButtonBlock, TemplateContent } from "@templatical/types";
import ButtonToolbar from "../src/components/toolbar/ButtonToolbar.vue";
import ColorPicker from "../src/components/ColorPicker.vue";
import { EDITOR_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };

function mountIt(block: ButtonBlock, content?: TemplateContent) {
  return mountEditor(ButtonToolbar, {
    props: { block, fontFamilies: [{ value: "", label: "Default" }] },
    ...(content
      ? { provides: { [EDITOR_KEY]: { content: ref(content) } } }
      : {}),
  });
}

/** A 600px column with no side padding, so the button's room is 600. */
function roomOf(block: ButtonBlock): TemplateContent {
  const content = createDefaultTemplateContent();
  content.settings.width = 600;
  content.blocks = [
    createSectionBlock({
      columns: "1",
      styles: { padding: ZERO },
      children: [[{ ...block, styles: { padding: ZERO } }]],
    }),
  ];
  return content;
}

// The width <select> is the one offering the "auto" option (the other
// <select> is font-family). The width px input is the only number input with
// min="20" (border-radius is min="0", font-size min="10").
function widthSelect(wrapper: ReturnType<typeof mountIt>) {
  return wrapper
    .findAll("select")
    .find((s) =>
      s.findAll("option").some((o) => o.attributes("value") === "auto"),
    )!;
}
function widthInput(wrapper: ReturnType<typeof mountIt>) {
  return wrapper.find('input[type="number"][min="20"]');
}

describe("ButtonToolbar width control", () => {
  it("defaults to Auto when width is unset and seeds the default on switch to Custom", async () => {
    const wrapper = mountIt(createButtonBlock());
    const select = widthSelect(wrapper);
    expect((select.element as HTMLSelectElement).value).toBe("auto");

    await select.setValue("custom");

    const [update] = wrapper.emitted("update")![0] as [Partial<ButtonBlock>];
    expect(update.width).toBe(200);
  });

  it("selecting Full emits 'full'; selecting Auto emits undefined", async () => {
    const wrapper = mountIt(createButtonBlock({ width: 250 }));
    const select = widthSelect(wrapper);
    expect((select.element as HTMLSelectElement).value).toBe("custom");

    await select.setValue("full");
    await select.setValue("auto");

    const emitted = wrapper.emitted("update") as [Partial<ButtonBlock>][];
    expect(emitted[0][0].width).toBe("full");
    expect(emitted[1][0].width).toBeUndefined();
  });

  it("typing a valid custom width commits it as a number", async () => {
    const wrapper = mountIt(createButtonBlock({ width: 200 }));
    const input = widthInput(wrapper);
    expect(input.exists()).toBe(true);

    await input.setValue("320");

    const [update] = wrapper.emitted("update")![0] as [Partial<ButtonBlock>];
    expect(update.width).toBe(320);
  });

  it("clearing or zeroing the custom width input never emits width: 0 (regression #260)", async () => {
    // An empty <input type="number"> yields Number("") === 0; committing that
    // would render a 0px button. The guard must drop empty / 0 / negative
    // input and keep the last valid width.
    const wrapper = mountIt(createButtonBlock({ width: 200 }));
    const input = widthInput(wrapper);

    await input.setValue(""); // cleared
    await input.setValue("0"); // explicit zero
    await input.setValue("-5"); // negative

    expect(wrapper.emitted("update")).toBeUndefined();
  });

  function unitGroup(wrapper: ReturnType<typeof mountIt>) {
    return wrapper
      .findAll('[role="radiogroup"]')
      .find((group) => group.find('[role="radio"][aria-label="px"]').exists());
  }

  it("shows the px | % control only for Custom", () => {
    expect(unitGroup(mountIt(createButtonBlock()))).toBeUndefined();
    expect(
      unitGroup(mountIt(createButtonBlock({ width: "full" }))),
    ).toBeUndefined();

    const custom = unitGroup(mountIt(createButtonBlock({ width: 200 })));
    expect(custom!.attributes("aria-label")).toBe("button.widthUnit");
    const labels = custom!
      .findAll('[role="radio"]')
      .map((radio) => radio.attributes("aria-label"));
    expect(labels).toEqual(["px", "%"]);
    expect(custom!.find('[aria-label="px"]').attributes("aria-checked")).toBe(
      "true",
    );
  });

  it("shows a stored percentage in Custom and commits an integer as N%", async () => {
    const shown = mountIt(createButtonBlock({ width: "33.33%" }));
    expect((widthSelect(shown).element as HTMLSelectElement).value).toBe(
      "custom",
    );
    const shownInput = shown.find('input[type="number"][min="1"]');
    expect((shownInput.element as HTMLInputElement).value).toBe("33.33");

    const wrapper = mountIt(createButtonBlock({ width: "50%" }));
    const input = wrapper.find('input[type="number"][min="1"]');
    await input.setValue("40");

    const [update] = wrapper.emitted("update")![0] as [Partial<ButtonBlock>];
    expect(update).toEqual({ width: "40%" });
  });

  it("shows an invalid percentage as Auto, as the canvas and email render it", () => {
    for (const width of ["150%", "abc%", "0%"] as const) {
      const wrapper = mountIt(
        createButtonBlock({ width: width as ButtonBlock["width"] }),
      );
      expect((widthSelect(wrapper).element as HTMLSelectElement).value).toBe(
        "auto",
      );
      expect(unitGroup(wrapper)).toBe(undefined);
      expect(widthInput(wrapper).exists()).toBe(false);
      expect(wrapper.find('input[type="number"][min="1"]').exists()).toBe(
        false,
      );
    }
  });

  it("drops 0 and 101 in percent mode", async () => {
    const wrapper = mountIt(createButtonBlock({ width: "40%" }));
    const input = wrapper.find('input[type="number"][min="1"]');

    await input.setValue("0");
    await input.setValue("101");

    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("drops a fractional percent instead of rewriting a stored decimal", async () => {
    const wrapper = mountIt(createButtonBlock({ width: "40%" }));
    const input = wrapper.find('input[type="number"][min="1"]');

    await input.setValue("40.5");

    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("converts px and percent through the button room", async () => {
    const pxBlock = createButtonBlock({ id: "btn", width: 240 });
    const px = mountIt(pxBlock, roomOf(pxBlock));
    await unitGroup(px)!.find('[aria-label="%"]').trigger("click");
    expect((px.emitted("update") as [Partial<ButtonBlock>][])[0][0]).toEqual({
      width: "40%",
    });

    const percentBlock = createButtonBlock({ id: "btn", width: "40%" });
    const percent = mountIt(percentBlock, roomOf(percentBlock));
    await unitGroup(percent)!.find('[aria-label="px"]').trigger("click");
    expect(
      (percent.emitted("update") as [Partial<ButtonBlock>][])[0][0],
    ).toEqual({ width: 240 });
  });

  it("does nothing when the selected unit is chosen again", async () => {
    const px = mountIt(createButtonBlock({ width: 200 }));
    await unitGroup(px)!.find('[aria-label="px"]').trigger("click");
    expect(px.emitted("update")).toBeUndefined();

    const percent = mountIt(createButtonBlock({ width: "40%" }));
    await unitGroup(percent)!.find('[aria-label="%"]').trigger("click");
    expect(percent.emitted("update")).toBeUndefined();
  });

  it("uses 50% and the default px width when the room is unknown", async () => {
    const px = mountIt(createButtonBlock({ width: 200 }));
    await unitGroup(px)!.find('[aria-label="%"]').trigger("click");
    expect((px.emitted("update") as [Partial<ButtonBlock>][])[0][0]).toEqual({
      width: "50%",
    });

    const percent = mountIt(createButtonBlock({ width: "40%" }));
    await unitGroup(percent)!.find('[aria-label="px"]').trigger("click");
    expect(
      (percent.emitted("update") as [Partial<ButtonBlock>][])[0][0],
    ).toEqual({ width: 200 });
  });
});

describe("ButtonToolbar align control", () => {
  function alignRadios(wrapper: ReturnType<typeof mountIt>) {
    const group = wrapper
      .findAll('[role="radiogroup"]')
      .find((candidate) =>
        candidate
          .findAll('[role="radio"]')
          .some((radio) =>
            radio.attributes("aria-label")?.startsWith("title.align"),
          ),
      );
    expect(group, "align control").toBeTruthy();
    return group!.findAll('[role="radio"]');
  }

  it("reflects the block's alignment", () => {
    const wrapper = mountIt(createButtonBlock({ align: "right" }));
    const checked = alignRadios(wrapper).filter(
      (r) => r.attributes("aria-checked") === "true",
    );
    expect(checked).toHaveLength(1);
    expect(checked[0].attributes("aria-label")).toBe("title.alignRight");
  });

  it("emits the picked alignment", async () => {
    const wrapper = mountIt(createButtonBlock({ align: "center" }));

    await alignRadios(wrapper)[0].trigger("click");

    const [update] = wrapper.emitted("update")![0] as [Partial<ButtonBlock>];
    expect(update.align).toBe("left");
  });

  it("shows center for a block stored without align", () => {
    // Templates predating the field must not render an empty control.
    const block = createButtonBlock();
    delete (block as { align?: unknown }).align;

    const checked = alignRadios(mountIt(block)).filter(
      (r) => r.attributes("aria-checked") === "true",
    );
    expect(checked).toHaveLength(1);
    expect(checked[0].attributes("aria-label")).toBe("title.alignCenter");
  });

  it("stays available for a full-width button", () => {
    // No visible effect at full width, but hiding it would make the control
    // appear and disappear as the width mode changes. Mirrors ImageToolbar.
    const wrapper = mountIt(createButtonBlock({ width: "full" }));
    expect(alignRadios(wrapper)).toHaveLength(3);
  });
});

describe("ButtonToolbar line height", () => {
  function lineHeightSelect(wrapper: ReturnType<typeof mountIt>) {
    return wrapper
      .findAll("select")
      .find((select) =>
        select.findAll("option").some((option) => option.attributes("value") === "1.2"),
      )!;
  }

  it("shows 1.2 when lineHeight is omitted", () => {
    const wrapper = mountIt(createButtonBlock());
    const select = lineHeightSelect(wrapper);
    expect(wrapper.text()).toContain("button.lineHeight");
    expect((select.element as HTMLSelectElement).value).toBe("1.2");
    expect(
      select.findAll("option").filter((option) => option.attributes("value") === "1.2"),
    ).toHaveLength(1);
  });

  it("stores 2 and clears 1.2", async () => {
    const wrapper = mountIt(createButtonBlock());
    const select = lineHeightSelect(wrapper);

    await select.setValue("2");
    await select.setValue("1.2");

    const emitted = wrapper.emitted("update") as [Partial<ButtonBlock>][];
    expect(emitted[0][0]).toEqual({ lineHeight: 2 });
    expect(emitted[1][0]).toEqual({ lineHeight: undefined });
  });

  it("shows a stored 1.75 as a selected extra option", () => {
    const wrapper = mountIt(createButtonBlock({ lineHeight: 1.75 }));
    const select = lineHeightSelect(wrapper);
    const values = select.findAll("option").map((option) => option.attributes("value"));
    expect(values).toContain("1.75");
    expect(values.filter((value) => value === "1.2")).toEqual(["1.2"]);
    expect((select.element as HTMLSelectElement).value).toBe("1.75");
  });
});

describe("ButtonToolbar font weight", () => {
  function weightRadios(wrapper: ReturnType<typeof mountIt>) {
    const group = wrapper
      .findAll('[role="radiogroup"]')
      .find((candidate) =>
        candidate
          .findAll('[role="radio"]')
          .some((radio) =>
            radio.attributes("aria-label")?.startsWith("button.fontWeight"),
          ),
      );
    expect(group, "font weight control").toBeTruthy();
    return group!.findAll('[role="radio"]');
  }

  it("shows Bold when the field is absent", () => {
    const wrapper = mountIt(createButtonBlock());
    expect(wrapper.text()).toContain("button.fontWeight");

    const checked = weightRadios(wrapper).filter(
      (radio) => radio.attributes("aria-checked") === "true",
    );
    expect(checked).toHaveLength(1);
    expect(checked[0].attributes("aria-label")).toBe("button.fontWeightBold");
  });

  it.each([
    ["regular", "button.fontWeightRegular"],
    ["medium", "button.fontWeightMedium"],
    ["bold", "button.fontWeightBold"],
  ] as const)("shows the stored %s weight", (fontWeight, label) => {
    const checked = weightRadios(
      mountIt(createButtonBlock({ fontWeight })),
    ).filter((radio) => radio.attributes("aria-checked") === "true");
    expect(checked).toHaveLength(1);
    expect(checked[0].attributes("aria-label")).toBe(label);
  });

  it("stores regular and medium, and clears bold so the template stays minimal", async () => {
    // Bold is what an omitted field renders. Choosing it drops the field,
    // the same way Auto drops width, instead of writing "bold" on every button.
    const wrapper = mountIt(createButtonBlock({ fontWeight: "regular" }));
    const radios = weightRadios(wrapper);

    await radios[1].trigger("click");
    await radios[2].trigger("click");

    const emitted = wrapper.emitted("update") as [Partial<ButtonBlock>][];
    expect(emitted[0][0]).toEqual({ fontWeight: "medium" });
    expect(emitted[1][0]).toEqual({ fontWeight: undefined });
  });
});

describe("ButtonToolbar color layout", () => {
  it("stacks Background and Text Color vertically rather than in a 2-col grid", () => {
    // Each ColorPicker is a 40px swatch + a hex input; half the sidebar width
    // can't fit both, so a grid-cols-2 wrapper clips the hex field. The two
    // color fields must be full-width siblings with no grid-cols-2 ancestor.
    const wrapper = mountIt(createButtonBlock());
    const pickers = wrapper.findAllComponents(ColorPicker);
    expect(pickers).toHaveLength(2);

    for (const picker of pickers) {
      let el: HTMLElement | null = picker.element as HTMLElement;
      while (el && el !== document.body) {
        expect(el.className).not.toContain("grid-cols-2");
        el = el.parentElement;
      }
    }
  });
});
