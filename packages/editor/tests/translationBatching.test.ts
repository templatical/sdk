// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { effectScope } from "vue";
import { useEditor, useHistory } from "@templatical/core";
import {
  createDefaultTemplateContent,
  createMenuBlock,
  SYNTAX_PRESETS,
  TRANSLATION_MAX_CHARS,
  TRANSLATION_MAX_FIELDS,
  type TranslationRequest,
} from "@templatical/types";
import { useTranslationFeature } from "../src/composables/useTranslationFeature";

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

/** 300 menus with two items each: 600 German gaps of `length` characters. */
function menus(length: number) {
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de"];
  content.blocks = Array.from({ length: 300 }, (_, i) =>
    createMenuBlock({
      id: `m${i}`,
      items: ["a", "b"].map((item) => ({
        id: item,
        text: `${i}${item} `.padEnd(length, "x"),
        url: "https://example.com",
        openInNewTab: false,
        bold: false,
        underline: false,
      })),
    }),
  );
  return content;
}

function translateGerman(length: number) {
  const requests: TranslationRequest[] = [];
  const scope = effectScope();
  cleanups.push(() => scope.stop());
  const feature = scope.run(() => {
    const editor = useEditor({
      content: menus(length),
      localization: { locales: ["de"] },
    });
    editor.setActiveLocale("de");
    const history = useHistory({
      content: editor.content,
      setContent: editor.setContent,
    });
    cleanups.push(history.destroy);
    return useTranslationFeature({
      provider: {
        translate: async (request) => {
          requests.push(request);
          return {
            fields: request.fields.map(({ id, text }) => ({
              id,
              text: `DE ${text}`,
            })),
          };
        },
      },
      editor,
      localization: { locales: ["de"] },
      history: () => history,
      syntax: () => SYNTAX_PRESETS.liquid,
      definitions: () => [],
    });
  })!;
  return { feature, requests };
}

describe("translation batching", () => {
  it.each([
    { length: 12, perCall: 50 },
    { length: 450, perCall: 44 },
  ])(
    "sends 600 fields of $length characters in the fewest calls of at most 50 fields and 20,000 characters",
    async ({ length, perCall }) => {
      const { feature, requests } = translateGerman(length);
      expect(feature.counts.value).toEqual({ gaps: 600, all: 600 });

      const result = await feature.translate({ only: "gaps" });

      expect(result.translated).toBe(600);
      expect(perCall).toBe(
        Math.min(
          TRANSLATION_MAX_FIELDS,
          Math.floor(TRANSLATION_MAX_CHARS / length),
        ),
      );
      expect(requests).toHaveLength(Math.ceil(600 / perCall));
      for (const request of requests) {
        expect(request.fields.length).toBeLessThanOrEqual(50);
        expect(
          request.fields.reduce((sum, field) => sum + field.text.length, 0),
        ).toBeLessThanOrEqual(20_000);
      }
      expect(requests.map((request) => request.fields.length)).toEqual([
        ...Array<number>(requests.length - 1).fill(perCall),
        600 - perCall * (requests.length - 1),
      ]);
      expect(
        requests.flatMap((request) => request.fields.map(({ id }) => id)),
      ).toEqual(
        Array.from({ length: 300 }, (_, i) => [
          `m${i}/items.a.text`,
          `m${i}/items.b.text`,
        ]).flat(),
      );
      expect(feature.counts.value).toEqual({ gaps: 0, all: 600 });
    },
  );
});
