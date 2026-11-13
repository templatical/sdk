---
"@templatical/import-beefree": patch
---

The BeeFree importer removes a `<code data-bee-type="speciallink">` link chip and keeps its inner HTML, including the link, as written.

A merge-tag chip is still unwrapped to its token, and any other `<code>` stays.
