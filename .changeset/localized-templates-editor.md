---
"@templatical/editor": minor
---

Language versions and translation in the editor

- `init({ localization: { locales, doNotTranslate? } })` turns on the **Languages** menu: add a language, make one the default or remove it. A language bar shows the version being edited, its missing and out-of-date counts, and **Translate {count} fields**, **Translate everything again…** and **Back to {default}**.
- A status badge on each block shows hidden, missing, out-of-date, differing merge tags or changed properties, with Translate, Keep, Use default and Reset actions; a localization finding in Issues jumps to it. The settings panel marks translated or overridden fields, each with its own reset.
- `init({ translation })` takes a `TranslationProvider`. Translate sends the gaps or every eligible field, masks merge tags, logic tags and `doNotTranslate` terms, applies what passes the exact check as one undo step and reports the rest. `doNotTranslate` takes at most 500 terms of 1–100 characters, and a field over the 20,000-unit request cap isn't sent.
- AI chat, Fix with AI, Rewrite and Write alt text edit the active language.
- Comments record the language they were written in and filter by it. A layout's language versions follow the selected language in preview, export and test email.
- `getLocale()` and `setLocale(locale)` read and switch the shown language (`setLocale` throws `SdkError` with code `unknown_locale` for a version the template lacks), `onLocaleChange` reports it, and `toMjml({ locale })` / `toHtml({ locale })` render a version without changing the view.

Additive and opt-in: existing templates need no migration. Keep every `@templatical/*` package on the same version. See [Localized templates](https://docs.templatical.com/guide/localized-templates) and [Translation](https://docs.templatical.com/backend/translation).
