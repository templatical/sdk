# Contributing locales

`@templatical/quality` ships locale-aware data sets keyed by language:

1. **Accessibility rule messages** (`src/accessibility/messages/{locale}.ts`) — strings the editor shows for each `a11y.*` issue.
2. **Vague-text dictionaries** (`src/accessibility/dictionaries/{locale}.ts`) — phrase lists used by `a11y.link-vague-text`, `a11y.button-vague-label`, and `a11y.img-linked-no-context`.
3. **Structure rule messages** (`src/structure/messages/{locale}.ts`) — strings for each `structure.*` issue.

Each set mirrors the editor's locale set. The structure linter has no equivalent of vague-text dictionaries — its rules are deterministic and locale-agnostic, only the message text needs translating.

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
```

## Adding a locale

You need **three** files (or two if you're skipping the vague-text dictionary): a message map per linter and a dictionary. Drop the files and they're picked up automatically — every locale registry is built at compile time via `import.meta.glob`, so there's no map to update.

Follow the `typeof en` pattern for every file. The annotation is the contract: any missing key, extra key, or wrong type fails `pnpm run typecheck`. Runtime parity tests verify `{name}` placeholder positions match across locales.

### 1. Accessibility rule messages

Drop `accessibility/messages/<lang>.ts` and translate every value, preserving `{name}` placeholders exactly:

```ts
// accessibility/messages/pt.ts
import type en from "./en";

const pt: typeof en = {
  "a11y.img-missing-alt":
    "Imagem sem texto alternativo. Adicione uma descrição curta ou marque a imagem como decorativa.",
  "a11y.img-alt-too-long":
    "Texto alternativo tem {length} caracteres; mantenha abaixo de {max}.",
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
    "ID de bloco aparece {count} vezes na árvore. Cada bloco precisa ter um ID único.",
  "structure.section-column-mismatch":
    'Seção usa layout "{layout}" (espera {expected} colunas) mas tem {actual}. Estado corrompido.',
  // …one key per structure rule
};

export default pt;
```

That's it — `SUPPORTED_MESSAGE_LOCALES`, `SUPPORTED_DICTIONARY_LOCALES`, and `SUPPORTED_STRUCTURE_MESSAGE_LOCALES` reflect the new locale automatically. No registry edit, no test update.

## Phrase guidelines (vague-text dictionary)

- **Match, not regex.** The vague-text rules normalize the anchor / button text — lowercase, collapse whitespace, strip leading/trailing non-alphanumeric characters (punctuation, arrows, decorative quotes) — then test `phrases.includes(text)`. So `"Click here!"`, `"→ click here"`, and `"»click here«"` all collapse to `click here` and match the same dictionary entry. Don't add punctuation variants — they're redundant. Each entry is still an exact phrase match; don't try to encode regex patterns.
- **Lowercase only.** Comparison is case-insensitive on the input side.
- **Common, not exhaustive.** The point is to catch the most frequent vague phrases native authors fall into. A 50-entry list does more harm than good (false positives).
- **Don't translate English phrases.** The dictionary is a cross-locale union — every registered locale's phrases match regardless of the active `locale` option. So your `pt.ts` only needs Portuguese phrases; English `click here` is already covered by the union.
- **No region duplicates.** `de-AT` resolves to the same union; one entry per language.
- **`linkedImageActionHints` is per-token, not per-phrase.** `a11y.img-linked-no-context` tokenizes the alt text on non-letter/digit boundaries and checks each token against the hint list. Add **single action verbs** in the form authors actually write them ("buy", "kaufen", "compre"), not multi-word phrases — a phrase like `"jetzt kaufen"` will never match because tokens are checked individually.

## How matching resolves

- **Vague-text dictionary** — `getDictionary(locale)` returns a union of every registered locale's phrases (and action hints). The `locale` argument is accepted for API symmetry but currently doesn't change the returned set; a vague phrase is universally vague, and an action verb in any registered language counts as link-destination context, so detection is cross-locale by design.
- **Rule messages** — `formatMessage(locale, ruleId, params?)` (accessibility) and `formatStructureMessage(locale, ruleId, params?)` (structure) resolve the localized template via the matching `messages/{locale}.ts` file and interpolate `{name}` placeholders. Both fall back to English when the locale isn't bundled.
