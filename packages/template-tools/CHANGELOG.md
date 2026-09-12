# @templatical/template-tools

## 0.38.0

### Minor Changes

- 67cd83d: First release. `@templatical/template-tools` is the CLI and library behind the
  Templatical Agent Skill: `validate`, `render`, `edit`, `import`, `live`,
  `schema` and `list`, each with `--json` output and a documented exit contract
  (`0` success, `1` invalid template, `2` misuse, `3` an optional package is
  missing and the message names the install command).

  Nothing is installed into your project. `render --format html` and `import` ask
  for one optional package when you use them, resolved from your working
  directory so `npx` and a local install agree. `import --list-formats --json`
  reports which converters are resolvable rather than assuming a fixed list.

  It is also a library: `validateTemplate`, `runQualityLint`, `applyOperation`,
  `getColumnCount` and the generated block schema from the package root, plus the
  local live-preview bridge behind the `./live` subpath and the raw schema at
  `./schema.json` — the two pieces needed to generate templates with your own
  model and validate the result. Documented at
  https://docs.templatical.com/api/template-tools.

  The Agent Skill it powers ships as one skill with a thin router: an entry point
  under 4 KB that loads exactly one of 22 playbooks per request, replacing two
  skills totalling 50 KB that loaded everything up front. Its SDK reference is
  fetched from docs.templatical.com rather than packed in, so an answer is never
  older than the site, and the block schema travels with the skill because it is
  contract rather than documentation.

### Patch Changes

- Updated dependencies [67cd83d]
  - @templatical/types@0.38.0
  - @templatical/import-beefree@0.38.0
  - @templatical/import-chamaileon@0.38.0
  - @templatical/import-easy-email-pro@0.38.0
  - @templatical/import-html@0.38.0
  - @templatical/import-mjml@0.38.0
  - @templatical/import-stripo@0.38.0
  - @templatical/import-topol@0.38.0
  - @templatical/import-unlayer@0.38.0
  - @templatical/quality@0.38.0
  - @templatical/renderer@0.38.0
