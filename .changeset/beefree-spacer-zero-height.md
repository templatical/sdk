---
"@templatical/import-beefree": patch
---

Skip a BeeFree spacer whose height is an explicit 0px, reported as `skipped`, instead of importing it as a 24px spacer. A spacer with a missing, unreadable or negative height now imports at BeeFree's 60px default rather than 24px. In an Icons module, an explicit `0px` `itemsSpacing` no longer falls back to the legacy `itemSpacing` key.
