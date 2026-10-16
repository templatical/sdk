---
"@templatical/editor": patch
---

The text toolbar's line-height and letter-spacing selects show their placeholders and the letter-spacing "Normal" option in the editor's locale. They used to read `LH`, `LS` and `Normal` in every locale. The placeholders stay short, such as `ZH` / `ZA` in German and `行間` / `字間` in Japanese, and each select's tooltip and accessible label still give the full name.
