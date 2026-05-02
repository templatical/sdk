import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import SlidingPillSelect from "../src/components/SlidingPillSelect.vue";

function readPillTransform(html: string): string | null {
  const match = html.match(/transform:\s*translateX\(([^)]+)\)/);
  return match ? match[1] : null;
}

describe("SlidingPillSelect", () => {
  it("does not place the pill on the first option when modelValue matches nothing", async () => {
    const { renderToString } = await import("vue/server-renderer");

    const optionsList = [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
      { value: "c", label: "C" },
    ];

    // modelValue is "x" — not present in options. The pill should NOT be
    // rendered at translateX(0%) (which is the position of option "a").
    const App = defineComponent({
      setup() {
        const value = ref("x");
        return () =>
          h(SlidingPillSelect as any, {
            options: optionsList,
            modelValue: value.value,
          });
      },
    });

    const html = await renderToString(h(App));
    const transform = readPillTransform(html);

    // Either: no pill rendered, or pill stashed off-screen.
    // What MUST NOT happen: pill at translateX(0%) — that's option "a".
    expect(transform).not.toBe("0%");
  });

  it("renders pill at the matching option's position when modelValue matches", async () => {
    const { renderToString } = await import("vue/server-renderer");

    const optionsList = [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
      { value: "c", label: "C" },
    ];

    const App = defineComponent({
      setup() {
        const value = ref("c");
        return () =>
          h(SlidingPillSelect as any, {
            options: optionsList,
            modelValue: value.value,
          });
      },
    });

    const html = await renderToString(h(App));
    expect(readPillTransform(html)).toBe("200%");
  });
});
