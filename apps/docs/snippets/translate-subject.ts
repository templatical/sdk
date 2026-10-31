import { maskTags, SYNTAX_PRESETS, unmaskTags } from "@templatical/types";
import type { TranslationProvider } from "@templatical/types";
import { createMockTranslationProvider } from "@templatical/ai-kit/testing";

// Replace the mock with the provider you pass to init({ translation }).
const translation: TranslationProvider = createMockTranslationProvider({
  translations: {
    de: { subject: '<x id="1"/>, Ihre <x id="2"/>-Bestellung ist unterwegs' },
  },
});

const subject = "{{first_name}}, your Sable order is on its way";
const masked = maskTags(subject, SYNTAX_PRESETS.liquid, "text", {
  doNotTranslate: ["Sable"],
});
const result = await translation.translate(
  {
    templateId: null,
    sourceLocale: "en",
    targetLocale: "de",
    fields: [{ id: "subject", text: masked.text, format: "text" }],
  },
  new AbortController().signal,
);
const returned = result.fields.find((field) => field.id === "subject");
const germanSubject = returned
  ? unmaskTags(returned.text, masked.tokens)
  : null;
if (germanSubject === null)
  throw new Error("The translated subject lost or changed a placeholder.");
console.log(germanSubject); // {{first_name}}, Ihre Sable-Bestellung ist unterwegs
