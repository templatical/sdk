---
"@templatical/ai-kit": minor
---

Add `createHttpTranslationProvider`, the `translate` wire route, `readTranslationRequest`, `translateFields`, `createMockTranslationProvider` and `runTranslationConformance` for translation with exact placeholder checks and one repair attempt. AI requests and prompts carry the active language through `locale`, and `checkRewrite` requires the input's exact merge- and logic-tag multiset.

Stored-template compatibility: existing templates need no migration. Keep every `@templatical/*` package on the same version.

TypeScript producers must set the required `AiRequestBase.locale` and `AiRewriteRequest.locale` fields to the active language, or `null` in the default view. `CollaborationRemoteChange.locale` is also required: producers must set it to the first locale operation’s language in a batch, or `null` when there is none. Code that builds these objects must set these fields even without localization enabled.
