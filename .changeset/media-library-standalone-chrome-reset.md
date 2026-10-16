---
"@templatical/media-library": patch
---

The standalone media library (`init()` and `MediaLibraryModal`) now renders as designed on host pages without a CSS reset. A reset such as Tailwind's preflight hid all of this. Inside the editor, the media library already rendered correctly.

- **Grid and list:** file captions picked up browser margins. Grid cards were 15% taller and list rows 45% taller.
- **Footer:** selecting a file grew the footer by 40px, taking that height from the file grid.
- **Dialogs:** the delete, import and replace dialogs grew 40px wider than their size limit, and their titles and text picked up browser margins. The crop dialog's header was 28px taller.
- **Folders:** folder names used the browser's 13.33px button font, the folder list scrolled sideways, and the expand chevron was squeezed to a sliver.
- **Upload area and header:** 32px and 13px taller.
- **Frame:** the library was 2px wider and taller than its container, so its right and bottom borders fell outside it.

The library's stylesheet now carries the editor's reset, scoped to the media library, so it never touches the host page.

`import '@templatical/media-library/style.css'` now resolves. The export pointed at a file the build never wrote, so npm installs had no way to load the stylesheet.
