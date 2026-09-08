import type { BlockDefaults } from "@templatical/types";
import type { Translations } from "../i18n";

/**
 * The placeholder text a newly inserted block starts with, in the editor's UI
 * locale — `<p>Enter your title</p>` in English, `<p>Geben Sie Ihren Titel
 * ein</p>` in German.
 *
 * These three are **author-facing prompts**: they exist to be overwritten, so
 * the editing UI's locale is the right source. Recipient-facing defaults that
 * ship in the delivered email — `video.alt`, the countdown unit labels and
 * `expiredMessage` — key off the template's own `settings.locale` instead, and
 * live in `localizedContentDefaults.ts`. Keeping the two apart is what lets a
 * German-speaking author build an English campaign without German countdown
 * labels landing in it.
 *
 * The `<p>` wrapper lives here rather than in the locale files so a translator
 * never has to keep markup intact — `TitleBlock.content` and
 * `ParagraphBlock.content` are rich-text HTML, every other field is plain.
 *
 * Merged UNDER `config.blockDefaults` by `useEditorCore`, so a consumer who
 * sets their own text still wins. The English arm is byte-identical to
 * `TITLE_BLOCK_DEFAULTS` / `PARAGRAPH_BLOCK_DEFAULTS` / `BUTTON_BLOCK_DEFAULTS`,
 * which is what keeps this invisible to consumers who never set a locale.
 */
export function localizedBlockDefaults(t: Translations): BlockDefaults {
  return {
    title: { content: `<p>${t.blockDefaults.title}</p>` },
    paragraph: { content: `<p>${t.blockDefaults.paragraph}</p>` },
    button: { text: t.blockDefaults.button },
  };
}
