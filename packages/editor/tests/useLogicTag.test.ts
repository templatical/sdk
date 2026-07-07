// DOM stubs must be imported BEFORE Vue (Vue captures `document` at module load time)
import "./dom-stubs";

import { describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, ref, type InjectionKey } from "vue";
import type { LogicPair, LogicTag } from "@templatical/types";
import { SYNTAX_PRESETS } from "@templatical/types";
import { useLogicTag, type UseLogicTagReturn } from "../src/composables/useLogicTag";
import {
  LOGIC_PAIRS_KEY,
  LOGIC_TAG_PICKER_KEY,
  LOGIC_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  ON_REQUEST_LOGIC_TAG_KEY,
} from "../src/keys";

function run(provides: [InjectionKey<unknown>, unknown][]): {
  result: UseLogicTagReturn;
  unmount: () => void;
} {
  let result: UseLogicTagReturn | null = null;
  const app = createApp(
    defineComponent({
      setup() {
        result = useLogicTag();
        return () => h("div");
      },
    }),
  );
  for (const [key, value] of provides) app.provide(key, value);
  app.mount(document.createElement("div"));
  return { result: result!, unmount: () => app.unmount() };
}

const tag: LogicTag = { label: "Else", value: "{% else %}" };
const pair: LogicPair = {
  label: "If VIP",
  before: "{% if vip %}",
  after: "{% endif %}",
};

function mockPicker(resolveWith: LogicTag | LogicPair | null) {
  return {
    isOpen: ref(false),
    tags: ref([]),
    pairs: ref([]),
    open: vi.fn().mockResolvedValue(resolveWith),
    resolve: vi.fn(),
  };
}

describe("useLogicTag", () => {
  it("canInsertLogicTag is false when no tags or pairs are configured", () => {
    const { result, unmount } = run([[LOGIC_TAGS_KEY, []], [LOGIC_PAIRS_KEY, []]]);
    expect(result.canInsertLogicTag).toBe(false);
    unmount();
  });

  it("canInsertLogicTag is true when only tags are configured", () => {
    const { result, unmount } = run([
      [LOGIC_TAGS_KEY, [tag]],
      [LOGIC_PAIRS_KEY, []],
    ]);
    expect(result.canInsertLogicTag).toBe(true);
    unmount();
  });

  it("canInsertLogicTag is true when only pairs are configured", () => {
    const { result, unmount } = run([
      [LOGIC_TAGS_KEY, []],
      [LOGIC_PAIRS_KEY, [pair]],
    ]);
    expect(result.canInsertLogicTag).toBe(true);
    unmount();
  });

  it("exposes the provided syntax preset", () => {
    const { result, unmount } = run([
      [LOGIC_TAGS_KEY, [tag]],
      [MERGE_TAG_SYNTAX_KEY, SYNTAX_PRESETS.handlebars],
    ]);
    expect(result.syntax).toBe(SYNTAX_PRESETS.handlebars);
    unmount();
  });

  it("requestLogicTag returns null when nothing is configured", async () => {
    const picker = mockPicker(pair);
    const { result, unmount } = run([
      [LOGIC_TAGS_KEY, []],
      [LOGIC_PAIRS_KEY, []],
      [LOGIC_TAG_PICKER_KEY, picker],
    ]);
    expect(await result.requestLogicTag()).toBe(null);
    expect(picker.open).not.toHaveBeenCalled();
    unmount();
  });

  it("requestLogicTag opens the picker with the configured tags + pairs", async () => {
    const picker = mockPicker(pair);
    const { result, unmount } = run([
      [LOGIC_TAGS_KEY, [tag]],
      [LOGIC_PAIRS_KEY, [pair]],
      [LOGIC_TAG_PICKER_KEY, picker],
    ]);
    const chosen = await result.requestLogicTag();
    expect(picker.open).toHaveBeenCalledWith([tag], [pair]);
    expect(chosen).toBe(pair);
    expect(result.isRequesting.value).toBe(false);
    unmount();
  });

  it("canInsertLogicTag is true when only onRequest is set (no static config)", () => {
    const { result, unmount } = run([
      [LOGIC_TAGS_KEY, []],
      [LOGIC_PAIRS_KEY, []],
      [ON_REQUEST_LOGIC_TAG_KEY, () => Promise.resolve(null)],
    ]);
    expect(result.canInsertLogicTag).toBe(true);
    unmount();
  });

  it("requestLogicTag calls onRequest and takes precedence over the built-in picker", async () => {
    const picker = mockPicker(pair);
    const onRequest = vi.fn().mockResolvedValue(tag);
    const { result, unmount } = run([
      [LOGIC_TAGS_KEY, [tag]],
      [LOGIC_PAIRS_KEY, [pair]],
      [LOGIC_TAG_PICKER_KEY, picker],
      [ON_REQUEST_LOGIC_TAG_KEY, onRequest],
    ]);
    const chosen = await result.requestLogicTag();
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(picker.open).not.toHaveBeenCalled();
    expect(chosen).toBe(tag);
    unmount();
  });
});
