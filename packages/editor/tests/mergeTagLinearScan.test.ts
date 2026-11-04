// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { SYNTAX_PRESETS } from "@templatical/types";
import { createApp, defineComponent, h, ref, shallowRef } from "vue";
import { useMergeTagField } from "../src/composables/useMergeTagField";
import { MERGE_TAGS_KEY, MERGE_TAG_SYNTAX_KEY } from "../src/keys";
import { splitMergeTagLabelSegments } from "../src/utils/mergeTagLabelSegments";
import { findOpenMergeTagTrigger } from "../src/utils/mergeTagTrigger";
import { mergeTagTokens } from "../src/utils/mergeTagTokens";
import {
  collectHits,
  normalizeMergeTagsInHtml,
} from "../src/utils/normalizeMergeTagMarkup";

const liquid = SYNTAX_PRESETS.liquid;
const unclosed = "{{".repeat(40_000);

function under400(run: () => void): void {
  const start = performance.now();
  run();
  expect(performance.now() - start).toBeLessThan(400);
}

describe("built-in merge-tag consumers", () => {
  it("segments a field with unclosed openers in under 400 ms", () => {
    let field: ReturnType<typeof useMergeTagField> | undefined;
    const app = createApp(
      defineComponent({
        setup() {
          field = useMergeTagField({
            modelValue: () => unclosed,
            emit: () => {},
            elementRef: ref(null),
          });
          return () => h("div");
        },
      }),
    );
    app.provide(MERGE_TAGS_KEY, shallowRef([]));
    app.provide(MERGE_TAG_SYNTAX_KEY, liquid);
    app.mount(document.createElement("div"));
    under400(() => {
      expect(field!.segments.value).toEqual([
        { type: "text", value: unclosed },
      ]);
    });
    app.unmount();
  });
  it("splits unclosed openers in under 400 ms", () => {
    under400(() => {
      expect(splitMergeTagLabelSegments(unclosed, [], liquid)).toEqual([
        { type: "text", value: unclosed },
      ]);
    });
  });

  it("checks complete tags before the caret in under 400 ms", () => {
    const value = unclosed + "\n{{done}}";
    under400(() => {
      expect(
        findOpenMergeTagTrigger(value, value.length, "{{", "}}", liquid.value),
      ).toBeNull();
    });
  });

  it("extracts raw tokens in under 400 ms", () => {
    under400(() => {
      expect(mergeTagTokens(unclosed, liquid, "text")).toEqual([]);
    });
  });
  it("extracts many complete raw tokens in under 400 ms", () => {
    under400(() => {
      expect(
        mergeTagTokens("{{x}}".repeat(50_000), liquid, "text"),
      ).toHaveLength(50_000);
    });
  });

  it("normalizes text after unclosed openers in under 400 ms", () => {
    const html = unclosed + "\n{{done}}";
    under400(() => {
      expect(normalizeMergeTagsInHtml(html, [], liquid)).toContain(
        '<span data-merge-tag="{{done}}">{{done}}</span>',
      );
    });
  });
  it("collects many nonoverlapping hits in under 400 ms", () => {
    const start = performance.now();
    const hits = collectHits("{{x}}".repeat(50_000), [], liquid);
    expect(hits).toHaveLength(50_000);
    expect(hits[0]).toEqual({
      start: 0,
      end: 5,
      attr: "data-merge-tag",
      value: "{{x}}",
      label: "{{x}}",
    });
    expect(hits.at(-1)?.start).toBe(249_995);
    expect(performance.now() - start).toBeLessThan(400);
  });
});
