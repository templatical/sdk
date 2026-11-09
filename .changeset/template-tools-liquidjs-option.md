---
"@templatical/template-tools": patch
---

`custom-block render` and `custom-block validate` pass their own `liquidjs` to `renderToMjml`, which no longer imports it. CLI output is unchanged.
