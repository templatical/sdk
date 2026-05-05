# Lokale beitragen

`@templatical/quality` liefert **zwei** lokalisierungsabhängige Datensätze, beide nach Sprache geschlüsselt:

1. **Regel-Meldungen** (`src/accessibility/messages/{locale}.ts`) – die menschenlesbaren Strings, die die Editor-Sidebar pro Issue rendert.
2. **Vague-Text-Wörterbücher** (`src/accessibility/dictionaries/{locale}.ts`) – die Phrasenlisten, die `link-vague-text`, `button-vague-label` und `img-linked-no-context` nutzen.

Beide spiegeln das Locale-Set des Editors: Jede OSS-Locale, die `@templatical/editor` unterstützt, sollte eine passende Meldungs-Map und ein Wörterbuch haben.

## Dateilayout

```
packages/quality/src/accessibility/messages/
  en.ts       ← Quelle der Wahrheit (implizit typisiert)
  de.ts       ← annotiert mit `typeof en`
  index.ts    ← exportiert formatMessage(), getMessages()

packages/quality/src/accessibility/dictionaries/
  en.ts
  de.ts
  index.ts    ← exportiert getDictionary(), normalizeForMatch()
```

## Eine Locale hinzufügen

Sie brauchen **beides**: eine Meldungs-Map und eine Wörterbuch-Datei. Dateien einfach ablegen – sie werden automatisch erkannt. Das Locale-Register wird zur Compile-Zeit über `import.meta.glob` gebaut, es gibt keine `MESSAGES`- oder `DICTIONARIES`-Map zu pflegen.

Folgen Sie für beide Dateien dem `typeof en`-Muster. Die Annotation ist der Vertrag: jede fehlende Schlüssel, jeder Extraschlüssel oder ein falscher Typ scheitert an `pnpm run typecheck`. Der Laufzeit-Paritätstest (`tests/messages.test.ts`) prüft zusätzlich, dass `{name}`-Platzhalter zwischen Locales pro Schlüssel exakt übereinstimmen.

### 1. Regel-Meldungen

Legen Sie `messages/<lang>.ts` an und übersetzen Sie jeden Wert – `{name}`-Platzhalter exakt erhalten:

```ts
// messages/pt.ts
import type en from "./en";

const pt: typeof en = {
  "img-missing-alt":
    "Imagem sem texto alternativo. Adicione uma descrição curta ou marque a imagem como decorativa.",
  "img-alt-too-long":
    "Texto alternativo tem {length} caracteres; mantenha abaixo de {max}.",
  // …ein Schlüssel pro Regel
};

export default pt;
```

### 2. Vague-Text-Wörterbuch

Legen Sie `dictionaries/<lang>.ts` an:

```ts
// dictionaries/pt.ts
import type en from "./en";

const pt: typeof en = {
  vagueLinkText: ["clique aqui", "aqui", "leia mais", "saiba mais"],
  vagueButtonLabels: ["clique aqui", "clique", "enviar"],
  linkedImageActionHints: ["compre", "leia", "veja", "baixe", "descubra"],
};

export default pt;
```

Das war's – `SUPPORTED_MESSAGE_LOCALES` und `SUPPORTED_DICTIONARY_LOCALES` spiegeln die neue Locale automatisch. Kein Register-Edit, kein Test-Update.

## Phrasen-Richtlinien

- **Match, kein Regex.** Die Vague-Text-Regeln normalisieren den Anker-/Button-Text – Kleinschreibung, Whitespace zusammenfassen, führende/nachfolgende Nicht-Alphanumerik (Satzzeichen, Pfeile, dekorative Anführungen) entfernen – und prüfen dann `phrases.includes(text)`. So fallen `"Hier klicken!"`, `"→ hier klicken"` und `"»hier klicken«"` alle auf `hier klicken` zusammen und treffen denselben Wörterbucheintrag. Fügen Sie keine Satzzeichen-Varianten hinzu – sie sind redundant. Jeder Eintrag ist ein exakter Phrasen-Match; versuchen Sie nicht, Regex-Muster zu kodieren.
- **Nur Kleinschreibung.** Der Vergleich auf Eingabeseite ist case-insensitiv.
- **Häufig, nicht erschöpfend.** Ziel ist, die häufigsten vagen Phrasen zu erwischen, in die Native-Autoren typischerweise verfallen. Eine Liste mit 50 Einträgen schadet mehr, als sie nützt (Falsch-Positive).
- **Englische Phrasen nicht übersetzen.** Das Wörterbuch ist eine sprachenübergreifende Vereinigung – die Phrasen jeder registrierten Locale matchen unabhängig von der aktiven `locale`-Option. Ihre `pt.ts` braucht also nur portugiesische Phrasen; das englische `click here` ist bereits über die Vereinigung abgedeckt.
- **Keine Regional-Duplikate.** `de-AT` löst auf dieselbe Vereinigung auf; ein Eintrag pro Sprache.
- **`linkedImageActionHints` ist token- statt phrasenbasiert.** `img-linked-no-context` zerlegt den Alt-Text an Nicht-Buchstaben/Ziffer-Grenzen und prüft jedes Token einzeln gegen die Hint-Liste. Tragen Sie **einzelne Aktionsverben** in der Form ein, in der Autoren sie tatsächlich schreiben (`"kaufen"`, `"buy"`, `"compre"`) – keine Mehrwort-Phrasen. Ein Eintrag wie `"jetzt kaufen"` wird nie matchen, weil Tokens einzeln geprüft werden.

## Wie das Matching abläuft

- **Vague-Text-Wörterbuch** – `getDictionary(locale)` liefert eine Vereinigung aller registrierten Locale-Phrasen (und Action-Hints). Das `locale`-Argument wird aus API-Symmetriegründen akzeptiert, ändert die zurückgegebene Menge aber derzeit nicht; eine vage Phrase ist universell vage, und ein Aktionsverb in irgendeiner registrierten Sprache zählt als Link-Ziel-Kontext – Erkennung ist also bewusst sprachenübergreifend.
- **Regel-Meldungen** – `formatMessage(locale, ruleId, params?)` löst das lokalisierte Meldungs-Template über `messages/{locale}.ts` auf und interpoliert `{name}`-Platzhalter. Fällt auf Englisch zurück, wenn die Locale nicht mitgeliefert wird.
