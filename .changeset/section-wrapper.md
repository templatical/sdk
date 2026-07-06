---
"@templatical/types": minor
"@templatical/renderer": minor
"@templatical/editor": minor
---

Add an optional outer frame to section blocks (`section.wrapper`) — a full-width band with its own background, padding, and corner radius that frames the section, rendered as an `mj-wrapper` around the section's `mj-section`. This makes the common "white card on a colored band" layout possible without nesting sections (which MJML forbids). Enable it from the section toolbar's Wrapper panel, or set `createSectionBlock({ wrapper: { backgroundColor, padding, borderRadius } })`; omit it and existing templates are unchanged. (#312)
