---
"@templatical/renderer": patch
"@templatical/import-mjml": patch
"@templatical/editor": patch
---

Fractional padding and borders no longer shift which images fill their column on phones

MJML reads each side's padding and border width as a whole pixel when it sizes a box, so 20.5px of padding takes 20px. The renderer took the full 20.5, which made the room it worked out a pixel smaller than MJML's. In a section, wrapper band or image with fractional side padding or borders, an image one pixel narrower than its column was still stretched to the phone column (`fluid-on-mobile`). The renderer, the MJML importer's "fills its column" check and the editor's aspect-lock limit now read each side the way MJML does.
