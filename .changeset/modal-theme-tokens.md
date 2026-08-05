---
"@templatical/editor": patch
---

Fix dialogs ignoring the `theme` config option ([#487](https://github.com/templatical/sdk/issues/487)). The saved-blocks browser, the save-block dialog and the test-email dialog rendered in the SDK's default colours inside an otherwise themed editor.

`theme` is applied as inline styles on the editor root, and the shared modal backdrop carries the `tpl` class that re-declares the full `--tpl-*` token set. A custom property declared on a descendant beats one inherited from an ancestor, so the backdrop reset every token to its stock default for the whole dialog it wrapped. The backdrop now re-applies the theme overrides, which covers every dialog rendered through it — including any added later.

Dark mode was unaffected, and the `--tpl-user-*` CSS-variable theming surface was unaffected. Only the `theme` config option was lost, and only inside modals.

A new guard enforces the underlying rule — any element carrying the bare `tpl` class must re-apply the theme overrides — so a future surface can't reintroduce this silently.
