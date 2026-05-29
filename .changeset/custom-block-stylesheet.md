---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
---

Add `CustomBlockDefinition.stylesheet` — definition-level CSS that emits once into `<mj-head><mj-style>` in the rendered MJML and is mirrored in the editor canvas.

Custom blocks render as raw HTML inside an `mj-text` cell, which means MJML's automatic responsive behavior (column stacking, fluid images) only applies to the *outer* layout — not to the internals of a custom block. Previously a developer had no clean place to put per-definition media queries, hover states, or block-specific font declarations; ad-hoc `<style>` blocks inside the `template` ended up in the email body rather than `<mj-head>`, with no dedupe across instances.

The new `stylesheet?: string` field on `CustomBlockDefinition` solves this:

- The renderer collects every definition's `stylesheet` from the content tree, dedupes by `customType` *and* by trimmed content, and emits each unique stylesheet once as an additional `<mj-style>` block alongside the built-in visibility media queries.
- The editor canvas mirrors the same CSS via a reactive `<style>` element rendered inside the editor root — in shadow-DOM mode it scopes to the shadow root; in light-DOM mode it shares the global stylesheet surface already established by `dist/style.css`.
- The renderer adds an optional `getCustomBlockStylesheet?: (customType: string) => string | undefined | null` resolver to `RenderOptions`. The editor wires this from its block registry automatically; headless callers provide their own resolver from whatever definitions map they manage.
- `TemplaticalEditor` (the OSS init return) gains `getCustomBlockStylesheet(customType)` for parity with `renderCustomBlock`.

Class names in `stylesheet` are **not** scoped by the SDK — namespace them per definition (e.g. `.tplc-<type>-<element>`) to avoid collisions. Email-client caveats apply (Outlook desktop ignores `@media` queries, matching every other media-query-based feature in the SDK such as block visibility).

Fully backward compatible: existing definitions and renderer callers that omit the new field/option produce the same MJML and editor behavior as before.

Addresses #155 (raised as the follow-up to #146).
