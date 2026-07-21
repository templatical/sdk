# Block guide

Human-readable companion to `schema.json` (the authoritative contract). A
template is `{ "blocks": Block[], "settings": Settings }`. All sizes are pixels
and all colors are hex strings unless noted. Fields marked _optional_ may be
omitted; everything else is required.

**Contents:** [Settings](#settings) · [Common fields](#common-block-fields) · Layout — [section](#section), [spacer](#spacer), [divider](#divider) · Text — [title](#title), [paragraph](#paragraph), [menu](#menu), [table](#table) · Media & actions — [image](#image), [button](#button), [social](#social), [video](#video), [countdown](#countdown) · [html](#html) · [Merge tags](#merge-tags). Complete templates that exercise the trickier blocks (wrapper cards, multi-column layouts, tables, countdowns) live in [`examples/`](./examples/).

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

## Common block fields

Every block has:

- `id` (string) — unique within the template, e.g. `"title_1"`.
- `type` (string) — the block type (below).
- `styles` — `{ padding: { top, right, bottom, left }, backgroundColor?: hex }`.
- `visibility` (_optional_) — `{ desktop: bool, mobile: bool }` to hide per
  device.

Do **not** add fields beyond those listed per type — the schema rejects unknown
properties.

## Layout

### section

Container that arranges blocks into columns.

- `columns` — `"1"`, `"2"`, `"3"`, `"2-1"`, or `"1-2"`.
- `children` — array of columns, each an array of blocks. Column count must match
  `columns` (`"1"` → one inner array; `"2"`/`"2-1"`/`"1-2"` → two; `"3"` →
  three).
- `borderRadius` (int, _optional_) — corner radius; omit or `0` for square.
- `stackOnMobile` (bool, _optional_) — whether columns stack vertically on
  mobile; omit or `true` keeps the default responsive stacking (columns stack
  below 480px), `false` keeps them side by side.
- `wrapper` (_optional_) — outer full-width band: `{ backgroundColor?, padding?,
borderRadius? }` (e.g. a white card on a colored band).

Don't nest a section inside another section — MJML has no equivalent, so the
renderer drops it on export.

### spacer

- `height` (int) — vertical space.

### divider

- `lineStyle` — `"solid" | "dashed" | "dotted"`.
- `color` (hex), `thickness` (int), `width` (int | `"full"`).

## Text

### title

- `content` (HTML string) — heading text; inline HTML allowed.
- `level` — `1`–`4` (1 largest).
- `color` (hex, _optional_) — inherits `settings.textColor` if unset.
- `textAlign` — `"left" | "center" | "right"`.
- `fontFamily` (string, _optional_).

### paragraph

- `content` (HTML string) — supports `<b>`, `<i>`, `<a href>`, `<br>`, `<ul>`,
  `<ol>`.

### menu

Horizontal nav row of links.

- `items` — array of `{ id, text, url, openInNewTab: bool, bold: bool,
underline: bool, color?: hex }`.
- `fontSize` (int), `textAlign`, `spacing` (int).
- `separator` (string, e.g. `"•"`), `separatorColor` (hex).
- `color` (hex, _optional_), `linkColor` (hex, _optional_), `fontFamily`
  (_optional_).

### table

- `rows` — array of `{ id, cells: [{ id, content }] }`; `content` is HTML.
- `hasHeaderRow` (bool), `headerBackgroundColor` (hex, _optional_).
- `borderColor` (hex), `borderWidth` (int), `cellPadding` (int).
- `fontSize` (int), `textAlign`, `color` (hex, _optional_), `fontFamily`
  (_optional_).

## Media & actions

### image

- `src` (URL), `alt` (string — write meaningful alt text).
- `width` (int | `"full"`), `align` — `"left" | "center" | "right"`.
- `linkUrl` (URL, _optional_), `linkOpenInNewTab` (bool, _optional_).
- `decorative` (bool, _optional_) — mark purely decorative images.

### button

- `text` (string), `url` (URL).
- `backgroundColor` (hex), `textColor` (hex).
- `borderRadius` (int), `fontSize` (int).
- `buttonPadding` — `{ top, right, bottom, left }`.
- `openInNewTab` (bool, _optional_), `fontFamily` (_optional_), `width` (int |
  `"full"`, _optional_).

### social

- `icons` — array of `{ id, platform, url }`.
- `platform` — one of: `facebook`, `twitter`, `instagram`, `linkedin`,
  `youtube`, `tiktok`, `pinterest`, `email`, `whatsapp`, `telegram`, `discord`,
  `snapchat`, `reddit`, `github`, `dribbble`, `behance`, `website`.
- `iconStyle` — `"solid" | "outlined" | "rounded" | "square" | "circle"`.
- `iconSize` — `"small" | "medium" | "large"`.
- `spacing` (int), `align` — `"left" | "center" | "right"`.

### video

Renders as a thumbnail with a play button linking to the video.

- `url` (URL), `thumbnailUrl` (URL), `alt` (string).
- `width` (int | `"full"`), `align`.
- `openInNewTab` (bool, _optional_).

### countdown

- `targetDate` (ISO 8601 string), `timezone` (string).
- `showDays`, `showHours`, `showMinutes`, `showSeconds` (bool).
- `separator` — `":" | "-" | " "`.
- `digitFontSize` (int), `digitColor` (hex).
- `labelFontSize` (int), `labelColor` (hex), `backgroundColor` (hex).
- `labelDays`, `labelHours`, `labelMinutes`, `labelSeconds` (strings).
- `expiredMessage` (string), `expiredImageUrl` (URL), `hideOnExpiry` (bool).
- `fontFamily` (_optional_).

### html

Raw-HTML escape hatch. Prefer native blocks — `html` content is not visually
editable in the editor afterward, so use it only when no other block fits.

- `content` (string) — raw HTML.

## Merge tags

Personalize any text with `{{contact.field_name}}` — e.g.
`{{contact.first_name}}`, `{{contact.email}}`. They're substituted with real
recipient data when the email is sent.
