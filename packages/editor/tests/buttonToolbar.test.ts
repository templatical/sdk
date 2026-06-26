// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createButtonBlock } from "@templatical/types";
import type { ButtonBlock } from "@templatical/types";
import ButtonToolbar from "../src/components/toolbar/ButtonToolbar.vue";
import { mountEditor } from "./helpers/mount";

function mountIt(block: ButtonBlock) {
  return mountEditor(ButtonToolbar, {
    props: { block, fontFamilies: [{ value: "", label: "Default" }] },
  });
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
});
