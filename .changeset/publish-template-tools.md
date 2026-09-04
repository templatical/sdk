---
"@templatical/template-tools": minor
---

First release. `@templatical/template-tools` is the CLI and library behind the
Templatical Agent Skills: `validate`, `render`, `edit`, `import`, `live`,
`schema` and `list`, each with `--json` output and a documented exit contract.

Nothing is installed into your project. `render --format html` and `import` ask
for one optional package when you use them, resolved from your working
directory so `npx` and a local install agree.
