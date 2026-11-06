// @vitest-environment happy-dom
import { describe, expect, it, onTestFinished } from "vitest";
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
import { expectLinear } from "./helpers/expectLinear";

const liquid = SYNTAX_PRESETS.liquid;
const unclosed = "{{".repeat(90_000);

describe("built-in merge-tag consumers", () => {
  it("advances to the current logic hit before rejecting overlapping values", () => {
    expect(
      collectHits("{{#if a}}{{#if b}}{{name}}", [], SYNTAX_PRESETS.handlebars),
    ).toEqual([
      {
        start: 0,
        end: 9,
        attr: "data-logic-merge-tag",
        value: "{{#if a}}",
        label: "IF",
      },
      {
        start: 9,
        end: 18,
        attr: "data-logic-merge-tag",
        value: "{{#if b}}",
        label: "IF",
      },
      {
        start: 18,
        end: 26,
        attr: "data-merge-tag",
        value: "{{name}}",
        label: "{{name}}",
      },
    ]);
  });

  it("skips a zero-length custom match and collects later hits", () => {
    const syntax = { value: /\[\[\w+\]\]/g, logic: /^|<if>/g };

    expect(collectHits("Hi <if> [[name]]!", [], syntax)).toEqual([
      {
        start: 3,
        end: 7,
        attr: "data-logic-merge-tag",
        value: "<if>",
        label: "<if>",
      },
      {
        start: 8,
        end: 16,
        attr: "data-merge-tag",
        value: "[[name]]",
        label: "[[name]]",
      },
    ]);
  });

  it("collects a spread preset without retrying unclosed openers", () => {
    const spread = { ...liquid, opener: "<<" };
    const text = "{{".repeat(90_000);
    expect(collectHits(text, [], spread)).toEqual([]);
    expectLinear(
      (n) => {
        const value = "{{".repeat(n);
        return () => collectHits(value, [], spread);
      },
      500,
      100,
    );
  });

  it("segments a field with unclosed openers linearly", () => {
    function segments(value: string) {
      let field: ReturnType<typeof useMergeTagField> | undefined;
      const app = createApp(
        defineComponent({
          setup() {
            field = useMergeTagField({
              modelValue: () => value,
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
      const result = field!.segments.value;
      app.unmount();
      return result;
    }
    expect(segments(unclosed)).toEqual([{ type: "text", value: unclosed }]);
    const apps: ReturnType<typeof createApp>[] = [];
    onTestFinished(() => apps.forEach((app) => app.unmount()));
    expectLinear(
      (n) => {
        const first = "{{".repeat(n);
        const model = ref(first);
        let field: ReturnType<typeof useMergeTagField> | undefined;
        const app = createApp(
          defineComponent({
            setup() {
              field = useMergeTagField({
                modelValue: () => model.value,
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
        apps.push(app);
        return () => {
          model.value = model.value === first ? first + " " : first;
          return field!.segments.value;
        };
      },
      500,
      400,
    );
  });
  it("splits unclosed openers linearly", () => {
    expect(splitMergeTagLabelSegments(unclosed, [], liquid)).toEqual([
      { type: "text", value: unclosed },
    ]);
    expectLinear(
      (n) => {
        const value = "{{".repeat(n);
        return () => splitMergeTagLabelSegments(value, [], liquid);
      },
      500,
      300,
    );
  });

  it("checks complete tags before the caret linearly", () => {
    const value = unclosed + "\n{{done}}";
    expect(
      findOpenMergeTagTrigger(value, value.length, "{{", "}}", liquid),
    ).toBeNull();
    expectLinear(
      (n) => {
        const text = "{{".repeat(n) + "\n{{done}}";
        return () =>
          findOpenMergeTagTrigger(text, text.length, "{{", "}}", liquid);
      },
      500,
      350,
    );
  });

  it("checks complete tags with a spread syntax linearly", () => {
    const spread = { ...liquid, opener: "<<" };
    const value = "{{".repeat(90_000) + "\n{{done}}";
    expect(
      findOpenMergeTagTrigger(value, value.length, "{{", "}}", spread),
    ).toBeNull();
    expectLinear(
      (n) => {
        const text = "{{".repeat(n) + "\n{{done}}";
        return () =>
          findOpenMergeTagTrigger(text, text.length, "{{", "}}", spread);
      },
      500,
      350,
    );
  });

  it("extracts raw tokens linearly", () => {
    expect(mergeTagTokens(unclosed, liquid, "text")).toEqual([]);
    expectLinear(
      (n) => {
        const value = "{{".repeat(n);
        return () => mergeTagTokens(value, liquid, "text");
      },
      500,
      350,
    );
  });
  it("extracts many complete raw tokens linearly", () => {
    expect(
      mergeTagTokens("{{x}}".repeat(110_000), liquid, "text"),
    ).toHaveLength(110_000);
    expectLinear(
      (n) => {
        const value = "{{x}}".repeat(n) + "{{".repeat(n * 4);
        return () => mergeTagTokens(value, liquid, "text");
      },
      500,
      60,
    );
  });

  it("normalizes text after unclosed openers linearly", () => {
    const html = unclosed + "\n{{done}}";
    expect(normalizeMergeTagsInHtml(html, [], liquid)).toContain(
      '<span data-merge-tag="{{done}}">{{done}}</span>',
    );
    expectLinear(
      (n) => {
        const value = "{{".repeat(n) + "\n{{done}}";
        return () => normalizeMergeTagsInHtml(value, [], liquid);
      },
      500,
      350,
    );
  });
  it("collects many nonoverlapping hits linearly", () => {
    const hits = collectHits("{{x}}".repeat(130_000), [], liquid);
    expect(hits).toHaveLength(130_000);
    expect(hits[0]).toEqual({
      start: 0,
      end: 5,
      attr: "data-merge-tag",
      value: "{{x}}",
      label: "{{x}}",
    });
    expect(hits.at(-1)?.start).toBe(649_995);
    expectLinear(
      (n) => {
        const value = "{{x}}".repeat(n);
        return () => collectHits(value, [], liquid);
      },
      500,
      80,
    );
  });
});
