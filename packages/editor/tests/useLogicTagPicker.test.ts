// DOM stubs must be imported BEFORE Vue (Vue captures `document` at module load time)
import "./dom-stubs";

import { describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";
import type { LogicPair, LogicTag } from "@templatical/types";
import {
  useLogicTagPicker,
  type UseLogicTagPickerReturn,
} from "../src/composables/useLogicTagPicker";

function mountPicker(): {
  picker: UseLogicTagPickerReturn;
  unmount: () => void;
} {
  let picker: UseLogicTagPickerReturn | null = null;
  const app = createApp(
    defineComponent({
      setup() {
        picker = useLogicTagPicker();
        return () => h("div");
      },
    }),
  );
  app.mount(document.createElement("div"));
  return { picker: picker!, unmount: () => app.unmount() };
}

const tag: LogicTag = { label: "Else", value: "{% else %}" };
const pair: LogicPair = {
  label: "If VIP",
  before: "{% if vip %}",
  after: "{% endif %}",
};

describe("useLogicTagPicker", () => {
  it("initial state: closed, empty tags + pairs", () => {
    const { picker, unmount } = mountPicker();
    expect(picker.isOpen.value).toBe(false);
    expect(picker.tags.value).toEqual([]);
    expect(picker.pairs.value).toEqual([]);
    unmount();
  });

  it("open(tags, pairs) sets both and flips isOpen", () => {
    const { picker, unmount } = mountPicker();
    picker.open([tag], [pair]);
    expect(picker.isOpen.value).toBe(true);
    expect(picker.tags.value).toEqual([tag]);
    expect(picker.pairs.value).toEqual([pair]);
    unmount();
  });

  it("resolve(item) resolves the pending promise and clears state", async () => {
    const { picker, unmount } = mountPicker();
    const promise = picker.open([tag], [pair]);
    picker.resolve(pair);
    expect(await promise).toBe(pair);
    expect(picker.isOpen.value).toBe(false);
    expect(picker.tags.value).toEqual([]);
    expect(picker.pairs.value).toEqual([]);
    unmount();
  });

  it("latest-wins: a second open() resolves the first promise with null", async () => {
    const { picker, unmount } = mountPicker();
    const first = picker.open([tag], []);
    picker.open([], [pair]);
    expect(await first).toBe(null);
    expect(picker.pairs.value).toEqual([pair]);
    picker.resolve(null);
    unmount();
  });

  it("dispose while open resolves the pending promise with null", async () => {
    const { picker, unmount } = mountPicker();
    const promise = picker.open([tag], [pair]);
    unmount();
    expect(await promise).toBe(null);
  });
});
