---
"@templatical/import-beefree": patch
"@templatical/import-stripo": patch
---

Two importer corrections.

- **Beefree.** When a 7/12 or 5/12 row snaps to an even split, the padding returned to a column no longer changes what a module displays. A 240px image keeps its width, a lone icon, divider, video and button keep theirs, and text still gets the padding back. Column padding a snapped column keeps, including padding only on its outer edge, still narrows the room an image is measured in, so an image as wide as that room is full width.
- **Stripo.** A social icon is identified by the file name of its `src`, not by the host or folders of the URL, so `https://xing.com.evil.example/icons/other.png` stays a website link. A URL with no file name, such as `https://xing.com.evil.example?file=other.png`, stays a website link too; the query and hash are not the file name.
