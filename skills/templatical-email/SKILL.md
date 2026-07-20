---
name: templatical-email
description: >-
  Generate and validate Templatical email templates as JSON (content blocks +
  settings). Use when the user wants to create, design, or draft an email
  template for the Templatical editor from a natural-language brief, or whenever
  producing or editing Templatical template JSON that must validate against the
  block schema.
---

# Templatical Email Templates

Generate and validate email templates for the [Templatical](https://templatical.com)
editor. A template is a single JSON document — an array of content **blocks** plus
global **settings** — that loads straight into the editor for a human to refine.

You (the agent) are the generator: read the brief, emit valid template JSON, then
validate it with the bundled script before handing it back. No API key or server
is involved — you are the inference.

## Setup (first run)

From this skill's folder, install the validator's one dependency:

```
npm install ajv
```

Optionally also `npm install @templatical/quality` to layer accessibility /
structure / link linting on top of structural validation.

## Workflow

1. **Understand the brief** — purpose (sale, newsletter, welcome…), audience,
   tone, brand colors/fonts, and any copy or links supplied. Ask only if a hard
   blocker is missing; otherwise choose sensible defaults.
2. **Read the references** in `reference/`:
   - `reference/schema.json` — the authoritative JSON Schema for the whole
     document. When unsure about a field, this is the source of truth.
   - `reference/block-guide.md` — a concise description of every block type and
     its fields.
   - `reference/examples/*.json` — complete, valid templates to model your
     output on.
3. **Generate the JSON** — a complete `{ "blocks": [...], "settings": {...} }`
   document, following the schema exactly (see Rules).
4. **Validate before returning** — write the JSON to a file and run:
   ```
   node scripts/validate.mjs path/to/template.json
   ```
   Fix every structural error reported and re-run until it passes. When
   `@templatical/quality` is installed, also resolve reported accessibility /
   structure / link warnings.
5. **Hand off** — return the validated JSON. The user loads it into the editor
   (`editor.setContent(json)`) and refines it there.

## Rules

- **Emit these block types:** `section`, `title`, `paragraph`, `image`,
  `button`, `divider`, `spacer`, `social`, `video`, `menu`, `table`, `countdown`,
  `html`. Prefer native blocks — reach for `html` only when nothing else fits,
  since raw HTML is not visually editable afterward. Do **not** emit `custom`
  blocks — those are consumer-registered runtime extensions and cannot be created
  from a prompt.
- **Every block needs** `id` (unique, e.g. `"title_1"`), `type`, and
  `styles.padding` (`{ top, right, bottom, left }` in px).
- **Structure content in sections.** A `section` has `children`: an array of
  columns, each column an array of blocks. `columns` is `"1"`, `"2"`, `"3"`,
  `"2-1"`, or `"1-2"`, and the column count in `children` must match. Never nest
  a section inside a section.
- **Rich text** (`title.content`, `paragraph.content`, table cell `content`) is
  HTML — use inline tags (`<b>`, `<i>`, `<a href>`, `<br>`, `<ul>`). Use blocks,
  not HTML, for layout.
- **Merge tags** for personalization use `{{contact.field_name}}` (e.g.
  `{{contact.first_name}}`); they're substituted when the email is sent.
- **No extra fields** — the schema rejects unknown properties. If unsure a field
  exists, check `reference/schema.json`.
- **Colors** are hex strings (`"#4CBB17"`). **Images**: use a real URL when
  given, else a placeholder like `https://placehold.co/600x300`, and always write
  meaningful `alt` text.
- **Settings** must include `width` (usually `600`), `backgroundColor`,
  `textColor`, `fontFamily`, `linkUnderline`, and `locale` (BCP-47, e.g. `"en"`).

## Composing with project context

Layer the user's own context **on top of** these rules — brand guidelines, a
house system prompt, tone of voice, preferred fonts/palette, a mandatory
footer or links. When brand settings are provided, use them for colors, fonts,
and copy voice instead of generic defaults. This skill defines the _format_; the
user's context defines the _taste_.

## Design defaults (when the brief is thin)

- 600px width, generous side padding (~24px), clear hierarchy (one lead
  title, supporting paragraphs).
- One primary call-to-action button with a high-contrast background.
- Readable body text (14–16px), sufficient contrast, alt text on every image.
- A footer section (divider + social/menu + an unsubscribe line) for anything
  campaign-like.
