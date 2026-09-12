# @templatical/import-topol

## 0.38.0

### Patch Changes

- Updated dependencies [67cd83d]
  - @templatical/types@0.38.0

## 0.37.0

### Patch Changes

- @templatical/types@0.37.0

## 0.36.0

### Patch Changes

- Updated dependencies [d8e38e4]
  - @templatical/types@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [703193a]
  - @templatical/types@0.35.0

## 0.34.3

### Patch Changes

- @templatical/types@0.34.3

## 0.34.2

### Patch Changes

- @templatical/types@0.34.2

## 0.34.1

### Patch Changes

- @templatical/types@0.34.1

## 0.34.0

### Patch Changes

- @templatical/types@0.34.0

## 0.33.0

### Patch Changes

- Updated dependencies [d76c343]
  - @templatical/types@0.33.0

## 0.32.0

### Minor Changes

- c18940d: Add `@templatical/import-topol`, a converter from Topol.io design JSON to Templatical template JSON.

  `convertTopolTemplate(design)` returns `{ content, report }` with the same shape as the BeeFree, Unlayer, HTML and MJML importers. It resolves Topol's global-style cascade — the per-tag and per-selector defaults on the design root — maps every tag Topol emits, and reports what it approximated: a four-column section folded to three, a GIF block imported as an image, a social platform with no Templatical equivalent.

  Pass the design object itself, or a JSON string of it. Topol's editor hands it to you directly from its `onSave` callback; its REST APIs wrap it — under `data.definition` on the template endpoint, `json` on the predefined-templates endpoint.

### Patch Changes

- @templatical/types@0.32.0
