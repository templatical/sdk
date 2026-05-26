# @templatical/import-html

## 0.9.0

### Patch Changes

- Updated dependencies [4dfe37e]
  - @templatical/types@0.9.0

## 0.8.5

### Patch Changes

- 674571b: Harden HTML/regex hot paths against polynomial-ReDoS and incomplete-sanitization classes flagged by GitHub code scanning. All changes preserve existing public APIs.
  - `@templatical/types`: rewrite `resolveHtmlMergeTagLabels` / `resolveHtmlLogicMergeTagLabels` from a `<span[^>]*…[^>]*>` regex to a single-pass linear scanner. Adversarial inputs that used to take O(n²) now complete in O(n).
  - `@templatical/renderer`: same linear-scanner rewrite for `convertMergeTagsToValues`. Paragraph stripper changed `[^>]*` → `[^<>]*` so it fails fast on `<p<p<p…`-style inputs.
  - `@templatical/quality`: linear-time HTML-comment stripper in `hasNestedAnchors`. An unterminated `<!--` now drops the rest of the input rather than leaving the literal `<!--` behind (closes the incomplete-sanitization gap). The `link.javascript-protocol` rule now also flags `data:` and `vbscript:` URLs — both can encode executable script and were previously only flagged as the lower-severity `link.unsupported-protocol`. Rule ID unchanged; message gained a `{protocol}` placeholder. Severity overrides set against `link.javascript-protocol` continue to apply.
  - `@templatical/import-unlayer` / `@templatical/import-beefree`: replace `<p[^>]*>([\s\S]*?)</p>` paragraph-wrap regex with a linear scanner. Button-label sanitizer now drops unterminated `<script` fragments instead of leaving them in the imported JSON. `parsePxValue` collapses two whitespace quantifiers around an optional `px` so trailing whitespace can't trigger backtracking.
  - CI: every job in `.github/workflows/ci.yml` now runs under a least-privilege `permissions: contents: read` token. Closes the missing-workflow-permissions alerts.
  - Playground Cloudflare Worker: `generateId` switched from `bytes[i] % 62` (biased — indices 0..7 were ~25% more likely than 8..61) to rejection sampling for a uniform distribution over the alphabet.

  Regression coverage added: 13 new tests assert linear-time behavior on 10k–50k-char adversarial inputs (bounded at 500ms), plus correctness tests for the new dangerous-protocol coverage, nested-span rewriting, and button-label sanitization edge cases.

- Updated dependencies [674571b]
  - @templatical/types@0.8.5

## 0.8.4

### Patch Changes

- @templatical/types@0.8.4

## 0.8.3

### Patch Changes

- @templatical/types@0.8.3

## 0.8.2

### Patch Changes

- @templatical/types@0.8.2

## 0.8.1

### Patch Changes

- @templatical/types@0.8.1

## 0.8.0

### Patch Changes

- @templatical/types@0.8.0

## 0.7.3

### Patch Changes

- @templatical/types@0.7.3

## 0.7.2

### Patch Changes

- @templatical/types@0.7.2

## 0.7.1

### Patch Changes

- @templatical/types@0.7.1

## 0.7.0

### Patch Changes

- @templatical/types@0.7.0

## 0.6.7

### Patch Changes

- @templatical/types@0.6.7

## 0.6.6

### Patch Changes

- @templatical/types@0.6.6

## 0.6.5

### Patch Changes

- @templatical/types@0.6.5

## 0.6.4

### Patch Changes

- @templatical/types@0.6.4

## 0.6.3

### Patch Changes

- @templatical/types@0.6.3

## 0.6.2

### Patch Changes

- de4b0a3: Polish and general bug fixes
  - @templatical/types@0.6.2

## 0.6.1

### Patch Changes

- @templatical/types@0.6.1

## 0.6.0

### Patch Changes

- Updated dependencies [55002de]
  - @templatical/types@1.0.0

## 0.5.1

### Patch Changes

- @templatical/types@0.5.1

## 0.5.0

### Minor Changes

- 34c4636: Add `@templatical/import-html` package. Converts table-based HTML email templates (MJML output, Mailchimp/SendGrid/Campaign Monitor exports, hand-coded marketing emails) to Templatical JSON via `convertHtmlTemplate(html)`. Resolves `<style>` blocks onto inline styles, recognizes layout tables, button cells, spacer cells, and dividers. Unknown elements are preserved as HTML-fallback blocks.

### Patch Changes

- @templatical/types@1.0.0
