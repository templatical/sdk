---
"@templatical/editor": patch
---

Fix a dropped image overwriting a URL changed while it uploaded. An image block, its URL field in the sidebar, a section or band background image, a custom block's image field and a custom social icon's image field each take a drop upload's result only if the field still holds the URL it had when the file was dropped. A URL typed, picked with Browse, inserted as a merge tag or set by a drop on the image's other drop zone while the upload runs now stays, and the uploading overlay clears as soon as the URL changes. A Browse pick still applies even if the URL changed while the picker was open.
