---
"@templatical/types": minor
"@templatical/renderer": patch
"@templatical/editor": patch
---

Titles and paragraphs enter editing in place. The edit surface used to add a dashed border and 8px of padding around the text, which made the text column 18px narrower and could move its line breaks; its dashed ring is now an outline drawn 4px outside the text, so nothing moves. Titles also kept a different line height in each place: 1.5 while editing, 1.25 on the canvas and 1.3 in the email. All three now use 1.3, which `@templatical/types` exports as `TITLE_LINE_HEIGHT`, so sent emails are unchanged and a canvas title is about 1px taller per line.
