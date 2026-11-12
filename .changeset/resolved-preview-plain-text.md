---
"@templatical/types": patch
"@templatical/editor": patch
---

Previews that show what `resolvePreview` returned now render resolved tags as plain text. A tag resolved in place, whose `data-merge-tag` attribute holds the value instead of the token (what a host gets by rendering the whole string through its template engine), shows that value with no merge-tag highlight in preview mode and in the test-email dialog, and a logic tag the host evaluated shows no badge. Before, every resolved value rendered as a highlighted merge-tag chip. A tag whose attribute still holds a token keeps its label and highlight, and unresolved previews (no resolver, or the fallback after a failure) are unchanged, including the Sample/Label switch. Adds `unwrapHtmlResolvedMergeTags` to `@templatical/types`.
