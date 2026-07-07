---
"@templatical/editor": minor
---

Add standalone logic tags — a control-flow feature separate from merge tags. Configure `logicTags.tags` (standalone tokens like `{% else %}`) and `logicTags.pairs` (open/close constructs like `{% if %}` … `{% endif %}`), or supply `logicTags.onRequest` to plug in your own picker (mirrors `mergeTags.onRequest`; precedence: onRequest → built-in picker). A dedicated "Insert logic" affordance appears in rich-text blocks **and** in merge-tag-enabled plain fields (button text, URLs, alt text). Standalone tags insert at the cursor; pairs wrap the current selection (or drop with the caret between them). The built-in picker is a single searchable list grouped by `group` — each group holds both its standalone tags and its open/close pairs, with keyword badges (one per tag, two per pair). Typed and pasted logic tags are still highlighted automatically, independent of this config. New exported types: `LogicTagsConfig`, `LogicTag`, `LogicPair`.
