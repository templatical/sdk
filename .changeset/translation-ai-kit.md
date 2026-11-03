---
"@templatical/ai-kit": minor
---

Translation over your own backend

Breaking changes:

- TypeScript producers must set the now required `AiRequestBase.locale` and `AiRewriteRequest.locale` to the active language, or `null` in the default view, and `CollaborationRemoteChange.locale` to the first locale operation's language in a batch, excluding `setDefaultLocale`, or `null` when there is none. Code that builds these objects must set them even without localization enabled.

Otherwise existing templates need no migration. Keep every `@templatical/*` package on the same version.

- `createHttpTranslationProvider` and the `translate` wire route (`POST /templates/{template}/translate`), with `readTranslationRequest`, `translateFields`, `createMockTranslationProvider` and `runTranslationConformance`.
- `translateFields` requires every requested field id once with its placeholders intact, makes one repair attempt for failed fields and returns the fields that pass.
- AI requests and prompts carry the active language as `locale`, and `checkRewrite` requires the input's exact merge- and logic-tag multiset.

See [Translation](https://docs.templatical.com/backend/translation).
