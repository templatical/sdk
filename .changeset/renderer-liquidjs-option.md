---
"@templatical/renderer": minor
---

Breaking changes:

- `renderToMjml` no longer imports `liquidjs` for `customBlocks`. Pass the module as the new `liquidjs` option: `import * as liquidjs from "liquidjs"`, then `renderToMjml(content, { customBlocks: definitions, liquidjs })`. Without it, a custom block rendered from a definition throws `TypeError: [Templatical] customBlocks requires the liquidjs option`. Content without custom blocks, `renderCustomBlock` and saved `renderedHtml` need nothing.
- `liquidjs` is no longer an optional peer of `@templatical/renderer`. Keep it installed in the project that passes `customBlocks`.

The renderer's dynamic `import("liquidjs")` made Webpack print `Module not found: Error: Can't resolve 'liquidjs'` in every build that installed the renderer without `liquidjs`, including editor apps that call `editor.toMjml()` and never render custom blocks from definitions (#1167).
