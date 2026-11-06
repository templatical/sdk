---
"@templatical/ai-kit": patch
---

`translateFields` sends the model short field aliases

The model now sees each field as `f1`, `f2`, … instead of its long id, which shortens its answer. The returned `TranslationResult` still carries the real field ids in request order; the `TranslationRequest` and `TranslationResult` contract and the HTTP wire are unchanged.
