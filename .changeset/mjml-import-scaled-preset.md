---
"@templatical/import-mjml": patch
---

The MJML importer resolves column widths that scale onto a layout preset to that preset, with no `columnWidths`.

Two to four widths that fit no preset are scaled to 100. When the scaled shares are within one hundredth of a preset of that column count, the section takes that preset instead of the even layout plus `columnWidths` equal to it, which the editor showed as custom widths. `45%` / `45%` is `"2"` and `30%` / `60%` is `"1-2"`. A row that doesn't total 100 stays `approximated`, with the same note.
