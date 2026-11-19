---
"@templatical/import-beefree": patch
---

Report warnings, error messages and the unsupported-module comment spell the vendor Beefree. `convertBeeFreeTemplate`, `ConvertBeeFreeOptions` and `BeeFreeTemplate` are unchanged.

An invalid template throws `Invalid Beefree template: missing page.rows. Ensure you are passing a valid Beefree JSON export.` A module with no HTML to keep becomes `<!-- Unsupported Beefree module: <type> -->`. Warnings that name the vendor, including the five-column flatten warning, say Beefree.
