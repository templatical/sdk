# Block guide

Human-readable companion to `schema.json` (the authoritative contract). A
template is `{ "blocks": Block[], "settings": Settings }`. All sizes are pixels
and all colors are hex strings unless noted.

Each block's **Required** / **Optional** line is generated from `schema.json`;
the notes around it are hand-written. Read them together — the generated line
says what a field is typed as, the notes say what it means. In a generated line
`int` is a pixel value, a `string` named `color` / `*Color` is a hex string, a
`string` named `url` / `src` / `*Url` is an absolute URL, and a capitalised name
(`SpacingValue`, `ColumnLayout`, `MenuItemData`) is a shape or enum declared in
`schema.json` — the notes under each block spell out the ones you need.

In the `Settings` list below, a field marked _optional_ may be omitted;
everything else is required.

**Contents:** [Settings](#settings) · [Common fields](#common-block-fields) · Layout — [section](#section), [spacer](#spacer), [divider](#divider) · Text — [title](#title), [paragraph](#paragraph), [menu](#menu), [table](#table) · Media & actions — [image](#image), [button](#button), [social](#social), [video](#video) · [html](#html) · [Merge tags](#merge-tags). Complete templates that exercise the trickier blocks (wrapper cards, multi-column layouts, tables) live in [`examples/`](./examples/).

## Settings

- `width` (int) — template width, typically `600`.
- `backgroundColor` (hex) — page background behind the email body.
- `textColor` (hex) — document default text color; inherited by text blocks that
  don't set their own `color`.
- `linkColor` (hex, _optional_) — global link color; links inherit the
  surrounding text color when unset.
- `linkUnderline` (bool) — underline body links document-wide.
- `fontFamily` (string) — default font stack.
- `preheaderText` (string, _optional_) — inbox preview text; not visible in the
  body.
- `locale` (string) — BCP-47 language tag (`"en"`, `"de"`, `"fr-CA"`), drives
  `<html lang>`.
- `direction` (`"ltr"` | `"rtl"`, _optional_) — writing direction of the
  email (`<mjml dir>` and the canvas). Unset follows `locale` (`ar` / `he` /
  `fa` / `ur` / … → `"rtl"`).

## Common block fields

Every block has these, so the per-block lists below leave them out:

- `id` (string) — unique within the template, e.g. `"title_1"`.
- `type` (string) — the block type (below).
- `styles` — `{ padding: { top, right, bottom, left }, backgroundColor?: hex }`.
- `visibility` (_optional_) — `{ desktop: bool, mobile: bool }` to hide per
  device.
- `displayCondition` (_optional_) — editor-managed conditional wrapper. Never
  emit it; the editor writes it when a user adds a display condition.

Do **not** add fields beyond those listed per type — the schema rejects unknown
properties.

## Layout

### section

Container that arranges blocks into columns.

<!-- BEGIN GENERATED FIELDS: section -->
**Required** — `columns` (ColumnLayout), `children` (Block[][]).
**Optional** — `stackOnMobile` (bool), `borderRadius` (BorderRadiusValue), `border` (BorderValue), `wrapper` (SectionWrapper).
<!-- END GENERATED FIELDS: section -->

- `columns` is one of `"1"`, `"2"`, `"3"`, `"2-1"`, `"1-2"`.
- `children` is an array of columns, each an array of blocks. The column count
  must match `columns` (`"1"` → one inner array; `"2"` / `"2-1"` / `"1-2"` →
  two; `"3"` → three).
- `borderRadius` — a px number for all corners, or `{ topLeft, topRight,
  bottomRight, bottomLeft }` for a radius per corner. Omit or `0` for square.
- `border` is `{ top, right, bottom, left }`, each side `{ width, style, color }`
  — width in px (`0` leaves that side undrawn), color a hex. It draws around the
  section box. Omit it for no border.
- `style` (inside each `border` side) is one of `"solid"`, `"dashed"`, `"dotted"`.
- `stackOnMobile` — omit or `true` keeps the default responsive stacking
  (columns stack below 480px); `false` keeps them side by side.
- `wrapper` is an outer full-width band: `{ backgroundColor?, padding?,
borderRadius? }` (e.g. a white card on a colored band); its `borderRadius`
  takes the same number-or-per-corner form.

Don't nest a section inside another section — MJML has no equivalent, so the
renderer drops it on export.

### spacer

<!-- BEGIN GENERATED FIELDS: spacer -->
**Required** — `height` (int).
<!-- END GENERATED FIELDS: spacer -->

### divider

<!-- BEGIN GENERATED FIELDS: divider -->
**Required** — `lineStyle` ("solid" | "dashed" | "dotted"), `color` (string), `thickness` (int), `width` (int | "full").
<!-- END GENERATED FIELDS: divider -->

## Text

### title

<!-- BEGIN GENERATED FIELDS: title -->
**Required** — `content` (string), `level` (HeadingLevel), `textAlign` ("left" | "center" | "right").
**Optional** — `color` (string), `fontFamily` (string).
<!-- END GENERATED FIELDS: title -->

- `content` is the heading text; inline HTML is allowed.
- `level` is one of `1`, `2`, `3`, `4` — `1` is the largest.
- `color` inherits `settings.textColor` when unset.

### paragraph

<!-- BEGIN GENERATED FIELDS: paragraph -->
**Required** — `content` (string).
**Optional** — `paragraphSpacing` (int).
<!-- END GENERATED FIELDS: paragraph -->

- `content` supports `<b>`, `<i>`, `<a href>`, `<br>`, `<ul>`, `<ol>`.
- `paragraphSpacing` is the px gap between this block's paragraphs; omit for the
  default `8`. It only affects content with more than one `<p>` — space around
  the block is `styles.padding`.

### menu

Horizontal nav row of links.

<!-- BEGIN GENERATED FIELDS: menu -->
**Required** — `items` (MenuItemData[]), `fontSize` (int), `textAlign` ("left" | "center" | "right"), `separator` (string), `separatorColor` (string), `spacing` (int).
**Optional** — `fontFamily` (string), `color` (string), `linkColor` (string).
<!-- END GENERATED FIELDS: menu -->

- `items` — each is `{ id, text, url, openInNewTab: bool, bold: bool,
underline: bool, color?: hex }`.
- `separator` is the character drawn between items, e.g. `"•"`.

### table

<!-- BEGIN GENERATED FIELDS: table -->
**Required** — `rows` (TableRowData[]), `hasHeaderRow` (bool), `borderColor` (string), `borderWidth` (int), `cellPadding` (int), `fontSize` (int), `textAlign` ("left" | "center" | "right").
**Optional** — `headerBackgroundColor` (string), `fontFamily` (string), `color` (string).
<!-- END GENERATED FIELDS: table -->

- `rows` — each is `{ id, cells: [{ id, content }] }`. Cell `content` is
  **plain text — no inline HTML** (unlike `title`/`paragraph`). Inline tags render
  literally: a cell of `"<b>Weight</b>"` shows the characters `<b>Weight</b>`, not
  a bold "Weight". A cell has only `id` and `content` — there is **no per-cell or
  per-column style field**.
- `hasHeaderRow` and `headerBackgroundColor` are the **only** table emphasis.
  `hasHeaderRow: true` bolds (and, with `headerBackgroundColor`, shades) the
  **top row only**. A label/value table with a bold left column is therefore
  **not** achievable in a `table` block — for that, use a 2-column `section` of
  `paragraph` blocks (whose `content` _is_ HTML) instead.

## Media & actions

### image

<!-- BEGIN GENERATED FIELDS: image -->
**Required** — `src` (string), `alt` (string), `width` (int | "full"), `align` ("left" | "center" | "right").
**Optional** — `height` (int), `borderRadius` (BorderRadiusValue), `border` (BorderValue), `linkUrl` (string), `linkOpenInNewTab` (bool), `placeholderUrl` (string), `decorative` (bool).
<!-- END GENERATED FIELDS: image -->

- `alt` — write meaningful alt text.
- `height` — omit it: the height is then derived from the width and the image
  keeps its aspect ratio. Setting both stretches the image, because email
  clients don't support `object-fit`.
- `borderRadius` — omit or `0` for square. For a round avatar or portrait, use a
  square image and a radius of at least half its width (`999` is the usual
  shorthand). Outlook on Windows ignores it and shows square corners, so never
  rely on it for legibility. `{ topLeft, topRight, bottomRight, bottomLeft }`
  rounds each corner separately.
- `border` — `{ top, right, bottom, left }`, each side `{ width, style, color }`
  (`0` width leaves a side undrawn), drawn around the image itself and following
  its `borderRadius`. Omit it for no border.
- `style` (inside each `border` side) is one of `"solid"`, `"dashed"`, `"dotted"`.
- `decorative` — mark purely decorative images.
- `placeholderUrl` — design-time stand-in shown on the editor canvas when `src`
  is a merge tag. It never reaches the sent email; omit it unless `src` is a tag.

### button

<!-- BEGIN GENERATED FIELDS: button -->
**Required** — `text` (string), `url` (string), `backgroundColor` (string), `textColor` (string), `borderRadius` (BorderRadiusValue), `fontSize` (int), `buttonPadding` (SpacingValue), `align` ("left" | "center" | "right").
**Optional** — `openInNewTab` (bool), `border` (BorderValue), `fontFamily` (string), `width` (int | "full").
<!-- END GENERATED FIELDS: button -->

- `buttonPadding` is `{ top, right, bottom, left }`.
- `borderRadius` — a px number, or `{ topLeft, topRight, bottomRight,
  bottomLeft }` for a radius per corner.
- `border` — `{ top, right, bottom, left }`, each side `{ width, style, color }`
  (`0` width leaves a side undrawn), drawn around the button. With a
  `backgroundColor` of `"transparent"` (the keyword; `""` and `"none"` don't
  work) it makes an outline (ghost) button — set `textColor` too, since a new
  button is `#333333` with white text.
- `style` (inside each `border` side) is one of `"solid"`, `"dashed"`, `"dotted"`.
- `align` places the button within its column; no visible effect when `width` is
  `"full"`.

### social

<!-- BEGIN GENERATED FIELDS: social -->
**Required** — `icons` (SocialIcon[]), `iconStyle` (SocialIconStyle), `iconSize` (SocialIconSize), `spacing` (int), `align` ("left" | "center" | "right").
<!-- END GENERATED FIELDS: social -->

- `icons` — each is `{ id, platform, url }`.
- `platform` is one of: `facebook`, `twitter`, `instagram`, `linkedin`,
  `youtube`, `tiktok`, `pinterest`, `email`, `whatsapp`, `telegram`, `discord`,
  `snapchat`, `reddit`, `github`, `dribbble`, `behance`, `website`.
- `iconStyle` is one of `"solid"`, `"outlined"`, `"rounded"`, `"square"`,
  `"circle"`.
- `iconSize` is one of `"small"`, `"medium"`, `"large"`.

### video

Renders as a thumbnail with a play button linking to the video.

<!-- BEGIN GENERATED FIELDS: video -->
**Required** — `url` (string), `thumbnailUrl` (string), `alt` (string), `width` (int | "full"), `align` ("left" | "center" | "right").
**Optional** — `openInNewTab` (bool), `height` (int), `placeholderUrl` (string).
<!-- END GENERATED FIELDS: video -->

- `height` — same aspect-ratio caveat as `image`.
- `placeholderUrl` — design-time stand-in for the thumbnail, shown on the editor
  canvas when `url` or `thumbnailUrl` is a merge tag. It never reaches the sent
  email.

### html

Raw-HTML escape hatch. Prefer native blocks — `html` content is not visually
editable in the editor afterward, so use it only when no other block fits.

<!-- BEGIN GENERATED FIELDS: html -->
**Required** — `content` (string).
<!-- END GENERATED FIELDS: html -->

## Merge tags

Personalize any text with `{{contact.field_name}}` — e.g.
`{{contact.first_name}}`, `{{contact.email}}`. They're substituted with real
recipient data when the email is sent.
