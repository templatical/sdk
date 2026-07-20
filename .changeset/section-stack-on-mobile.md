---
"@templatical/types": patch
"@templatical/renderer": patch
"@templatical/editor": patch
---

Add a per-section "Stack on mobile" control and make the mobile preview stack columns

- **Fix (#395):** the editor's canvas mobile preview now stacks multi-column sections (each column full-width) on the mobile viewport, matching the exported email. Previously columns stayed side-by-side in the preview while the sent email stacked them.
- **Feature (#396):** new optional `SectionBlock.stackOnMobile`. A "Stack on mobile" toggle in the section settings (shown for multi-column sections, on by default) lets you opt out of stacking — the columns then render inside an `<mj-group>` and stay side-by-side on mobile, reflected in both the canvas preview and the MJML output. Existing templates are unaffected: an absent value keeps MJML's default stacking behavior.
