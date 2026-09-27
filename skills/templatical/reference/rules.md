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
  `styles.padding` (`{ top, right, bottom, left }` in px).
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
