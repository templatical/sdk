# Contributing locales

`@templatical/quality` ships **two** locale-aware data sets, both keyed by language:

1. **Rule messages** (`src/messages/{locale}.ts`) — the human-readable strings the editor sidebar renders for each issue.
2. **Vague-text dictionaries** (`src/dictionaries/{locale}.ts`) — the phrase lists used by `link-vague-text` and `button-vague-label`.

Both mirror the editor's locale set: every OSS locale supported by `@templatical/editor` should have a matching message map and dictionary.

## File layout

```
packages/quality/src/messages/
  en.ts       ← source of truth (typed implicitly)
  de.ts       ← annotated `typeof en`
  index.ts    ← exports formatMessage(), getMessages()

packages/quality/src/dictionaries/
  en.ts
  de.ts
  index.ts    ← exports getDictionary()
```

## Adding a locale

You need **both** a message map and a dictionary file. Drop the files and they're picked up automatically — the locale registry is built at compile time via `import.meta.glob`, so there's no `MESSAGES` or `DICTIONARIES` map to update.

Follow the same `typeof en` pattern for both files. The annotation is the contract: any missing key, extra key, or wrong type fails `pnpm run typecheck`. The runtime parity test (`tests/messages.test.ts`) additionally verifies that `{name}` placeholders match between locales for every key.

### 1. Rule messages

Drop `messages/<lang>.ts` and translate every value, preserving `{name}` placeholders exactly:

```ts
// messages/pt.ts
import type en from "./en";

const pt: typeof en = {
  "img-missing-alt":
    "Imagem sem texto alternativo. Adicione uma descrição curta ou marque a imagem como decorativa.",
  "img-alt-too-long":
    "Texto alternativo tem {length} caracteres; mantenha abaixo de {max}.",
  // …one key per rule
};

export default pt;
```

### 2. Vague-text dictionary

Drop `dictionaries/<lang>.ts`:

```ts
// dictionaries/pt.ts
import type en from "./en";

const pt: typeof en = {
  vagueLinkText: ["clique aqui", "aqui", "leia mais", "saiba mais"],
  vagueButtonLabels: ["clique aqui", "clique", "enviar"],
};

export default pt;
```

That's it — `SUPPORTED_MESSAGE_LOCALES` and `SUPPORTED_DICTIONARY_LOCALES` reflect the new locale automatically. No registry edit, no test update.

## Phrase guidelines

- **Match, not regex.** The rule lowercases and trims the anchor text, then tests `phrases.includes(text)`. Each entry is an exact match — don't try to encode patterns.
- **Lowercase only.** Comparison is case-insensitive on the input side.
- **Common, not exhaustive.** The point is to catch the most frequent vague phrases native authors fall into. A 50-entry list does more harm than good (false positives).
- **Don't translate English phrases.** The dictionary is a cross-locale union — every registered locale's phrases match regardless of the active `locale` option. So your `pt.ts` only needs Portuguese phrases; English `click here` is already covered by the union.
- **No region duplicates.** `de-AT` resolves to the same union; one entry per language.

## How matching resolves

- **Vague-text dictionary** — `getDictionary(locale)` returns a union of every registered locale's phrases. The `locale` argument is accepted for API symmetry but currently doesn't change the returned set; a vague phrase is universally vague, so detection is cross-locale by design.
- **Rule messages** — `formatMessage(locale, ruleId, params?)` resolves the localized message template via `messages/{locale}.ts` and interpolates `{name}` placeholders. Falls back to English when the locale isn't bundled.
