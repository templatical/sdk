---
"@templatical/editor": minor
"@templatical/renderer": minor
"@templatical/template-tools": minor
"@templatical/types": minor
---

Custom block fields are HTML-escaped in templates

`{{ }}`, `{% echo %}`, `{% liquid %}` echo and `{% cycle %}` output in a custom block's template is now HTML-escaped: `&`, `<`, `>`, `"` and `'` become `&amp;`, `&lt;`, `&gt;`, `&#34;` and `&#39;`. To keep HTML from a field, write `{{ field | raw }}`. Remove explicit `| escape` from ordinary output; print captured output with `{{ name | raw }}`; and use `{{ field | escape | newline_to_br | raw }}` for HTML-producing filters. The editor canvas also sanitizes each rendered custom block. `@templatical/types` now exports `createCustomBlockLiquid(liquidjs)` so headless resolvers use the editor's engine. Recipe URLs percent-encode field values and JSON bodies remain unescaped; use `{{ key | json }}` to quote a JSON value.

`@templatical/renderer` now accepts `customBlocks: CustomBlockDefinition[]` so headless callers render saved blocks with definitions directly. `@templatical/template-tools` uses this option for specimen MJML rendering.
