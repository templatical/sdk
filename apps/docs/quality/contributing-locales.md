---
description: Add a new locale's rule messages for accessibility, structure, links, deliverability, compatibility, and localization, plus the vague-text dictionaries the accessibility linter alone uses.
---

# Contributing locales

`@templatical/quality` ships locale-aware data sets keyed by language:

1. **Accessibility rule messages** (`src/accessibility/messages/{locale}.ts`) — strings the editor shows for each `a11y.*` issue.
2. **Vague-text dictionaries** (`src/accessibility/dictionaries/{locale}.ts`) — phrase lists used by `a11y.link-vague-text`, `a11y.button-vague-label`, and `a11y.img-linked-no-context`.
3. **Structure rule messages** (`src/structure/messages/{locale}.ts`) — strings for each `structure.*` issue.
4. **Link rule messages** (`src/links/messages/{locale}.ts`) — strings for each `link.*` issue.
5. **Deliverability rule messages** (`src/deliverability/messages/{locale}.ts`) — strings for each `deliverability.*` issue.

6. **Compatibility rule messages** (`src/compatibility/messages/{locale}.ts`) — `message` and `suggestion` for each `compat.*` rule, plus client grouping labels.

7. **Localization rule messages** (`src/localization/messages/{locale}.ts`) — `message` and `suggestion` for each `localization.*` issue.

Message datasets can cover different locales; an unbundled language falls back to English. Only accessibility uses vague-text dictionaries; the other linters translate their message text without a phrase dictionary.

## File layout

```
packages/quality/src/accessibility/messages/
  en.ts       ← source of truth (typed implicitly)
  de.ts       ← annotated `typeof en`
  index.ts    ← exports formatMessage(), getMessages()

packages/quality/src/accessibility/dictionaries/
  en.ts
  de.ts
  index.ts    ← exports getDictionary(), normalizeForMatch()

packages/quality/src/structure/messages/
  en.ts       ← source of truth
  de.ts       ← annotated `typeof en`
  index.ts    ← exports formatStructureMessage(), getStructureMessages()

packages/quality/src/links/messages/
  en.ts       ← source of truth
  de.ts       ← annotated `typeof en`
  index.ts    ← exports formatLinkMessage(), getLinkMessages()

packages/quality/src/compatibility/messages/
  en.ts
  de.ts
  index.ts

packages/quality/src/deliverability/messages/
  en.ts       ← source of truth
  de.ts       ← annotated `typeof en`
  index.ts    ← exports formatDeliverabilityMessage(), getDeliverabilityMessages()

packages/quality/src/localization/messages/
  en.ts       ← source of truth
  de.ts       ← annotated `typeof en`
  index.ts    ← exports formatLocalizationMessage(), getLocalizationMessages()
```

## Adding a locale

You need one message file per linter and optionally a vague-text dictionary. Drop the files and they're picked up automatically — every locale registry is built at compile time via `import.meta.glob`, so there's no map to update.

Follow the `typeof en` pattern for every file. The annotation is the contract: any missing key, extra key, or wrong type fails `pnpm run typecheck`. Runtime parity tests verify `{name}` placeholder positions match across locales.

### 1. Accessibility rule messages

Drop `accessibility/messages/<lang>.ts` and translate both `message` and `suggestion` for every value, preserving `{name}` placeholders exactly:

```ts
// accessibility/messages/pt.ts
import type en from "./en";

const pt: typeof en = {
  "a11y.img-missing-alt":
    { message: "Imagem sem texto alternativo.", suggestion: "Adicione uma descrição curta ou marque a imagem como decorativa." },
  "a11y.img-alt-too-long":
    { message: "Texto alternativo tem {length} caracteres.", suggestion: "Mantenha abaixo de {max}." },
  // …one key per accessibility rule
};

export default pt;
```

### 2. Vague-text dictionary

Drop `accessibility/dictionaries/<lang>.ts`:

```ts
// accessibility/dictionaries/pt.ts
import type en from "./en";

const pt: typeof en = {
  vagueLinkText: ["clique aqui", "aqui", "leia mais", "saiba mais"],
  vagueButtonLabels: ["clique aqui", "clique", "enviar"],
  linkedImageActionHints: ["compre", "leia", "veja", "baixe", "descubra"],
};

export default pt;
```

### 3. Structure rule messages

Drop `structure/messages/<lang>.ts`:

```ts
// structure/messages/pt.ts
import type en from "./en";

const pt: typeof en = {
  "structure.duplicate-block-id":
    { message: "ID de bloco aparece {count} vezes na árvore.", suggestion: "Dê a cada bloco um ID único." },
  "structure.section-column-mismatch":
    { message: "Seção usa layout {layout}: esperadas {expected} colunas, encontradas {actual}.", suggestion: "Corrija as colunas." },
  // …one key per structure rule
};

export default pt;
```

### 4. Link rule messages

Drop `links/messages/<lang>.ts`:

```ts
// links/messages/pt.ts
import type en from "./en";

const pt: typeof en = {
  "link.javascript-protocol":
    { message: "URL usa o protocolo javascript:.", suggestion: "Substitua por um link real ou remova a URL." },
  "link.unsupported-protocol":
    { message: "URL usa o protocolo {protocol}, que muitos clientes não suportam.", suggestion: "Use http, https, mailto, tel ou sms." },
  // …one key per link rule
};

export default pt;
```

### 5. Deliverability rule messages

Add `deliverability/messages/<lang>.ts` and translate every key in `en.ts`. Preserve the `{textHost}`, `{linkHost}`, `{host}`, `{count}`, and `{min}` placeholders.

```ts
import en from "./en";

const pt: typeof en = {
  ...en,
  "deliverability.link-text-domain-mismatch":
    { message: "O texto mostra {textHost}, mas o link leva a {linkHost}.", suggestion: "Alinhe o texto com o destino." },
};

export default pt;
```

That's it — `SUPPORTED_MESSAGE_LOCALES`, `SUPPORTED_DICTIONARY_LOCALES`, `SUPPORTED_STRUCTURE_MESSAGE_LOCALES`, `SUPPORTED_LINK_MESSAGE_LOCALES`, `SUPPORTED_DELIVERABILITY_MESSAGE_LOCALES`, `SUPPORTED_COMPATIBILITY_MESSAGE_LOCALES`, and `SUPPORTED_LOCALIZATION_MESSAGE_LOCALES` reflect the new locale automatically. No registry edit is needed. Update the corresponding locale and parity tests when adding a dataset.

## Phrase guidelines (vague-text dictionary)

- **Match, not regex.** The vague-text rules normalize the anchor / button text — lowercase, collapse whitespace, strip leading/trailing non-alphanumeric characters (punctuation, arrows, decorative quotes) — then test `phrases.includes(text)`. So `"Click here!"`, `"→ click here"`, and `"»click here«"` all collapse to `click here` and match the same dictionary entry. Don't add punctuation variants — they're redundant. Each entry is still an exact phrase match; don't try to encode regex patterns.
- **Lowercase only.** Comparison is case-insensitive on the input side.
- **Common, not exhaustive.** The point is to catch the most frequent vague phrases native authors fall into. A 50-entry list does more harm than good (false positives).
- **Don't translate English phrases.** The dictionary is a cross-locale union — every registered locale's phrases match regardless of the active `locale` option. So your `pt.ts` only needs Portuguese phrases; English `click here` is already covered by the union.
- **No region duplicates.** `de-AT` resolves to the same union; one entry per language.
- **`linkedImageActionHints` is per-token, not per-phrase.** `a11y.img-linked-no-context` tokenizes the alt text on non-letter/digit boundaries and checks each token against the hint list. Add **single action verbs** in the form authors actually write them ("buy", "kaufen", "compre"), not multi-word phrases — a phrase like `"jetzt kaufen"` will never match because tokens are checked individually.

## Match order

- **Vague-text dictionary** — `getDictionary(locale)` returns a union of every registered locale's phrases (and action hints). The `locale` argument is accepted for API symmetry but currently doesn't change the returned set; a vague phrase is universally vague, and an action verb in any registered language counts as link-destination context, so detection is cross-locale by design.
- **Rule messages** — `formatMessage(locale, ruleId, params?)` (accessibility), `formatStructureMessage(locale, ruleId, params?)` (structure), `formatLinkMessage(locale, ruleId, params?)` (links), `formatDeliverabilityMessage(locale, ruleId, params?)` (deliverability), `formatCompatibilityMessage(locale, ruleId, params?)` (compatibility) and `formatLocalizationMessage(locale, ruleId, params?)` (localization) resolve the localized template via the matching `messages/{locale}.ts` file and interpolate `{name}` placeholders. All fall back to English when the locale isn't bundled.

### 6. Compatibility rule messages

Translate both fields of each `{ message, suggestion }` entry in `compatibility/messages/en.ts`. Preserve `{feature}`, `{unsupported}`, `{partial}`, `{size}`, `{max}`, and the feature placeholders. Keep family/platform labels and the `more` count localized. The formatter returns `{ message, suggestion }`; add the locale file to the existing glob layout.


### 7. Localization rule messages

Create `localization/messages/<lang>.ts` from `localization/messages/en.ts`. Use a base-language filename such as `pt.ts`: lookup lowercases the requested locale’s base language and falls back to English when that map is absent. Import the English map as a type with `import type en from "./en"`, annotate the locale map with `typeof en`, and export it as default, following `de.ts`.

Translate both `message` and `suggestion` for `localization.untranslated`, `localization.stale`, and `localization.merge-tags-differ`. Preserve every `{field}` placeholder in both fields. `import.meta.glob` loads the file automatically; no registry edit is needed. `SUPPORTED_LOCALIZATION_MESSAGE_LOCALES` exposes the bundled locale keys; `getLocalizationMessages` and `formatLocalizationMessage` use the new map.

Update `tests/localization/messages.test.ts`: include the added locale in the expected `SUPPORTED_LOCALIZATION_MESSAGE_LOCALES` list and extend rule-key and placeholder parity checks to the new map, comparing both `message` and `suggestion` with English. The current cases compare `en` and `de`. Then run `pnpm --filter @templatical/quality run typecheck` and `pnpm --filter @templatical/quality run test`. Call `formatLocalizationMessage` for the new locale and verify that both returned fields are translated and the `{field}` parameter is substituted.
