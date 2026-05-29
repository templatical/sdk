---
"@templatical/types": minor
"@templatical/editor": minor
---

Remove the unimplemented `BlockStyles.responsive` / `ResponsiveStyles` surface and make preview mode honor block visibility.

`styles.responsive` (tablet/mobile padding overrides) was typed and documented but read by neither the renderer nor the editor preview, so the values were dead data (#146). The `ResponsiveStyles` type, the `responsive` field on `BlockStyles`, and their docs are removed. Per-breakpoint padding is intentionally not implemented: email clients vary in media-query support (Outlook desktop ignores them entirely) and MJML already stacks columns and scales fluidly on mobile. Use `visibility` for per-viewport show/hide.

The editor preview now actually hides blocks that are set hidden on the current viewport (previously they were only dimmed with a badge), so the preview matches the exported MJML.
