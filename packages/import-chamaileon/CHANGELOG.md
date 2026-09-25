# @templatical/import-chamaileon

## 0.41.0

### Patch Changes

- @templatical/types@0.41.0

## 0.40.0

### Patch Changes

- Updated dependencies [b7ff7d9]
  - @templatical/types@0.40.0

## 0.39.4

### Patch Changes

- @templatical/types@0.39.4

## 0.39.3

### Patch Changes

- @templatical/types@0.39.3

## 0.39.2

### Patch Changes

- @templatical/types@0.39.2

## 0.39.1

### Patch Changes

- @templatical/types@0.39.1

## 0.39.0

### Patch Changes

- Updated dependencies [a2b4cde]
  - @templatical/types@0.39.0

## 0.38.0

### Patch Changes

- Updated dependencies [67cd83d]
  - @templatical/types@0.38.0

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
