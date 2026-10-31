---
title: Translation
description: Connect init({ translation }) to a TranslationProvider for masked field translation, or serve POST /templates/{template}/translate with the AI kit and check it with runTranslationConformance.
---

# Translation

Connect `init({ translation })` to a `TranslationProvider` to translate eligible fields from the template's default language into an enabled language version.

## Editor setup

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";
import { createHttpTranslationProvider } from "@templatical/ai-kit/client";

const editor = await init({
  container: "#editor",
  localization: { locales: ["en", "de"], doNotTranslate: ["Sable"] },
  translation: createHttpTranslationProvider({ url: "/api" }),
});
```

For a static page without a bundler, mount from the CDN as in the [Quick Start](/getting-started/quick-start#mount-the-editor); `translation` can be any object with a `translate` method. Under **Languages**, add German and select it. Translate appears only with `translation`, configured `localization` and an enabled non-default language view. It needs no `AiProvider` or loaded template; `templateId` is `null` without one. Omit `translation` and there is no Translate UI. See [Localized templates](/guide/localized-templates#translating) for the actions and JSON strings round trip, and [Subject lines](/guide/localized-templates#subject-lines) for text outside the template.

## Provider contract

`TranslationProvider.translate(request, signal)` returns a `TranslationResult`. The complete declarations, including the pure strings helpers, are:

<<< @/snippets/translation-contract.ts

`TranslationRequest.fields` contains 1–50 fields, with at most 20,000 UTF-16 units (`text.length`) together. IDs are `<blockId>/<path>` or `settings/<path>`. `sourceLocale` is the default; `targetLocale` is the selected version. `templateId` is the loaded template's id or `null`. The kit validates unique nonempty ids and locale tags. A result may be partial; omitted fields keep their previous value, and the editor ignores unknown ids.

Only title and paragraph `content` use `format: "html"`; every other eligible field uses `"text"`. HTML blocks are excluded from Translate and remain editable by hand. Empty defaults, `set` overrides and hidden blocks are excluded too.

The editor masks whole merge/logic chips in HTML, and raw tags matched by the active syntax in either format. Text content uses `<x id="n"/>`; HTML attribute values use `__xn__`, sharing ids from 1 in source order per field. Return each id exactly once, in either accepted form; `<x id="n"></x>` is also accepted. Placeholders may move for word order. Missing, duplicate or extra ids keep the old value and report `tags_changed`. Existing translations are masked with source token ids. If their tags no longer match, the old translation is not sent and the field is translated from the current default. `localeStrings` retains its masked current source and `sourceHash`, omitting `text`; coverage alone selects gaps or all fields. Returned HTML goes through the editor’s DOMPurify-based `sanitizeHtml` with tokens protected, then original tags are restored byte for byte. The pure helpers do not sanitize HTML; headless callers own that step.

`localization.doNotTranslate?: string[]` protects configured terms with the same exact placeholder check. Omit it to protect only merge and logic tags. `init()` accepts at most 500 terms, each 1–100 characters after trimming; invalid input rejects with `SdkError`: `localization.doNotTranslate must be an array of at most 500 terms, each 1–100 characters.` Matching is case-sensitive and uses whole words: Unicode letters, numbers and `_` are word characters. In `html` fields, terms match the decoded text: numeric references, the HTML 4.01 named references, `&apos;` and the uppercase aliases `&AMP;`, `&COPY;`, `&GT;`, `&LT;`, `&QUOT;` and `&REG;` are decoded before matching, so `&apos;` matches a term's `'`. Other named references stay as written, and reference names are case-exact (`&Amp;` stays literal). In `text` fields, terms match the text as written. Longer terms match first, without overlap, in text content and HTML attribute values. Merge tags and whole chips take precedence over overlapping terms. Every match joins the field's source-order id sequence; successful unmasking restores the original term bytes. A missing or changed placeholder rejects that field with `tags_changed` and keeps its previous value. An extra literal occurrence of a term is plain text: with `["Cloud"]`, the source `Templatical Cloud stores cloud files` masks to `Templatical <x id="1"/> stores cloud files`, and the German `Templatical <x id="1"/> speichert Cloud-Dateien` is accepted, because every placeholder returns exactly once. `TranslationRequest` is unchanged.

For headless flows, pass the same `doNotTranslate?: readonly string[]` to `localeStrings` and `applyLocaleStrings`; `maskTags(text, syntax, format, { doNotTranslate })` also accepts it. The helpers trim terms when matching; the size limits are validated by `init()`. Existing translations reuse the source's ids. If a stored translation lacks or changes a protected term, a selected field remains eligible: the old translation is not sent, and translation starts from the current default. Check a configured term by translating a field containing it: the provider receives a placeholder and the saved translation contains the original term.

Calls run sequentially. On `content_too_large` the editor halves the batch and retries down to one field; a provider that still refuses one field ends the run with its message. A single field over the 20,000-unit cap isn't sent: the run stops at that field without calling the provider, keeps the fields already returned, and the result notice says "1 field is too long to translate.", the editor's own limit. Translate that field by hand, or round-trip its block with `strings export --block <id>` and `strings import`. Successful fields received before Cancel or a provider failure apply together as one undo step. A run that changes nothing records nothing. With collaboration it is an ordinary edit; blocks locked by another session in the captured target language or structurally are skipped and reported.

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

Without the kit, implement `translate` against your service. For DeepL, group the fields by format, send `tag_handling=html` for `html` fields and `tag_handling=xml` for `text` fields, then map the results back to the field ids. DeepL documents [HTML handling](https://developers.deepl.com/docs/xml-and-html-handling/html) and [XML handling](https://developers.deepl.com/docs/xml-and-html-handling/xml) (checked 2026-10-26): its XML examples keep placeholder ids and empty elements, and HTML handling keeps markup with lenient parsing. These settings don't replace the editor's exact placeholder check; run the conformance suite below against your provider.

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

After translating, save the template and run `npx -y @templatical/template-tools validate template.json --locale de --json`. Inspect issues: there should be no `localization.untranslated`, `localization.stale` or `localization.merge-tags-differ` for the fields you translated. Missing/stale warnings alone do not cause a nonzero exit. See [the validation contract](/guide/localized-templates#check-your-work).
