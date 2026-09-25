// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { uniformBorder } from "@templatical/types";
import type { BorderSideValue, BorderValue } from "@templatical/types";
import BorderControl from "../src/components/toolbar/BorderControl.vue";
import { mountEditor } from "./helpers/mount";

const BLACK: BorderSideValue = { width: 1, style: "solid", color: "#000000" };
const NONE: BorderSideValue = { ...BLACK, width: 0 };

function mountIt(modelValue: BorderValue | undefined) {
  return mountEditor(BorderControl, {
    props: { modelValue, testidPrefix: "test" },
  });
}

type Wrapper = ReturnType<typeof mountIt>;

function lastEmitted(wrapper: Wrapper): BorderValue | undefined {
  const emitted = wrapper.emitted("update:modelValue")!;
  return emitted[emitted.length - 1][0] as BorderValue | undefined;
}

const widthInput = (wrapper: Wrapper) =>
  wrapper.find('[data-testid="test-border-width-input"]');
const linkToggle = (wrapper: Wrapper) =>
  wrapper.find('[data-testid="test-border-link"]');

const SIDE_INDEX = { Top: 0, Right: 1, Bottom: 2, Left: 3 } as const;

/**
 * Pick a side in the side selector. The mount helper stubs translations, so
 * the pills are found by position: the side selector is the first radio group
 * (the style pills after it only render once a side is drawn).
 */
async function pickSide(
  wrapper: Wrapper,
  side: keyof typeof SIDE_INDEX,
): Promise<void> {
  const radios = wrapper.findAll('button[role="radio"]');
  await radios[SIDE_INDEX[side]].trigger("click");
}

describe("BorderControl", () => {
  describe("linked (all sides)", () => {
    it("starts linked, with only the width input while there is no border", () => {
      const wrapper = mountIt(undefined);
      expect(linkToggle(wrapper).attributes("aria-pressed")).toBe("true");
      expect((widthInput(wrapper).element as HTMLInputElement).value).toBe("0");
      expect(wrapper.text()).not.toContain("Dashed");
    });

    it("fills in a solid black border on all sides the first time a width is entered", async () => {
      const wrapper = mountIt(undefined);
      await widthInput(wrapper).setValue("2");

      expect(lastEmitted(wrapper)).toEqual(
        uniformBorder({ ...BLACK, width: 2 }),
      );
    });

    it("keeps the existing style and color when the width changes", async () => {
      const wrapper = mountIt(
        uniformBorder({ width: 1, style: "dotted", color: "#ff0000" }),
      );
      await widthInput(wrapper).setValue("4");

      expect(lastEmitted(wrapper)).toEqual(
        uniformBorder({ width: 4, style: "dotted", color: "#ff0000" }),
      );
    });

    it("clears the border when the width goes to 0", async () => {
      const wrapper = mountIt(uniformBorder(BLACK));
      await widthInput(wrapper).setValue("0");

      expect(wrapper.emitted("update:modelValue")).toHaveLength(1);
      expect(lastEmitted(wrapper)).toBeUndefined();
    });
  });

  describe("unlinked (per side)", () => {
    it("opens unlinked when the stored sides differ", () => {
      const wrapper = mountIt({
        top: BLACK,
        right: NONE,
        bottom: BLACK,
        left: NONE,
      });
      expect(linkToggle(wrapper).attributes("aria-pressed")).toBe("false");
    });

    it("edits only the chosen side", async () => {
      const wrapper = mountIt(uniformBorder(BLACK));
      await linkToggle(wrapper).trigger("click");
      await pickSide(wrapper, "Bottom");
      await widthInput(wrapper).setValue("5");

      expect(lastEmitted(wrapper)).toEqual({
        top: BLACK,
        right: BLACK,
        bottom: { ...BLACK, width: 5 },
        left: BLACK,
      });
    });

    it("turns just that side off at width 0", async () => {
      const wrapper = mountIt(uniformBorder(BLACK));
      await linkToggle(wrapper).trigger("click");
      await pickSide(wrapper, "Left");
      await widthInput(wrapper).setValue("0");

      expect(lastEmitted(wrapper)).toEqual({
        top: BLACK,
        right: BLACK,
        bottom: BLACK,
        left: NONE,
      });
    });

    it("starts a side from scratch when there is no border yet", async () => {
      const wrapper = mountIt(undefined);
      await linkToggle(wrapper).trigger("click");
      await pickSide(wrapper, "Top");
      await widthInput(wrapper).setValue("3");

      expect(lastEmitted(wrapper)).toEqual({
        top: { ...BLACK, width: 3 },
        right: NONE,
        bottom: NONE,
        left: NONE,
      });
    });

    it("clears the border once no side is drawn", async () => {
      const wrapper = mountIt({
        top: BLACK,
        right: NONE,
        bottom: NONE,
        left: NONE,
      });
      await pickSide(wrapper, "Top");
      await widthInput(wrapper).setValue("0");

      expect(lastEmitted(wrapper)).toBeUndefined();
    });

    it("linking copies the side being edited to all four", async () => {
      const red: BorderSideValue = {
        width: 4,
        style: "dashed",
        color: "#ff0000",
      };
      const wrapper = mountIt({
        top: BLACK,
        right: NONE,
        bottom: red,
        left: NONE,
      });
      await pickSide(wrapper, "Bottom");
      await linkToggle(wrapper).trigger("click");

      expect(lastEmitted(wrapper)).toEqual(uniformBorder(red));
    });

    it("linking from an undrawn side copies the first drawn one", async () => {
      const wrapper = mountIt({
        top: NONE,
        right: BLACK,
        bottom: NONE,
        left: NONE,
      });
      await pickSide(wrapper, "Left");
      await linkToggle(wrapper).trigger("click");

      expect(lastEmitted(wrapper)).toEqual(uniformBorder(BLACK));
    });
  });
});
