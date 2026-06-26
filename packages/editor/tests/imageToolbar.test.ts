// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { createImageBlock } from "@templatical/types";
import type { ImageBlock } from "@templatical/types";
import ImageToolbar from "../src/components/toolbar/ImageToolbar.vue";
import { mountEditor } from "./helpers/mount";

function mountIt(block: ImageBlock) {
  return mountEditor(ImageToolbar, { props: { block } });
}

describe("ImageToolbar width control", () => {
  it("switching the width <select> to Custom seeds the default custom width", async () => {
    // block.width = 400 is a preset, so widthMode resolves to "400" and the
    // custom px input is not yet shown.
    const wrapper = mountIt(createImageBlock({ width: 400 }));
    const select = wrapper.find("select");
    expect((select.element as HTMLSelectElement).value).toBe("400");

    await select.setValue("custom");

    const [update] = wrapper.emitted("update")![0] as [Partial<ImageBlock>];
    expect(update.width).toBe(350);
  });

  it("selecting Full width emits 'full'; selecting a preset emits the number", async () => {
    const wrapper = mountIt(createImageBlock({ width: 350 }));
    const select = wrapper.find("select");

    await select.setValue("full");
    await select.setValue("300");

    const emitted = wrapper.emitted("update") as [Partial<ImageBlock>][];
    expect(emitted[0][0].width).toBe("full");
    expect(emitted[1][0].width).toBe(300);
  });

  it("typing a valid custom width commits it as a number", async () => {
    const wrapper = mountIt(createImageBlock({ width: 350 }));
    const input = wrapper.find('input[type="number"]');
    expect(input.exists()).toBe(true);

    await input.setValue("420");

    const [update] = wrapper.emitted("update")![0] as [Partial<ImageBlock>];
    expect(update.width).toBe(420);
  });

  it("clearing or zeroing the custom width input never emits width: 0 (regression #259)", async () => {
    // An empty <input type="number"> yields Number("") === 0; committing that
    // would render an invisible 0px image. The guard must drop empty / 0 /
    // negative input and keep the last valid width.
    const wrapper = mountIt(createImageBlock({ width: 350 }));
    const input = wrapper.find('input[type="number"]');

    await input.setValue(""); // cleared
    await input.setValue("0"); // explicit zero
    await input.setValue("-5"); // negative

    expect(wrapper.emitted("update")).toBeUndefined();
  });
});
