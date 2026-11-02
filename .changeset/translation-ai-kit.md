---
"@templatical/ai-kit": minor
---

Add `createHttpTranslationProvider`, the `translate` wire route (`POST /templates/{template}/translate`), `readTranslationRequest`, `translateFields`, `createMockTranslationProvider` and `runTranslationConformance` for translation with exact placeholder checks. `translateFields` requires every requested field id once with its placeholders intact, makes one repair attempt for failed fields, accepts a JSON answer wrapped in a code fence, and returns the fields that pass. AI requests and prompts carry the active language through `locale`, and `checkRewrite` requires the input's exact merge- and logic-tag multiset.

Stored-template compatibility: existing templates need no migration. Keep every `@templatical/*` package on the same version.

TypeScript producers must set the required `AiRequestBase.locale` and `AiRewriteRequest.locale` fields to the active language, or `null` in the default view. `CollaborationRemoteChange.locale` is also required: producers must set it to the first locale operation’s language in a batch, excluding `setDefaultLocale`, or `null` when there is none. Code that builds these objects must set these fields even without localization enabled.
