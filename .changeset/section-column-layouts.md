---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
"@templatical/quality": minor
"@templatical/template-tools": minor
"@templatical/ai-kit": minor
---

Breaking changes:

- `ColumnLayout` gains `"4"`, `"1-3"`, `"3-1"` and `"1-2-1"`. Code that switches over every layout value, or validates `section.columns` against the previous five, must handle these four values. There is no replacement value: a section may now have four columns.

Section columns accept four more layouts: `"4"` (four equal columns, 25% each), `"1-3"` (25/75), `"3-1"` (75/25), and `"1-2-1"` (25/50/25). A four-column section stacks to one column on mobile, the same as the two- and three-column layouts. `stackOnMobile: false` keeps any of these layouts side by side.
