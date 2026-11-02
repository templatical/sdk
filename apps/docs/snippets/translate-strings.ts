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
  createTitleBlock({
    id: "greeting",
    content: "<p>Hello {{first_name}}, welcome to Sable</p>",
  }),
);
const base = applyOperations(original, [{ op: "addLocale", locale: "de" }]);
const syntax = SYNTAX_PRESETS.liquid;
const doNotTranslate = ["Sable"];
const extracted = localeStrings(base, "de", {
  syntax,
  only: "gaps",
  doNotTranslate,
});
const json = JSON.stringify({
  sourceLocale: "en",
  targetLocale: "de",
  // With only: "gaps", only an out-of-date entry has `text`: its stored
  // translation. Move it to `previous`, as `strings export` does, so an entry
  // returned untouched can't be applied as current.
  strings: extracted.strings.map(({ text, ...field }) =>
    text === undefined ? field : { ...field, previous: text },
  ),
  tokens: extracted.tokens,
});

// Send this JSON to a translator, who sets each entry's `text`.
// Keep ids, source hashes and tokens unchanged.
const file: {
  sourceLocale: string;
  targetLocale: string;
  strings: { id: string; text?: string; sourceHash: string }[];
  tokens: Record<string, string[]>;
} = JSON.parse(json);
file.strings[0].text = '<p>Hallo <x id="1"/>, willkommen bei <x id="2"/></p>';
// Skip entries without `text`, as `strings import` does.
const translated = file.strings.flatMap(({ id, text, sourceHash }) =>
  text === undefined ? [] : [{ id, text, sourceHash }],
);
const { operations, rejected } = applyLocaleStrings(
  base,
  file.targetLocale,
  translated,
  { syntax, tokens: file.tokens, doNotTranslate },
);
if (rejected.length) throw new Error(JSON.stringify(rejected));
const content = applyOperations(base, operations);
const german = resolveLocale(content, "de");
// Save `content`: it keeps every language. `german` is the German version.
console.log(JSON.stringify(content), JSON.stringify(german));
