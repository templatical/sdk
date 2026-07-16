---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
---

Add a document-level default text color to template settings

`TemplateSettings` gains an optional `textColor`. When set, the renderer applies it as the `<mj-text>` default color so text blocks inherit it — a block's own color (e.g. a Title's `color`) and inline text-color marks still override it, and links (`color: inherit`) pick it up too. It's exposed as a color picker in the editor's Appearance settings, next to Background color, and reflected live on the canvas. Unset leaves rendering unchanged, so existing templates are unaffected. (#355)
