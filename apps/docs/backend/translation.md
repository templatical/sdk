---
title: Translation
description: Connect init({ translation }) to a TranslationProvider for masked field translation, or serve POST /templates/{template}/translate with the AI kit and check it with runTranslationConformance.
---

# Translation

Connect `init({ translation })` to a `TranslationProvider` to translate eligible fields from the template's default language into an enabled language version.

## Editor setup

In a Vite app with `@templatical/editor` and `@templatical/ai-kit` installed, mount the editor in an existing `#editor` container with a definite height:

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";
import { createHttpTranslationProvider } from "@templatical/ai-kit/client";

const editor = await init({
  container: "#editor",
  localization: { locales: ["en", "de"] },
  translation: createHttpTranslationProvider({ url: "/api" }),
});
```

Under **Languages**, add German and select it. Translate appears only with `translation`, configured `localization` and an enabled non-default language view. It needs no `AiProvider` or loaded template; `templateId` is `null` without one. Omit `translation` and there is no Translate UI. `initCloud()` ignores `translation` with a warning. See [Localized templates](/guide/localized-templates#translating) for the actions and JSON strings round trip.

## Provider contract

`TranslationProvider.translate(request, signal)` returns a `TranslationResult`. The complete declarations, including the pure strings helpers, are:

<<< @/snippets/translation-contract.ts

`TranslationRequest.fields` contains 1–50 fields, with at most 20,000 UTF-16 units (`text.length`) together. IDs are `<blockId>/<path>` or `settings/<path>`. `sourceLocale` is the default; `targetLocale` is the selected version. `templateId` is the loaded template's id or `null`. The kit validates unique nonempty ids and locale tags. A result may be partial; omitted fields keep their previous value, and the editor ignores unknown ids.

Only title and paragraph `content` use `format: "html"`; every other eligible field uses `"text"`. HTML blocks are excluded from Translate and remain editable by hand. Empty defaults, `set` overrides, hidden blocks and list elements with dotted ids are excluded too.

The editor masks whole merge/logic chips in HTML, and raw tags matched by the active syntax in either format. Text content uses `<x id="n"/>`; HTML attribute values use `__xn__`, sharing ids from 1 in source order per field. Return each id exactly once, in either accepted form; `<x id="n"></x>` is also accepted. Placeholders may move for word order. Missing, duplicate or extra ids keep the old value and report `tags_changed`. Existing translations are masked with source token ids; a changed tag makes the field ineligible. Returned HTML goes through Rewrite's `sanitizeRichTextHtml` allow-list with tokens protected, then original tags are restored byte for byte. The pure helpers do not sanitize HTML; headless callers own that step.

Calls run sequentially. On `content_too_large` the editor halves the batch and retries down to one field; a single field over the cap cannot be sent. Successful fields received before Cancel or a provider failure apply together as one undo step. A run that changes nothing records nothing. With collaboration it is an ordinary edit; blocks locked by another session in the captured target language or structurally are skipped and reported.

| `code` | Wire status | Meaning |
| --- | --- | --- |
| `rate_limited` | 429 | Too many requests |
| `limit_reached` | 403 | The provider's allowance is exhausted |
| `content_too_large` | 413 | Retry with fewer fields |
| `translation_failed` | 502 | No valid translation result |

Reject with a readable message and one of these string `code` values, for example `new SdkError("Translation is unavailable.", 502, "translation_failed")` from `@templatical/types`. The editor recognizes codes across bundles, including an integrator's own `SdkError`; it does not require the same class instance. Reject an abort with `AbortError`. The editor-local `translation_running` rejects a second run while one is active; it is not a `TranslationErrorCode` or a wire route error. Malformed requests to the kit return 422 `{ message }` without a code.

## HTTP wire

`createHttpTranslationProvider({ url, headers?, fetch? })` uses a base `url`, an optional `headers: () => Record<string, string> | Promise<Record<string, string>>`, and optional `fetch: typeof fetch`. Keep service credentials on your backend; use `headers` for your application's authentication.

The route name is `translate`: `POST /templates/{template}/translate`, relative to `url`. Use `_` for `{template}` when `templateId` is `null`. The JSON body is the full `TranslationRequest`, and 200 returns `TranslationResult` as JSON. Requests and responses carry `Templatical-AI-Wire: 1`; this route uses no SSE and needs no session header. Errors use `{ message, code, ...details }` with the status above. Cross-origin servers allow `Templatical-AI-Wire`, `Content-Type` and their auth header, and expose `Templatical-AI-Wire`.

## Server implementation

This Fetch-API handler requires `@templatical/ai-kit`. Authenticate and authorize the path template and the body's `templateId` before calling it; authorize requests without a template too. Pass an `AiModelAdapter`, such as a first-party adapter from [the AI kit](/api/ai-kit), with your server's model credentials:

<<< @/snippets/translate-server.ts

`readTranslationRequest(request)` validates the JSON body and call bounds; `readAiRequest` also recognizes the `translate` route. `translateFields({ request, model, signal? })` collects text from `model.stream` with `tools: []`. It checks each requested id exactly once and its placeholder multiset, makes one repair attempt for failed fields, and returns the fields that pass in request order. A cut-off, refusal or malformed JSON is repaired once; if no field passes, it rejects with `translation_failed`. `AbortError` propagates unchanged. The kit does not sanitize returned HTML.

## Mock and conformance

`createMockTranslationProvider({ translations?, delayMs? })` from `@templatical/ai-kit/testing` accepts `translations?: Record<string, Record<string, string>>` keyed by target locale then field id, and `delayMs?: number`. Omitted records get a `[<targetLocale>] ` prefix, inserted into the first visible text segment for HTML, with placeholders intact. It honours aborts.

## Check it

In Node.js with `@templatical/ai-kit` installed, run this against the mock, then substitute your authenticated HTTP provider:

```ts
import { createMockTranslationProvider, runTranslationConformance } from "@templatical/ai-kit/testing";

const checks = await runTranslationConformance(createMockTranslationProvider(), { locale: "de" });
for (const check of checks) {
  if (!check.ok) throw new Error(`${check.name}: ${check.detail ?? "failed"}`);
}
```

`runTranslationConformance(provider, options?: { locale?: string })` returns `Promise<{ name: string; ok: boolean; detail?: string }[]>`; the target defaults to `de`. It checks placeholders, HTML tag names (`p`, `strong`, `b`, `em`, `i`, `u`, `s`, `a`, `br`, `span`), partial results, a 51-field request (reject with `content_too_large` or translate in full), and `AbortError`. Each call has a 5,000 ms deadline. The Node check is a tag-name check, not the editor's DOM sanitizer. Real providers may spend tokens or allowance.

After translating, save the template and run `npx -y @templatical/template-tools validate template.json --locale de --json`. Inspect issues: there should be no `localization.untranslated`, `localization.stale` or `localization.merge-tags-differ` for the fields you translated. Missing/stale warnings alone do not cause a nonzero exit. See [the validation contract](/guide/localized-templates).
