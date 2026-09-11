# @templatical/import-chamaileon

## 0.37.0

### Patch Changes

- @templatical/types@0.37.0

## 0.36.0

### Minor Changes

- cdd67a5: Add `@templatical/import-chamaileon`, a converter from Chamaileon `getDocument()` JSON to Templatical template JSON.

  `convertChamaileonTemplate(doc)` returns `{ content, report }` with the same shape as the other `@templatical/import-*` packages. It accepts Email JSON 2.0 through 4.1 (kebab-case and camelCase, `{ reference, default }` color variables), maps `fullwidth` / `multicolumn` / leaves, and reports what it approximated: nested columns flattened, 4+ columns folded to three, outlined buttons, loops whose children converted without their expressions.

### Patch Changes

- Updated dependencies [d8e38e4]
  - @templatical/types@0.36.0
