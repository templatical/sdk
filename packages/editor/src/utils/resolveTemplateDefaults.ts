import type { TemplateDefaults } from "@templatical/types";

/**
 * A well-formed BCP-47-ish language tag: 2–3 letter primary subtag, then
 * hyphen-separated alphanumeric subtags (`de`, `en-GB`, `pt-BR`, `zh-Hant-TW`).
 *
 * Deliberately a shape check, not a registry check — an unknown-but-well-formed
 * tag is the author's business, whereas a *malformed* one must not reach
 * `<mjml lang="…">`, which the renderer stamps from this value.
 */
const LANGUAGE_TAG = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i;

/**
 * The template defaults a new, contentless template starts from — the
 * consumer's `templateDefaults`, with the editor's `locale` filled in as the
 * content language when they did not set one.
 *
 * Without this a fresh template rendered `<mjml lang="en">` regardless of the
 * editor's language, so German copy announced itself as English to every screen
 * reader that opened the delivered email. The author can still change it
 * afterwards — Template Settings exposes it as "Content language" — so this
 * only decides the *starting* value.
 *
 * Three details are load-bearing:
 *
 *  - **The consumer wins.** `templateDefaults.locale` is spread last, so
 *    `init({ locale: "de", templateDefaults: { locale: "en" } })` means a
 *    German UI authoring English emails, which is a real setup.
 *  - **The region is kept**, unlike `loadTranslations`, which strips it to pick
 *    a bundle. `en-GB` and `pt-BR` are meaningfully not `en`/`pt` to a screen
 *    reader, and `<html lang>` is exactly where that distinction belongs.
 *  - **A malformed tag yields nothing** rather than a guess, leaving
 *    `createDefaultTemplateContent` to apply its own English fallback. Emitting
 *    it would put unvalidated config text straight into a `lang` attribute.
 *
 * Returns `undefined` when it has nothing to contribute, so the call site can
 * pass it through without inventing an empty object.
 */
export function resolveTemplateDefaults(config: {
  locale?: string;
  templateDefaults?: TemplateDefaults;
}): TemplateDefaults | undefined {
  const tag = config.locale?.trim().replace(/_/g, "-");
  const seeded = tag && LANGUAGE_TAG.test(tag) ? { locale: tag } : undefined;

  if (!seeded && !config.templateDefaults) return undefined;

  return { ...seeded, ...config.templateDefaults };
}
