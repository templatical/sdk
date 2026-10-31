import { expect, it } from "vitest";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSlotBlock,
  createWrapperBlock,
  sourceHash,
} from "@templatical/types";
import { renderToMjml } from "../src";

it.each([
  ["de", "Abmelden"],
  ["fr", "Unsubscribe"],
  [undefined, "Unsubscribe"],
])("renders the layout for locale %s", async (locale, expected) => {
  const content = createDefaultTemplateContent(undefined, { locale: "en" });
  content.settings.locales = ["de", "fr"];
  content.blocks = [createParagraphBlock({ content: "Body" })];
  const layout = createDefaultTemplateContent(undefined, { locale: "en" });
  layout.settings.locales = ["de"];
  layout.blocks = [
    createWrapperBlock({
      children: [
        createSlotBlock(),
        createParagraphBlock({
          content: "Unsubscribe",
          l10n: {
            de: {
              text: {
                content: {
                  value: "Abmelden",
                  sourceHash: sourceHash("Unsubscribe"),
                },
              },
            },
          },
        }),
      ],
    }),
  ];
  const before = JSON.stringify({ content, layout });
  const mjml = await renderToMjml(content, { layout, locale });
  expect(mjml).toContain(expected);
  expect(mjml).not.toContain(
    expected === "Abmelden" ? "Unsubscribe" : "Abmelden",
  );
  expect(mjml).not.toContain("l10n");
  expect(JSON.stringify({ content, layout })).toBe(before);
});
