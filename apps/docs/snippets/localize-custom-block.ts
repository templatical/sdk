import {
  createCustomBlock,
  createDefaultTemplateContent,
  sourceHash,
  type CustomBlockDefinition,
} from "@templatical/types";
import { validateTemplate } from "@templatical/template-tools";
import { lintTemplate } from "@templatical/quality";
import { renderToMjml } from "@templatical/renderer";
import { Liquid } from "liquidjs";

const definitions: CustomBlockDefinition[] = [
  {
    type: "promo",
    name: "Promo",
    template: "<p>{{ headline }}</p>",
    fields: [{ key: "headline", type: "text", label: "Headline" }],
  },
];
const custom = createCustomBlock(definitions[0]);
custom.fieldValues.headline = "Welcome";
custom.renderedHtml = "<p>Welcome</p>";
custom.l10n = {
  de: {
    text: {
      "fieldValues.headline": {
        value: "Willkommen",
        source: sourceHash("Welcome"),
      },
    },
  },
};
const content = createDefaultTemplateContent("Arial", { locale: "en" });
content.settings.locales = ["de"];
content.blocks = [custom];

const validation = validateTemplate(content, definitions);
if (!validation.valid) throw new Error(validation.errors.join("\n"));
const issues = lintTemplate(content, {
  customBlocks: definitions,
  contentLocale: "de",
});
const localizationIssues = issues.filter((issue) =>
  issue.ruleId.startsWith("localization."),
);
if (localizationIssues.length > 0) {
  throw new Error(localizationIssues.map((issue) => issue.message).join("\n"));
}
const engine = new Liquid();
const mjml = await renderToMjml(content, {
  locale: "de",
  async renderCustomBlock(block) {
    const definition = definitions.find(
      (entry) => entry.type === block.customType,
    );
    if (!definition)
      throw new Error(`Unknown custom block: ${block.customType}`);
    return engine.parseAndRender(definition.template, block.fieldValues);
  },
});
console.log(mjml);
