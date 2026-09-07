---
"@templatical/editor": minor
"@templatical/core": minor
"@templatical/media-library": minor
---

Localize the text new blocks start with, and stop the editor's locale being
ignored by everything `Intl` formats.

**New blocks carry localized placeholder text** (#673). A Button dragged into a
German editor read "Click Here", a Paragraph "Enter your text here", and a Title
"Enter your title". Which locale a default follows depends on who the text is
for:

- **Author-facing prompts** — Title, Paragraph and Button text — follow
  `init({ locale })`. They exist to be overwritten, so they match the interface
  around them.
- **Recipient-facing text** — the video `alt`, and the countdown's unit labels
  and expired message — follows the template's own `settings.locale`, because it
  ships in the delivered email. A German-speaking author building an English
  campaign does not get German countdown labels.

`blockDefaults` wins over both, and the merge is deep, so overriding
`button.backgroundColor` keeps the translated label. With no locale configured
the defaults are byte-identical to the factory values, so nothing changes for
consumers who never set one.

**A fresh template declares the editor's language.** `init({ locale: 'de' })`
now seeds `settings.locale`, so a new template stops rendering
`<mjml lang="en">` over German copy — an accessibility defect in the delivered
email, not just the editor. A consumer's own `templateDefaults.locale` still
wins, and a malformed tag is ignored rather than emitted into a `lang`
attribute. Applies only when no `content` is supplied; supplied content owns the
language it declares.

**Absolute dates follow the editor's locale, not the browser's.** Version
history entries, saved-block tooltips, the template write-time line, and the
media library's date captions were formatted by `toLocaleString()` with no
locale, so they read in the browser's language beside fully translated chrome.
A malformed `locale` falls back instead of throwing.

**The canvas declares the content language.** Every block-rendering surface now
carries `settings.locale` as a `lang` attribute, so the browser's spellchecker
and hyphenation judge the copy by the rules of the language it is written in
rather than the host page's.

**An unusable `locale` now warns.** `init({ locale: 'gr' })` fell back to
English in silence, so a typo looked exactly like the option being ignored. It
warns once and lists the locales that would have worked, matching what
`paletteBlocks` and `colors` already do. The cloud chunk still falls back
quietly — it ships fewer locales on purpose.

`useBlockActions`' `blockDefaults` option also accepts a getter
(`BlockDefaults | (() => BlockDefaults)`), re-read on each insert so a
mid-session change to the content language reaches the next block. Passing a
plain object behaves as before.
