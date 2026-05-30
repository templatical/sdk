---
"@templatical/import-beefree": patch
"@templatical/editor": patch
---

Close meaningful test-coverage gaps and fix a BeeFree import bug

- `@templatical/import-beefree`: stop emitting a redundant `font-weight: 400` span (now matches `@templatical/import-unlayer`).
- `@templatical/editor`: export the merge-tag suggestion `render` factory so the popup lifecycle is unit-testable (behavior unchanged).
- Added regression tests across editor, import, and media-library packages, and started measuring Vue SFCs in coverage.
