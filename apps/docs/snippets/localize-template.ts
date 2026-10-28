import {
  applyOperations,
  createDefaultTemplateContent,
  createTitleBlock,
  localeCoverage,
  resolveLocale,
  sourceHash,
  type TemplateContent,
} from "@templatical/types";
import { renderToMjml } from "@templatical/renderer";

const title = createTitleBlock({ content: "Welcome" });
const original: TemplateContent = createDefaultTemplateContent("Arial", {
  locale: "en",
});
original.blocks.push(title);
const content = applyOperations(original, [
  { op: "addLocale", locale: "de" },
  {
    op: "updateBlockLocale",
    blockId: title.id,
    locale: "de",
    text: {
      content: { value: "Willkommen", sourceHash: sourceHash(title.content) },
    },
  },
  { op: "updateSettingsLocale", locale: "de", set: { direction: "ltr" } },
]);
const german = resolveLocale(content, "de");
const coverage = localeCoverage(content, "de");
if (coverage.missing.length > 0 || coverage.stale.length > 0) {
  throw new Error(
    `German needs translating: ${[...coverage.missing, ...coverage.stale].join(", ")}`,
  );
}
const mjml = await renderToMjml(content, { locale: "de" });
console.log(german.settings.locale, mjml);
