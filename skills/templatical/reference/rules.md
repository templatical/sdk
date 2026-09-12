# Rules

**Consulted by:** [build.md](build.md) · [edit.md](edit.md) ·
[import.md](import.md) when refining fallback blocks
**Related:** [blocks.md](blocks.md) for the field-level shape of each type

- **Emit these block types:** `section`, `title`, `paragraph`, `image`,
  `button`, `divider`, `spacer`, `social`, `video`, `menu`, `table`, `html`.
  Prefer native blocks — reach for `html` only when nothing else fits, since raw
  HTML is not visually editable afterward.
- **Never emit `countdown` or `custom` blocks** (even though the schema allows
  them): `countdown` needs the Templatical **Cloud** backend to render its
  animated GIF — the open-source renderer can't, so it would break — and `custom`
  blocks are consumer-registered runtime extensions that can't be produced from a
  prompt. If the user asks for a countdown, say it's a Cloud feature and offer a
  static stand-in instead — a `title`/`paragraph` with the date/time, or a "X days
  to go" line (optionally a `{{merge_tag}}`).
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
- **Merge tags** for personalization use `{{contact.field_name}}` (e.g.
  `{{contact.first_name}}`); they're substituted when the email is sent.
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
  it. The examples are English, so they all read `"en"`; a German email needs
  `"de"`, Brazilian Portuguese `"pt-BR"`. For Arabic, Hebrew, Persian, Urdu
  and other RTL copy, also set `direction: "rtl"` (or omit it — those locales
  resolve as RTL). That value is the canvas `dir` and the exported
  `<mjml dir>`.
