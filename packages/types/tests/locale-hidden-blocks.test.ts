import { describe, expect, it } from "vitest";
import {
  applyOperations,
  defaultLocaleGaps,
  localeHiddenBlocks,
  safeClone,
  type Operation,
  type TemplateContent,
} from "../src";
const before = {
  blocks: [
    {
      id: "wrap",
      type: "wrapper",
      children: [
        {
          id: "first",
          type: "title",
          content: "Hello",
          l10n: { de: { hidden: true } },
        },
        {
          id: "section",
          type: "section",
          columns: "1",
          l10n: { de: { hidden: true } },
          children: [
            [
              {
                id: "nested",
                type: "title",
                content: "Nested",
                l10n: { de: { hidden: true } },
              },
            ],
          ],
        },
        {
          id: "last",
          type: "title",
          content: "Last",
          l10n: {
            de: {
              text: { content: { value: "Letzte", sourceHash: "00000000" } },
            },
          },
        },
      ],
    },
  ],
  settings: { locale: "en", locales: ["de"] },
} as unknown as TemplateContent;
describe("localeHiddenBlocks", () => {
  it("returns depth-first hidden ids inside wrappers and section columns without mutation", () => {
    const original = safeClone(before);
    expect(localeHiddenBlocks(before, "de")).toEqual([
      "first",
      "section",
      "nested",
    ]);
    expect(before).toEqual(original);
  });
  it.each(["en", "es"])("returns no hidden blocks for %s", (locale) =>
    expect(localeHiddenBlocks(before, locale)).toEqual([]),
  );
  it("rebases wrapper descendants and counts their gaps", () => {
    const content = safeClone(before);
    const wrapper = content.blocks[0];
    if (wrapper.type !== "wrapper") throw new Error("Expected wrapper");
    delete wrapper.children[0].l10n;
    delete wrapper.children[1].l10n;
    const section = wrapper.children[1];
    if (section.type === "section") delete section.children[0][0].l10n;
    expect(defaultLocaleGaps(content, "de")).toEqual([
      "first/content",
      "nested/content",
    ]);
    expect(
      applyOperations(content, [
        { op: "setDefaultLocale", locale: "de" } as Operation,
      ]).blocks[0],
    ).toMatchObject({
      children: [{ content: "Hello" }, {}, { content: "Letzte" }],
    });
  });
});
