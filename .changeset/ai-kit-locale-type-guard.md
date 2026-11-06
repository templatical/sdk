---
"@templatical/ai-kit": patch
---

Breaking changes:

- Editing sessions refuse a locale layer that sets a block's `type` or changes its `customType`, including when `setDefaultLocale` promotes the layer and `removeLocale` removes the old default in the same batch.
- A locale layer's `set.children` may keep a `custom`, `slot`, or `wrapper` block only when the base content already has a block with the same `id` and `type`, and a `custom` block also keeps its `customType`; it cannot introduce one.
- Malformed block or settings locale layers are refused as invalid; repair an existing malformed layer outside the session, or use `setContent` to replace an existing type or children violation before promotion.
