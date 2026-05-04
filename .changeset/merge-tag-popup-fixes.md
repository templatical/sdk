---
"@templatical/editor": patch
---

Fix several merge-tag UX bugs:

- **Insert button no longer renders without an `onRequest` callback.** When only static `mergeTags.tags` were configured, the "Insert merge tag" button still showed in the rich-text toolbar, `MergeTagInput`, and `MergeTagTextarea`, but clicking it silently no-oped (`requestMergeTag` returns null without `onRequestMergeTag`). Static-tags users discover tags via the autocomplete typing trigger; the button now only appears when `onRequest` is wired up. Renamed the underlying flag from `isEnabled` → `canRequestMergeTag` for clarity.
- **Autocomplete popup positioning no longer breaks on consumer pages with transformed ancestors.** The popup used to mount inside `[data-tpl-theme]` (the editor wrapper) and rely on `position: fixed` resolving against the viewport. Any `transform` on a consumer-page ancestor (route transitions, reveal animations) makes that ancestor the containing block for fixed descendants — the popup landed off-screen instead of pinning to the caret. Popup now mounts to `document.body` and snapshots `--tpl-*` design tokens + typography from the editor's theme root inline so styling carries over without inheriting `.tpl` base rules.
- **Popup rounded corners restored.** `MergeTagSuggestionList` was referencing the undefined `--tpl-radius-md` token; switched to `--tpl-radius`.

Cleanup: leftover "placeholder" copy in editor and playground i18n strings (and corresponding docs in `apps/docs`) is updated to "merge tag" where it referred to the merge-tag concept rather than HTML input placeholder text.
