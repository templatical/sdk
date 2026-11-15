---
"@templatical/import-beefree": patch
---

The BeeFree importer keeps two kinds of content it used to lose:

- **Dynamic images.** A non-empty `image.dynamicSrc` merge tag becomes the image block's `src`, and the static `image.src` becomes its editor-only `placeholderUrl`. BeeFree's own HTML export uses `dynamicSrc`, so the import is reported `converted`. Before, the merge tag was dropped and the image showed BeeFree's placeholder file, or nothing.
- **The space before a merge tag.** A `<code data-bee-type="mergetag">` chip, or a plain `<code>` around one token, keeps its plain leading space unless the text before it already ends in whitespace or it starts a block (no visible text since the start, a `<br>` or a block element tag), so `Hallo<code data-bee-type="mergetag"> {{contact.first_name}}</code>` imports as `Hallo {{contact.first_name}}`. This reverses the padding trim added in 0.55.0 (#1094), which dropped that space everywhere: BeeFree's own export keeps it.
