# Contributing locales

`@templatical/quality` ships a vague-text dictionary per locale, used by the `link-vague-text` and `button-vague-label` rules. The package mirrors the editor's locale set: every OSS locale supported by `@templatical/editor` should have a matching dictionary.

## File layout

```
packages/quality/src/dictionaries/
  en.ts       ← source of truth (typed implicitly)
  de.ts       ← annotated `typeof en`
  index.ts    ← exports `getDictionary(locale)`
```

## Adding a locale

1. Copy `en.ts` to `<lang>.ts`.
2. Annotate it with the structural type from `en`:

```ts
// pt.ts
import type en from "./en";

const pt: typeof en = {
  vagueLinkText: [
    "clique aqui",
    "aqui",
    "leia mais",
    "mais",
    "saiba mais",
  ],
  vagueButtonLabels: [
    "clique aqui",
    "clique",
    "enviar",
  ],
};

export default pt;
```

The `typeof en` annotation is the contract: any missing key, extra key, or wrong type fails `pnpm run typecheck`.

3. Register it in `dictionaries/index.ts`:

```ts
import pt from "./pt";

const DICTIONARIES: Record<string, Dictionary> = {
  en, de, pt,
};
```

4. The `dictionaries.test.ts` parity test will pick up the new locale automatically and confirm key alignment with the English source.

## Phrase guidelines

- **Match, not regex.** The rule lowercases and trims the anchor text, then tests `phrases.includes(text)`. Each entry is an exact match — don't try to encode patterns.
- **Lowercase only.** Comparison is case-insensitive on the input side.
- **Common, not exhaustive.** The point is to catch the most frequent vague phrases authors fall into. A 50-entry list does more harm than good (false positives).
- **No region duplicates.** `de-AT` falls back to `de`; ship one Germanic dictionary, not two.

## Locale fallback

`getDictionary("pt-BR")` strips the region and looks up `pt`. If the base language isn't registered, the resolver falls back to `en`. So a missing locale degrades to English vague-text matching rather than disabling the rule.
