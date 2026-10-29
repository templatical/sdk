# Rules

**Consulted by:** [build.md](build.md) · [edit.md](edit.md) ·
[import.md](import.md) when refining fallback blocks
**Related:** [blocks.md](blocks.md) for the field-level shape of each type

- **Emit these block types:** `section`, `title`, `paragraph`, `image`,
  `button`, `divider`, `spacer`, `social`, `video`, `menu`, `table`, `html`.
  Prefer native blocks — reach for `html` only when nothing else fits, since raw
  HTML is not visually editable afterward.
- **Never emit `countdown`, `custom`, `slot`, or `wrapper` blocks** (even though
  the schema allows them): `countdown` needs the Templatical **Cloud** backend to
  render its animated GIF — the open-source renderer can't, so it would break —
  and `custom` blocks are consumer-registered runtime extensions that can't be
  produced from a prompt. `slot` and `wrapper` are layout markers, not campaign
  blocks. If the user asks for a countdown, say it's a Cloud feature and offer a
  static stand-in instead — a `title`/`paragraph` with the date/time, or a "X days
  to go" line (optionally a `{{merge_tag}}`).
- **A shell around the email is `init({ layout })`, not more blocks.**
  View-in-browser, an imprint or legal footer, a company address, an
  unsubscribe line, a mat, or a card around the message are platform chrome.
  Hand back a layout document — one `slot`, and a `wrapper` around that slot
  when they asked for a card, with `sectionWrapper: false` — and point at
  [integrate.md](integrate.md). Do not put `slot` or `wrapper` in the campaign
  template. Do not edit the CLI, the live harness, or the docs to make a
  preview render the shell. Live mode's page calls `init()` with the working
  template only, so say plainly that this live preview will not show it.
- **Every block needs** `id` (unique, e.g. `"title_1"`), `type`, and
  `styles.padding` (`{ top, right, bottom, left }` in px). Element ids inside
  blocks (menu `items[].id`, social `icons[].id`, table `rows[].id` and
  `rows[].cells[].id`) are path segments in language versions, so
  these ids must not contain `.` or `/`: validation refuses them. Use ids like
  `nav-shop`.
- **Structure content in sections.** A `section` has `children`: an array of
  columns, each column an array of blocks. `columns` is `"1"`, `"2"`, `"3"`,
  `"2-1"`, or `"1-2"`, and the column count in `children` must match. Don't nest
  a section inside another section — MJML has no equivalent, so the renderer
  drops it on export.
- **Rich text** (`title.content`, `paragraph.content`) is HTML — use inline tags
  (`<b>`, `<i>`, `<a href>`, `<br>`, `<ul>`). Use blocks, not HTML, for layout.
  **Table cell `content` is the exception — plain text, no inline HTML** (tags
  render literally); for emphasis use `hasHeaderRow`, or a 2-column `section` of
  `paragraph` blocks for a label/value layout.
- **Merge tags** for personalization default to Liquid
  `{{contact.field_name}}` (e.g. `{{contact.first_name}}`). If the brief or an
  existing template uses another dialect the SDK ships — Handlebars
  `{{first_name}}`, Mailchimp `*|FNAME|*`, AMPScript `%%=first_name=%%` —
  emit that dialect instead, and do not mix dialects in one template. They're
  substituted when the email is sent.
- **No extra fields** — the schema rejects unknown properties. If unsure a field
  exists, check `reference/schema.json`.
- **Colors** are hex strings (`"#4CBB17"`). **Images**: use a real URL when
  given, else a placeholder like `https://placehold.co/600x300`, and always write
  meaningful `alt` text.
- **Use destination URLs, not shortened links.** `deliverability.url-shortener`
  warns on hosts such as `bit.ly`; link directly to the destination.
- **Keep address-shaped link text aligned with its destination.**
  `deliverability.link-text-domain-mismatch` warns when a link label shows a
  different site. Prefer descriptive words. An address as the whole label is
  acceptable when it is the link's own URL, such as a copy-link fallback.
- **Use domain names in links, not raw IP addresses.**
  `deliverability.ip-address-url` warns on public and private IP links.
- **Carry the message in text when images lead the email.**
  `deliverability.low-text` checks for at least 200 visible characters when
  an image, video, or countdown is present. Add real text readers can use when
  images are blocked.
- **Settings** must include `width` (usually `600`), `backgroundColor`,
  `textColor`, `fontFamily`, `linkUnderline`, and `locale` (BCP-47, e.g. `"en"`).
  Set `locale` to **the language of the copy you are writing**, not to `"en"`
  by default — it becomes `<html lang>` in the delivered email, so a German
  message labelled `"en"` is mispronounced by every screen reader that opens
  it. Match the copy: English `"en"`, German `"de"`, Brazilian Portuguese
  `"pt-BR"`. For Arabic, Hebrew, Persian, Urdu
  and other RTL copy, also set `direction: "rtl"` (or omit it — those locales
  resolve as RTL). That value is the canvas `dir` and the exported
  `<mjml dir>`.

## Pass-through HTML and CSS

HTML blocks, title and paragraph rich text, and table-cell content pass through MJML. Build layout with native sections and columns or presentation tables. In pass-through content, avoid `display:flex` (`compat.css-display-flex`), grid (`compat.css-display-grid`), absolute/fixed/sticky positioning (`compat.css-position`), CSS variables (`compat.css-variables`), `@import` (`compat.css-at-import`), external stylesheets (`compat.html-link`), and body `<style>` tags (`compat.html-style`). Prefer style attributes and table-safe widths (`compat.css-width`, `compat.css-max-width`) over `float` (`compat.css-float`). Give background images a readable fallback color (`compat.css-background-image`).

Use hosted PNG/JPEG images instead of inline `<svg>` (`compat.html-svg`) or base64 image URLs (`compat.image-base64`). Link to a web form or media page rather than embedding `<form>` (`compat.html-form`), `<object>` (`compat.html-object`), `<video>` (`compat.html-video`), or `<audio>` (`compat.html-audio`). Do not embed `<script>` (`compat.html-script`) or `<iframe>` (`compat.html-iframe`). Check the [caniemail support tables](https://www.caniemail.com/) and the [compatibility catalog](https://docs.templatical.com/quality/compatibility/rule-catalog) for affected clients. Compiled HTML over 90 KiB triggers `compat.gmail-clipping`; shorten the message before send.

## Language versions

Check a template language with `validate <file> --locale <tag>` and render it with `render <file> --locale <tag>`. Both default to `settings.locale`; an unknown language prints `unknown_locale` and exits 1. A missing `--locale` value exits 2.

- `localization.untranslated` warns per missing text field; rendering falls back to the default language, and this warning alone exits 0.
- `localization.stale` warns per translation whose `sourceHash` no longer matches the default text; this warning alone exits 0.
- `localization.merge-tags-differ` warns when a translation's merge-tag multiset differs from the default text; `validate` exits 1 even though the issue is a warning.

In a template with `settings.locales`, `settings.locale` changes only through the `setDefaultLocale` operation ([edit.md](edit.md)); `updateSettings` refuses it. Write a version's text with locale operations or `strings import` ([localize.md](localize.md)).
