# @templatical/import-html

## 0.5.1

### Patch Changes

- @templatical/types@0.5.1

## 0.5.0

### Minor Changes

- 34c4636: Add `@templatical/import-html` package. Converts table-based HTML email templates (MJML output, Mailchimp/SendGrid/Campaign Monitor exports, hand-coded marketing emails) to Templatical JSON via `convertHtmlTemplate(html)`. Resolves `<style>` blocks onto inline styles, recognizes layout tables, button cells, spacer cells, and dividers. Unknown elements are preserved as HTML-fallback blocks.

### Patch Changes

- @templatical/types@1.0.0
