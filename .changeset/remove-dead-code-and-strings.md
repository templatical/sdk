---
"@templatical/types": patch
"@templatical/import-html": patch
"@templatical/editor": patch
---

Remove dead code, dead translations, and comments that only recorded history.

### Breaking — `restoreMergeTagMarkup` is removed from `@templatical/types`

It converted raw `{{ tag }}` tokens in stored HTML back into `<span data-merge-tag>` markup, and nothing in the SDK called it. It was also **unsafe**: its only guard was a literal `data-merge-tag="` lookbehind, so a token in any other attribute had an element injected into the attribute value —

```html
<a href="{{unsubscribe_url}}">
<!-- became -->
<a href="<span data-merge-tag="{{unsubscribe_url}}">Unsubscribe URL</span>">
```

— which is worse than the bare token it was meant to fix. Position-awareness needs parsing, not better lookarounds, so the fix is a parse-based replacement rather than a patch to this function. If you were calling it, stop: it corrupts attribute-positioned tokens. Its private `escapeRegExp` helper went with it.

### Breaking — `_internal` is removed from `@templatical/import-html`

A test-support barrel (`export const _internal = { convertButton, … }`) that the tests had stopped using. Removing it revealed `convertSpacer` as reachable only through it — a line-for-line duplicate of the live `buildSpacerFromCell` in `section-builder.ts`, which is what actually converts spacer cells. Both are gone; conversion output is unchanged.

### Smaller locale chunks

**772 unused translation strings** removed across ten locale files. The bulk was an 81-key `mediaLibrary` block in the editor's own OSS locales — a key-for-key duplicate of `@templatical/media-library`'s, read by nothing, which every OSS consumer downloaded for a package they do not install. The rest were strings for UI that was never built: a 23-key `aiRewrite` block (the composable is headless and unaffected), add/remove row and column labels for a table toolbar that uses number inputs, singular `social.platform`/`social.url` beside the live plural `social.platforms[…]`, and video platform names nothing renders.

Every OSS session fetches exactly one locale chunk, so this is a direct **~1.1 KB gzip (−14%)** off it; cloud locales drop 18–19%.

Nothing in the public API changes: `init()` accepts only `locale`, with no way to supply or type against these keys.

A new guard (`i18n-key-usage.test.ts`) now checks locale ↔ source agreement in both directions — no reference to a missing key, no key without a reader — which the existing locale-parity test and `typecheck` both structurally miss, since each compares locales to *each other* or derives the type from `en.ts`.
