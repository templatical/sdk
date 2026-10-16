---
"@templatical/types": minor
"@templatical/editor": minor
"@templatical/import-unlayer": patch
"@templatical/import-beefree": patch
---

Size an image by its height with the aspect ratio locked. When the image file's size is known, the image settings show a link toggle on the Height row, on by default: typing a height sets the width from the file's ratio, and a height that would make the image wider than its column sets it to Full width, with a note of the height it lands at. Under the lock the stored `height` stays unset, because a stored height squashes an image on any phone narrower than its width (MJML shrinks the width and keeps the height).

`ImageBlock` gains optional `naturalWidth` / `naturalHeight`, the file's own size, which is never rendered. A media pick fills them from the asset's `width` / `height`, and `MediaResult` gains optional `width` / `height` so an `onRequestMedia` widget can pass them too. The Unlayer and BeeFree importers fill them from the source file. Without them the editor measures the image while it is selected and stores the size only with the edit that uses it, so opening a template never marks it dirty. Editing `src` clears a stored size. An image whose stored height stretches it opens unlocked, and turning the lock on clears that height.
