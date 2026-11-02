---
"@templatical/types": patch
"@templatical/renderer": patch
"@templatical/template-tools": patch
"@templatical/editor": patch
---

Custom-block `{% cycle %}` output is HTML-escaped once with liquidjs 10.30.1

liquidjs 10.30.1 applies `outputEscape` to `{% echo %}` and `{% cycle %}` itself. `createCustomBlockLiquid` also registered its own escaping `cycle` tag, so with 10.30.1 every `{% cycle %}` value in a custom-block template was escaped twice (`<b>` rendered as `&amp;lt;b&amp;gt;`) by `renderToMjml(content, { customBlocks })` and by `templatical custom-block`. Their `^10.30.0` range admits 10.30.1, so fresh installs already resolved it. The editor bundles its own liquidjs and was not affected.

`createCustomBlockLiquid` now registers no tags of its own and relies on liquidjs's `outputEscape` for `{{ }}`, `{% echo %}`, `{% liquid %}` echo and `{% cycle %}`.

- The optional `liquidjs` peer range of `@templatical/types` and `@templatical/renderer` is now `^10.30.1`. With 10.30.0, `{% echo %}` and `{% cycle %}` print their values unescaped, so upgrade `liquidjs` to `^10.30.1` in the project that renders custom blocks.
- A final `| raw` on a cycle candidate (`{% cycle body | raw, other %}`) opts that value out of escaping.
- Falsy cycle candidates print as stock liquidjs prints them: `{% cycle 0, 1 %}` renders `0`, then `1`.
- `CustomBlockLiquidModule` requires only `Liquid`; passing the whole `liquidjs` module works as before.
