import {
  applyLocaleStrings,
  applyOperations,
  createDefaultTemplateContent,
  createTitleBlock,
  localeStrings,
  resolveLocale,
  SYNTAX_PRESETS,
} from "@templatical/types";

const original = createDefaultTemplateContent("Arial", { locale: "en" });
original.blocks.push(
  createTitleBlock({ id: "greeting", content: "<p>Hello {{first_name}}</p>" }),
);
const base = applyOperations(original, [{ op: "addLocale", locale: "de" }]);
const syntax = SYNTAX_PRESETS.liquid;
const extracted = localeStrings(base, "de", { syntax, only: "gaps" });
const json = JSON.stringify({
  sourceLocale: "en",
  targetLocale: "de",
  strings: extracted.strings.map((field) => ({
    ...field,
    text: field.text ?? "",
  })),
  tokens: extracted.tokens,
});

// Send this JSON to a translator. Keep ids, source hashes and tokens unchanged.
const file: {
  sourceLocale: string;
  targetLocale: string;
  strings: { id: string; text: string; sourceHash: string }[];
  tokens: Record<string, string[]>;
} = JSON.parse(json);
file.strings[0].text = '<p>Hallo <x id="1"/></p>';
const { operations, rejected } = applyLocaleStrings(
  base,
  file.targetLocale,
  file.strings,
  { syntax, tokens: file.tokens },
);
if (rejected.length) throw new Error(JSON.stringify(rejected));
const content = applyOperations(base, operations);
const german = resolveLocale(content, "de");
// Save `content`: it keeps every language. `german` is the German version.
console.log(JSON.stringify(content), JSON.stringify(german));
