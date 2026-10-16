---
"@templatical/types": minor
"@templatical/renderer": patch
"@templatical/editor": patch
---

A blank line typed in a title or paragraph is kept on the canvas and in the email. TipTap stores it as an empty `<p></p>`, which showed a line tall only while editing: on the canvas and in mail clients an empty paragraph has no height. The renderer and the canvas now fill each empty paragraph with `&nbsp;`, so the blank line is one line tall everywhere. Templates that already contain blank lines get taller in sent emails, matching what the author saw while editing. The stored content is unchanged, and a paragraph with no text at all still renders nothing. `@templatical/types` exports the rule as `fillEmptyParagraphs`, with `isBlankRichText` for the empty check.
