# Lokalen beitragen

`@templatical/quality` liefert lokal-aware Datensätze, getrennt nach Sprache:

1. **Barrierefreiheits-Regelnachrichten** (`src/accessibility/messages/{locale}.ts`) — die Texte, die der Editor für jedes `a11y.*`-Issue zeigt.
2. **Vague-Text-Dictionaries** (`src/accessibility/dictionaries/{locale}.ts`) — Phrasenlisten, die von `a11y.link-vague-text`, `a11y.button-vague-label` und `a11y.img-linked-no-context` genutzt werden.
3. **Struktur-Regelnachrichten** (`src/structure/messages/{locale}.ts`) — Texte für jedes `structure.*`-Issue.
4. **Link-Regelnachrichten** (`src/links/messages/{locale}.ts`) — Texte für jedes `link.*`-Issue.

Jede Datenmenge spiegelt die Locale-Auswahl des Editors. Der Struktur- und der Link-Linter haben kein Vague-Text-Dictionary-Pendant — ihre Regeln sind deterministisch und sprachunabhängig, nur der Nachrichtentext muss übersetzt werden.

## Verzeichnisstruktur

```
packages/quality/src/accessibility/messages/
  en.ts       ← Source of Truth (implizit typisiert)
  de.ts       ← annotiert mit `typeof en`
  index.ts    ← exportiert formatMessage(), getMessages()

packages/quality/src/accessibility/dictionaries/
  en.ts
  de.ts
  index.ts    ← exportiert getDictionary(), normalizeForMatch()

packages/quality/src/structure/messages/
  en.ts       ← Source of Truth
  de.ts       ← annotiert mit `typeof en`
  index.ts    ← exportiert formatStructureMessage(), getStructureMessages()

packages/quality/src/links/messages/
  en.ts       ← Source of Truth
  de.ts       ← annotiert mit `typeof en`
  index.ts    ← exportiert formatLinkMessage(), getLinkMessages()
```

## Eine Locale hinzufügen

Sie brauchen **drei** Dateien (oder zwei, falls Sie das Vague-Text-Dictionary auslassen): eine Message-Map pro Linter und ein Dictionary. Dateien ablegen — sie werden automatisch erkannt. Jede Locale-Registry wird zur Compile-Zeit per `import.meta.glob` gebaut, es gibt keine Map zu pflegen.

Folgen Sie dem `typeof en`-Muster in jeder Datei. Die Annotation ist der Vertrag: jeder fehlende Key, jeder zusätzliche Key oder jeder falsche Typ lässt `pnpm run typecheck` scheitern. Laufzeit-Paritätstests prüfen zusätzlich, dass `{name}`-Platzhalter über Locales hinweg übereinstimmen.

### 1. Barrierefreiheits-Regelnachrichten

`accessibility/messages/<lang>.ts` ablegen und jeden Wert übersetzen — `{name}`-Platzhalter exakt beibehalten:

```ts
// accessibility/messages/pt.ts
import type en from "./en";

const pt: typeof en = {
  "a11y.img-missing-alt":
    "Imagem sem texto alternativo. Adicione uma descrição curta ou marque a imagem como decorativa.",
  "a11y.img-alt-too-long":
    "Texto alternativo tem {length} caracteres; mantenha abaixo de {max}.",
  // …ein Key pro Barrierefreiheits-Regel
};

export default pt;
```

### 2. Vague-Text-Dictionary

`accessibility/dictionaries/<lang>.ts` ablegen:

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

### 3. Struktur-Regelnachrichten

`structure/messages/<lang>.ts` ablegen:

```ts
// structure/messages/pt.ts
import type en from "./en";

const pt: typeof en = {
  "structure.duplicate-block-id":
    "ID de bloco aparece {count} vezes na árvore. Cada bloco precisa ter um ID único.",
  "structure.section-column-mismatch":
    'Seção usa layout "{layout}" (espera {expected} colunas) mas tem {actual}. Estado corrompido.',
  // …ein Key pro Struktur-Regel
};

export default pt;
```

### 4. Link-Regelnachrichten

`links/messages/<lang>.ts` ablegen:

```ts
// links/messages/pt.ts
import type en from "./en";

const pt: typeof en = {
  "link.javascript-protocol":
    'URL usa o protocolo "javascript:", que é removido na renderização por segurança. Substitua por um link real ou remova a URL.',
  "link.unsupported-protocol":
    'URL usa o protocolo "{protocol}", que a maioria dos clientes de e-mail não suporta. Use http, https, mailto, tel ou sms.',
  // …ein Key pro Link-Regel
};

export default pt;
```

Das war's — `SUPPORTED_MESSAGE_LOCALES`, `SUPPORTED_DICTIONARY_LOCALES`, `SUPPORTED_STRUCTURE_MESSAGE_LOCALES` und `SUPPORTED_LINK_MESSAGE_LOCALES` reflektieren die neue Locale automatisch. Keine Registry zu editieren, kein Test zu aktualisieren.

## Phrasen-Richtlinien (Vague-Text-Dictionary)

- **Match, nicht Regex.** Die Vague-Text-Regeln normalisieren den Anchor- / Button-Text — kleinschreiben, Whitespace zusammenfassen, führende/abschließende nicht-alphanumerische Zeichen (Interpunktion, Pfeile, dekorative Anführungszeichen) entfernen — und testen dann `phrases.includes(text)`. „Click here!", „→ click here" und „»click here«" kollabieren also alle zu `click here` und matchen denselben Dictionary-Eintrag. Fügen Sie keine Interpunktionsvarianten hinzu — sie sind redundant. Jeder Eintrag ist trotzdem ein exakter Phrasen-Match; versuchen Sie nicht, Regex-Muster zu codieren.
- **Nur Kleinbuchstaben.** Der Vergleich ist auf der Input-Seite case-insensitive.
- **Häufig, nicht erschöpfend.** Ziel ist, die häufigsten vagen Phrasen zu erwischen, die Autoren der Sprache schreiben. Eine 50-Einträge-Liste richtet mehr Schaden an als Nutzen (False Positives).
- **Englische Phrasen nicht übersetzen.** Das Dictionary ist eine sprachübergreifende Vereinigung — die Phrasen jeder registrierten Locale matchen unabhängig von der aktiven `locale`-Option. Ihre `pt.ts` braucht also nur portugiesische Phrasen; das englische `click here` ist über die Vereinigung bereits abgedeckt.
- **Keine Regions-Duplikate.** `de-AT` löst sich auf dieselbe Vereinigung auf; ein Eintrag pro Sprache.
- **`linkedImageActionHints` ist pro Token, nicht pro Phrase.** `a11y.img-linked-no-context` tokenisiert den Alt-Text an Nicht-Buchstaben/Ziffer-Grenzen und prüft jeden Token gegen die Hint-Liste. Tragen Sie **einzelne Action-Verben** in der Form ein, in der Autoren sie schreiben („buy", „kaufen", „compre") — nicht Mehrwort-Phrasen. „jetzt kaufen" wird nie matchen, weil Tokens einzeln geprüft werden.

## Wie das Matching aufgelöst wird

- **Vague-Text-Dictionary** — `getDictionary(locale)` liefert eine Vereinigung der Phrasen (und Action-Hints) aller registrierten Locales. Das `locale`-Argument wird der API-Symmetrie wegen akzeptiert, ändert aber aktuell nichts an der zurückgegebenen Menge — eine vage Phrase ist universell vage, und ein Action-Verb in einer beliebigen registrierten Sprache zählt als Link-Ziel-Kontext. Die Erkennung ist by design sprachübergreifend.
- **Regelnachrichten** — `formatMessage(locale, ruleId, params?)` (Barrierefreiheit), `formatStructureMessage(locale, ruleId, params?)` (Struktur) und `formatLinkMessage(locale, ruleId, params?)` (Links) lösen das lokalisierte Template über die jeweilige `messages/{locale}.ts`-Datei auf und interpolieren `{name}`-Platzhalter. Alle drei fallen auf Englisch zurück, wenn die Locale nicht gebündelt ist.
