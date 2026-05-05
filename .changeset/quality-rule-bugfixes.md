---
"@templatical/quality": patch
---

Fix four bugs in `@templatical/quality`:

- **`text-all-caps` now flags non-Latin scripts.** The previous Latin-only character class silently passed all-caps Cyrillic, Greek, Vietnamese, and other non-Latin scripts. The rule now uses the Unicode `\p{L}` class with locale-aware case comparison, so `СКИДКА ПЯТЬДЕСЯТ ПРОЦЕНТОВ…` and `ΜΕΓΑΛΗ ΠΡΟΣΦΟΡΑ…` are reported just like English shouty caps.
- **`img-linked-no-context` is now locale-aware.** Action-verb hints were hardcoded English, which produced false positives on every German / French / Portuguese alt text. The hints have moved into the dictionary registry as a new `linkedImageActionHints` field, with the same cross-locale union semantics as `vagueLinkText` and `vagueButtonLabels`. Locale contributors should add their language's action verbs (single tokens, e.g. `"kaufen"`, `"compre"`) when adding a new dictionary file.
- **`link-target-blank-no-rel` auto-fix.** The fix performed a raw substring `String.replace` against the attribute string, so an earlier attribute whose value happened to contain `rel="…"` (e.g. `data-x='rel="external"'`) could be corrupted instead of the real `rel`. The fix now splices by the attribute's parsed start offset.
- **`extractAnchors` (public utility).** When a nested `<a>` opened (invalid but parsed permissively), the outer anchor's accumulated prefix text was wiped. Each open anchor now owns its own buffer; nested anchors no longer truncate ancestors.

The `Dictionary` type exported from `@templatical/quality` gains a required `linkedImageActionHints: string[]` field. Downstream contributors maintaining a custom `dictionaries/<locale>.ts` will see a `typeof en` typecheck error until they add the field — see the updated [Contributing locales](https://docs.templatical.com/quality/accessibility/contributing-locales) guide.
