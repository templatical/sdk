---
"@templatical/ai-kit": minor
---

Add `createHttpTranslationProvider`, the `translate` wire route, `readTranslationRequest`, `translateFields`, `createMockTranslationProvider` and `runTranslationConformance` for translation with exact placeholder checks and one repair attempt. AI requests and prompts carry the active language through `locale`, and `checkRewrite` requires the input's exact merge- and logic-tag multiset.

Additive and opt-in: existing templates need no migration. Keep every `@templatical/*` package on the same version.
