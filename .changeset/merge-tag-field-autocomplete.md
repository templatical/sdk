---
"@templatical/editor": minor
"@templatical/types": minor
---

Add type-ahead merge tag autocomplete to input and textarea fields

Typing the syntax opener (e.g. `{{`) in any merge-tag-enabled input or textarea — button/image/video/menu links, image alt text, template settings, and custom-block text fields — now surfaces the same autocomplete popup as the rich-text editor. The popup, filtering, keyboard navigation (Arrow / Enter / Tab / Escape), and caret positioning are shared with the TipTap path, so behavior is identical across both surfaces. Controlled by the existing `mergeTags.autocomplete` flag (default on; auto-disabled when `tags` is empty or a custom syntax is used).

`@templatical/types` gains `getSyntaxClosingChar()` alongside `getSyntaxTriggerChar()`.
