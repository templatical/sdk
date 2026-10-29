---
"@templatical/template-tools": minor
---

Add `strings export <template.json> --locale <tag>` and `strings import <template.json> <strings.json>` to exchange a language's strings as a `strings/1` JSON file. Export selects the gaps by default (`--only gaps|all`, `--block <id>`). Import re-masks the current defaults, applies every string whose `sourceHash` still matches and whose placeholders come back exactly, writes the accepted strings, and reports `{ applied, rejected }` with the reasons `stale`, `tags_changed`, `unknown_field`, `not_translatable` and `unsafe_html`; it exits `1` when any string was rejected.

`--definitions <file>` loads custom-block definitions for `validate`, `render` and `strings`, so custom `text` and `textarea` translations validate from the CLI and render with each type's Liquid template and stylesheet; an invalid file exits `2`. `--do-not-translate <file>` protects a term list during `strings`, and `import --default-locale <tag>` sets the default language for a source that declares none.
