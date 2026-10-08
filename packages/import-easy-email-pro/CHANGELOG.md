# @templatical/import-easy-email-pro

## 0.44.0

### Patch Changes

- Updated dependencies [841cb38]
  - @templatical/types@0.44.0

## 0.43.3

### Patch Changes

- @templatical/types@0.43.3

## 0.43.2

### Patch Changes

- @templatical/types@0.43.2

## 0.43.1

### Patch Changes

- @templatical/types@0.43.1

## 0.43.0

### Patch Changes

- be4ac17: Easy Email Pro imports keep text, merge tags, tables, raw HTML, headers and footers

  - **`standard-text` imports as a paragraph.** It is Easy Email Pro's default text block, and it imported as an HTML block holding the node's JSON, so recipients saw JSON. It now maps the same way as `standard-paragraph`, with `blockAttributes["standard-text"]` and the `TEXT` category in its attribute cascade.
  - **Inline `html-node` elements keep their text.** A `<span>`, `<em>`, `<strong>` or `<br>` inside rich text was dropped along with its words. It now serialises as its tag with its string attributes, escaped; void tags such as `br` and `img` self-close. An `html-node` sitting directly in a column is still an `html-fallback`.
  - **Merge tags survive.** "Hello {mergetag}, here is your order" imported as "Hello , here is your order". A `mergetag` now becomes the token Easy Email Pro renders, such as `{{ customer.name }}`, with the marks of its text, and the editor turns it into a merge tag.
  - **`standard-table2` tables import.** Their rows are `standard-table2-tr` and their cells `standard-table2-td`; only a `tr` / `td` shape was read, so a real table produced no block and no report entry. Both shapes are read now.
  - **`raw` imports as an HTML block of its `data.content`,** reported `converted`. It was an HTML block holding the node's JSON.
  - **`page-header` and `page-footer` convert their content.** Their `data.content` walks the way page children do, in order, and the band's background and padding land on the resulting sections as `section.wrapper`, as a `standard-wrapper`'s do. The whole band was one HTML block holding its JSON. An empty band is reported `skipped`.
  - **A divider keeps its width.** A missing width or `100%` imports as `"full"`, any other percentage stays a percentage such as `"50%"` (clamped to 0–100%), and a px width stays px unless it fills its column's content width less the divider's own padding, where it becomes `"full"`. Every divider imported full-width before.

- Updated dependencies [be4ac17]
  - @templatical/types@0.43.0

## 0.42.1

### Patch Changes

- @templatical/types@0.42.1

## 0.42.0

### Patch Changes

- Updated dependencies [5758c24]
- Updated dependencies [cb82f7e]
  - @templatical/types@0.42.0

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

- d9ba851: Add `@templatical/import-easy-email-pro`, a converter from Easy Email Pro persist JSON to Templatical template JSON.

  `convertEasyEmailProTemplate(doc)` returns `{ content, report }` with the same shape as the other `@templatical/import-*` packages. It accepts the `{ subject, content }` envelope or a bare `type: "page"` element, resolves `$var()` design tokens, maps `standard-section` / `standard-column` / leaves, and reports what it approximated: 4+ columns folded to three, outlined buttons, hero overlays, countdown GIFs, widgets, and logic whose children converted without their expressions.

### Patch Changes

- Updated dependencies [d8e38e4]
  - @templatical/types@0.36.0
