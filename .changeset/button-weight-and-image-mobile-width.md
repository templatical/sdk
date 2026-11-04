---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/template-tools": minor
"@templatical/ai-kit": minor
---

Two optional block fields. Leaving either out renders exactly as before.

- **Button `fontWeight`:** `"regular"` (400), `"medium"` (500) or `"bold"` (700), rendered as `mj-button font-weight`. Without it the label stays bold. The editor's button settings offer Regular, Medium and Bold (choosing Bold clears the field), with labels in all eight locales.
- **Image `fluidOnMobile`:** `true` always emits MJML `fluid-on-mobile="true"` and `false` never does. Without it an image still goes full width on a phone only when it fills its column on desktop; video thumbnails are unchanged. The editor's image settings offer Automatic, Always and Never, with labels in all eight locales.

The JSON schema, the `template-tools` validator and the agent skill's block guide include both fields.
