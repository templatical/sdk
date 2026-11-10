---
"@templatical/import-beefree": patch
---

Read the Menu, Table and Video modules in the shape BeeFree exports (`IPluginModuleMenu`, `IPluginModuleTable` and `IPluginModuleVideo` in BeeFree's `bee.ts`). The importer read keys BeeFree never writes, so a real menu or table imported with no content and a video lost its thumbnail and width.

- **Menu**: items come from `descriptor.menuItemsList.items` (`text`, `link.href`, `link.target`), the font, color and alignment from `descriptor.style`, the link color from `computedStyle.linkColor`, and the separator from `computedStyle.separator` (none when BeeFree writes none). `spacing` is half of `computedStyle.menuItemsSpacing` `padding-left` plus `padding-right`. A vertical layout is noted. Menu translations are read from `menuItemsList.translations` or the module's `translations`.
- **Table**: rows come from `table.content.headers` then `table.content.rows`. The first header row is the header row, with `headersBackgroundColor`; a header styled differently from Templatical's bold header, extra header rows, borders that differ by side and dashed or dotted borders are `approximated` with a note. The four `border-*` sides become one `borderWidth` and `borderColor`. `font-family` is now carried. A cell's paragraphs and line breaks become one space, so `<p>First</p><p>Second</p>` reads `First Second`.
- **Video**: `thumbSrc` is the thumbnail in `thumbnail` mode; `embedded` and `custom` mode are `approximated`, and a video with no thumbnail on a link other than YouTube or Vimeo adds a `report.warnings` entry. The width (`computedStyle.width`, else `style.width`) follows the image width rule, so `100%` is `"full"` instead of 600px, and the alignment comes from `computedStyle.class`.

An explicit `0px` font size, item spacing or border is kept; only a missing or unreadable value takes the default.
