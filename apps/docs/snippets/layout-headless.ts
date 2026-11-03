import { renderToMjml } from "@templatical/renderer";
import {
  applyLayout,
  applyOperations,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSlotBlock,
  createTitleBlock,
  resolveLocale,
  sourceHash,
  type TemplateContent,
} from "@templatical/types";

// The template and its layout each carry their own German version.
const title = createTitleBlock({ content: "Welcome" });
const email: TemplateContent = createDefaultTemplateContent("Arial", {
  locale: "en",
});
email.blocks.push(title);
const content = applyOperations(email, [
  { op: "addLocale", locale: "de" },
  {
    op: "updateBlockLocale",
    blockId: title.id,
    locale: "de",
    text: {
      content: { value: "Willkommen", sourceHash: sourceHash(title.content) },
    },
  },
]);

const footer = createParagraphBlock({ content: "<p>Legal notice</p>" });
const shell: TemplateContent = createDefaultTemplateContent("Arial", {
  locale: "en",
});
shell.blocks.push(createSlotBlock(), footer);
const layout = applyOperations(shell, [
  { op: "addLocale", locale: "de" },
  {
    op: "updateBlockLocale",
    blockId: footer.id,
    locale: "de",
    text: {
      content: {
        value: "<p>Impressum</p>",
        sourceHash: sourceHash(footer.content),
      },
    },
  },
]);

const mjml = await renderToMjml(content, { layout });
const composed = applyLayout(layout, content);

// One language version of a localized template, as renderToMjml composes it:
const germanMjml = await renderToMjml(content, { layout, locale: "de" });
const german = applyLayout(
  resolveLocale(layout, "de", { missing: "default" }),
  resolveLocale(content, "de"),
);

console.log(
  mjml.includes("Legal notice"),
  germanMjml.includes("Impressum"),
  composed.blocks.length,
  german.settings.locale,
);
