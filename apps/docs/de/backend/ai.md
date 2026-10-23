---
title: KI
description: Chat, Lint-Korrekturen, Alt-Text-Entwürfe, Umformulieren und Design zu Template über Ihr eigenes KI-Backend.
---

# KI

Geben Sie dem Editor einen KI-Provider, und Ihre Nutzenden erhalten einen Assistenten, der das geöffnete Template bearbeitet: einen Chat mit Rückgängig, „Rewrite with AI“ in der Absatz-Werkzeugleiste, prüfbare Alt-Text-Entwürfe im Issues-Panel, statische, lokalisierte Einstiegsanfragen und ein Template aus einem Screenshot oder einer PDF. Ihr Backend spricht mit dem Modell — mit Ihren Schlüsseln, Ihren Vereinbarungen zur Datenverarbeitung und Ihren Regeln.

Der Editor übernimmt die Oberflächen, das Streaming, das Anwenden der KI-Änderungen mit Rückgängig und die Kennzeichnung der Inhalte als KI-generiert. Sie übernehmen den Modellaufruf: eine Funktion pro Feature oder einige HTTP-Endpunkte, deren Großteil `@templatical/ai-kit` bereitstellt.

## Schnellstart

```ts
import { init } from '@templatical/editor';
import { createHttpAiProvider } from '@templatical/ai-kit/client';

const editor = await init({
  container: '#editor',
  templates: myTemplateStore,
  ai: createHttpAiProvider({
    baseUrl: '/api/ai',
    headers: async () => ({ Authorization: `Bearer ${await getToken()}` }),
  }),
});

await editor.load('tpl_123');
```

`createHttpAiProvider` spricht ein dokumentiertes REST- und Server-Sent-Events-Protokoll. [Eigenes KI-Backend anbinden](/de/guide/bring-your-own-ai) baut die Serverseite mit `@templatical/ai-kit/server` in etwa hundert Zeilen auf; die [KI-API-Referenz](/de/api/ai-kit#das-protokoll) dokumentiert das Protokoll für Backends in jeder Sprache.

**KI braucht ein geladenes Template.** Jede Anfrage benennt es, daher erscheinen die Einstiegspunkte, sobald `create()` oder `load()` abgeschlossen ist. **Lassen Sie `ai` weg, fehlt das Feature**: kein Menü, keine Schaltfläche in der Werkzeugleiste, und kein Code seiner Oberfläche wird geladen.

## Der Vertrag

```ts
import type { AiProvider } from '@templatical/types';

interface AiProvider {
  chat: false | ((request, on: AiTurnHandlers, signal: AbortSignal) => Promise<{ messageId: string | null; text: string }>);
  fixFinding: false | ((request, on: AiTurnHandlers, signal: AbortSignal) => Promise<{ messageId: string | null; text: string }>);
  design: false | ((request, on: AiTurnHandlers, signal: AbortSignal) => Promise<{ messageId: string | null; text: string }>);
  rewrite: false | ((request, on: { onText(text: string): void }, signal: AbortSignal) => Promise<{ html: string }>);
  altText: false | ((request: AiAltTextRequest, signal: AbortSignal) => Promise<{ alt: string }>);
  conversation?: {
    settleReplay(templateId: string, messageId: string, outcome: AiReplayOutcome): Promise<void>;
    list(templateId: string): Promise<AiChatMessage[]>;
    clear: false | ((templateId: string) => Promise<void>);
    undo: false | ((templateId: string, messageId: string, context: { sessionId: string }) => Promise<AiReplay>);
    redo: false | ((templateId: string, messageId: string, context: { sessionId: string }) => Promise<AiReplay>);
  };
}

type AiReplay = { operations: Operation[]; replayId: string } | { applied: { batchId: string; revision: number } };
interface AiReplayOutcome {
  replayId: string;
  direction: 'undo' | 'redo';
  applied: boolean;
  sessionId: string;
}
```

Anfragen für Chat, Fix, Design und Umformulieren enthalten `templateId`, `content` (das Template im Editor, nachdem ausstehende Änderungen gesendet wurden), `revision` (die Zusammenarbeitsrevision oder `null`), `sessionId` und `mergeTags` (`{ syntax, tags }` oder `null`, wenn keine deklariert sind). Jeder Aufruf erhält ein `AbortSignal`: „Stop“ bricht ihn ab.

### Durchläufe: Chat, Beheben und Design

Ein Durchlauf streamt seine Antwort über `on.onText` und übergibt Änderungen auf einem von zwei Wegen:

- **`on.onOperations(ops)`**: [Operationen](/de/api/operations), die der Editor anwenden soll. Er wendet sie sofort an und antwortet mit `{ applied: true, inverse }` oder mit `{ applied: false, code, opIndex, message }`, wenn sie nicht mehr zum Template passen (jemand hat einen Block geändert oder hält seine Sperre). Die Batches eines Durchlaufs bilden einen Rückgängig-Schritt.
- **`on.onApplied({ batchId, revision, operationCount })`**: Ihr Backend hat den Batch bereits auf seine Kopie angewendet. Mit einem [Zusammenarbeits-Provider](/de/backend/collaboration) folgt der Editor der Revision; mit einem reinen Templates-Provider lädt er das Template am Ende des Durchlaufs neu. Ohne beide verweigert er den Batch.

`chat` sendet `message` und `selectedBlockId` (nur einen Block, den Ihr Backend kennt), `fixFinding` die unten beschriebene Lint-Projektion, `design` ein Bild oder eine PDF (`file`, `fileKind`) und einen optionalen `prompt`.

### Mit KI beheben

`fixFinding` erhält `finding: { ruleId, message, suggestion, reference, blockId, excerpt? }`, die JSON-serialisierbare Projektion eines [Lint-Befunds](/de/quality/). `severity`, `clients` und die lokale `fix`-Funktion werden nie gesendet. Alle Felder sind unvertrauenswürdige Diagnosedaten, keine Anweisungen; das Modell darf den `reference`-Link nicht abrufen.

Das Issues-Panel bietet **Mit KI beheben** für diese Regel-IDs an, wenn der Befund keine deterministische `fix`-Funktion hat, `fixFinding` eine Funktion ist und ein Template geladen ist:

- `a11y.link-vague-text`
- `a11y.button-vague-label`
- `a11y.link-empty`
- `a11y.text-all-caps`
- `a11y.missing-preheader`
- `deliverability.link-text-domain-mismatch`
- `deliverability.low-text`

Der Editor zeigt eine Schaltfläche pro `ruleId`/`blockId`-Paar, unabhängig vom Schweregrad. Die Fix-Schaltflächen sind während KI-Bearbeitungen deaktiviert; während unabhängiger Alt-Text-Entwürfe können Sie weiterhin Fixes starten; der laufende Fix zeigt **Wird behoben…** und **Stoppen**. Der Durchlauf bleibt ein Undo-Schritt mit Verlaufstyp `fix`. Erst die nächste, um 500 ms verzögerte Lint-Aktualisierung entscheidet über die Behebung: Bleibt ein Treffer für das Paar, erscheint **Nach der Korrektur weiterhin markiert**. Das ist keine Aussage über einzelne Vorkommen innerhalb eines Blocks.

Bei Domain-Abweichungen wird nur der sichtbare Linktext in beschreibende Wörter umgeschrieben, nie das `href`. Bei zu wenig Text (`blockId: null`) wird Text im E-Mail-Inhalt aus vorhandenen Fakten ergänzt, nicht im Alt-Text oder Preheader. `a11y.missing-preheader` setzt über `updateSettings` einen `preheaderText` mit höchstens 100 Zeichen aus dem einleitenden Inhalt.

### Alt-Text

`altText(request, signal)` liefert `{ alt: string }` für ein Bild, ohne den Inhalt zu ändern oder einen Chat-Verlauf anzulegen. Die Anfrage ist `AiAltTextRequest` aus `@templatical/types`:

```ts
export interface AiAltTextRequest {
  templateId: string;
  sessionId: string;
  blockId: string;
  image: { url: string };
  currentAlt: string | null;
  linkHref: string | null;
  nearbyText: string;
  locale: string;
  maxLength: number;
}
```

Das Bild erreicht das Modell per URL. Der Modellanbieter ruft sie ab; Ihr Backend muss daher Template und Block autorisieren und private oder signierte Medien auflösen. `currentAlt` ist bei leerem Alt-Text oder dekorativen Bildern `null`; `linkHref` stammt aus `linkUrl`. `nearbyText` enthält den nächsten Klartext vor und nach dem Bild in seiner Spalte, ersatzweise in seinem Abschnitt, begrenzt auf 2.000 Codepoints. `locale` ist die Sprache des Templates.

`maxLength` ist der wirksame Accessibility-Lint-Schwellwert `altMaxLength`: eine Ganzzahl von 1 bis 1.000, Standard 125 bei fehlendem oder ungültigem Wert oder deaktiviertem Lint. Gezählt werden UTF-16-Einheiten (`string.length`). Verwenden Sie den Anfragewert mit `checkAltText` in Ihrem Backend.

Das Issues-Panel bietet **Alt-Text schreiben** einmal je Bild für `a11y.img-missing-alt`, `a11y.img-alt-is-filename`, `a11y.img-alt-too-long` und `a11y.img-linked-no-context` an. Die Inline-Prüfung enthält einen bearbeitbaren Entwurf. **Übernehmen** schreibt `{ alt, decorative: false }`; **Als dekorativ markieren** schreibt `{ alt: "", decorative: true }`; **Abbrechen** und Escape schreiben nichts. Ein leerer `alt` allein löst weiterhin `img-missing-alt` aus. Der Renderer erzwingt bei dekorativen Bildern `alt=""` und `role="presentation"`.

Entwürfe laufen unabhängig, lassen sich stoppen und werden beim Template-Wechsel oder beim Zerstören des Editors abgebrochen. Das Anwenden nutzt einen KI-Batch und einen Rückgängig-Schritt, bei Bedarf in Teile mit 100 Operationen aufgeteilt; mit Zusammenarbeit ist es der Batch der Person mit `origin: 'ai'`. Beides legt keinen Chat-Verlauf an. `altText: false` blendet die Aktion aus; über HTTP gilt `features: { altText: false }`.

Wenn mindestens zwei unterschiedliche Bilder Alt-Text-Befunde haben, öffnet **Fehlende Alt-Texte schreiben ({count})** eine gemeinsame Prüfung in Dokumentreihenfolge mit höchstens 3 gleichzeitigen Provider-Aufrufen. Prüfen Sie jedes Vorschaubild und den bearbeitbaren Entwurf, markieren Sie bei Bedarf dekorative Bilder und wählen Sie die zu übernehmenden Zeilen aus. **Stoppen** bricht laufende Entwürfe ab und lässt noch nicht entworfene Zeilen bearbeitbar. Vor **Ausgewählte übernehmen ({count})** wird nichts geschrieben; die ausgewählten Zeilen werden in einem Batch mit einem Rückgängig-Schritt angewendet. **Abbrechen** und Escape schreiben nichts.

### Umformulieren

`rewrite` erhält das `html` eines Absatzes und ein `preset` (`shorten`, `expand`, `friendlier`, `formal`, `fixGrammar`, `translate` mit einer `language`), eine `instruction` oder beides. Es streamt den Text für eine Live-Vorschau und liefert das fertige HTML.

### Einstiegsanfragen

Ein Chat ohne Nachrichten zeigt drei statische, lokalisierte Einstiegsanfragen für eine Vorlage ohne Blöcke und vier für eine Vorlage mit Blöcken. Ein Klick sendet den angezeigten Text als Chat-Nachricht. Die Anfragen benötigen keinen Modellaufruf und lassen sich nicht durch den Integrator überschreiben.

### Inhaltsprüfungen

Der deterministische Linter meldet konkrete Inhalts-, Client- und Größenbefunde. Er sagt die Platzierung im Posteingang nicht voraus. Siehe [Zustellbarkeit](/de/quality/deliverability/) und [Kompatibilität](/de/quality/compatibility/).

### Verlauf

`conversation` ist optional. Damit lädt der Chat beim Öffnen gespeicherte Nachrichten; „Undo“ und „Redo“ einer Nachricht rufen Ihr Backend auf. Es antwortet mit anzuwendenden Operationen (`{ operations, replayId }`) oder einem bereits angewendeten Batch (`{ applied: { batchId, revision } }`). Ohne `conversation` bleibt der Chat für die Sitzung im Speicher, und „Undo“ einer Nachricht wendet die eigene Inverse des Durchlaufs an. Hat jemand die betroffenen Blöcke inzwischen geändert, wird dies verweigert.

Nach Operationen bestätigt der Editor das Ergebnis mit `settleReplay(templateId, messageId, { replayId, direction, applied, sessionId })`. Ändern Sie `undone` erst bei `applied: true`; bei `applied: false` oder ohne Bestätigung bleibt der Zustand erhalten. Jede `replayId` wird nur einmal abgeschlossen; weitere Bestätigungen sind wirkungslos. Ein serverseitig angewendeter Batch (`{ applied }`) wird nicht bestätigt. Schlägt die Bestätigung fehl, erreicht der Fehler `onError`, und die lokale Zeile zeigt weiterhin, was am Template angewendet wurde.

## Funktionen steuern

Setzen Sie ein Mitglied auf `false`, entfällt sein Einstiegspunkt: `chat: false` blendet den Assistenten aus, `rewrite: false` die Schaltfläche der Werkzeugleiste, `fixFinding: false` die Schaltflächen „Mit KI beheben“ bei Lint-Befunden, `design: false` Design zu Template. Bei `createHttpAiProvider` übergeben Sie `features: { rewrite: false, conversation: false }`.

## Fehler

Lehnen Sie mit einem `SdkError` ab, dessen `code` der Editor kennt und dessen Nachricht die Nutzenden verstehen:

| `code` | Wann |
| --- | --- |
| `feature_unavailable` | Das Feature ist für diese Person ausgeschaltet |
| `limit_reached` | Ein Kontingent ist aufgebraucht; `details: { limit, resetsAt }` |
| `rate_limited` | Zu viele Anfragen; ein `ThrottledError` mit `retryAfterMs` |
| `ai_turn_running` | Auf diesem Template läuft bereits ein Durchlauf |
| `content_too_large` | Das Template ist für das Modell zu groß |
| `ai_output_invalid` | Die Umformulierung oder Alt-Text-Ausgabe des Modells verletzt die Regeln |
| `ai_provider_error` | Der Modell-Provider ist fehlgeschlagen |

Rückgängig und Wiederholen dürfen mit einem Operationscode (`precondition_failed`, …) als `CollaborationConflict` ablehnen. Ein `AbortError` bedeutet, dass die Person den Aufruf gestoppt hat; er wird nie angezeigt. Der Editor beschreibt jeden Fehler in Worten und reicht ihn auch an `init({ onError })` weiter.

## Im Editor

- **Header:** ein „AI“-Menü mit Assistent und Design zu Template.
- **Chat:** als „AI assistant“ gekennzeichnet („Replies and changes come from AI.“), pro Durchlauf „Applied N changes“ mit „Undo“ und „Redo“, „Stop“ während eines Durchlaufs, „New chat“ und statische Einstiegsanfragen. Cmd/Strg+Z macht einen ganzen Durchlauf rückgängig.
- **Absatz-Werkzeugleiste:** „AI“ mit den Vorgaben, 16 Zielsprachen zum Übersetzen und einer freien Anweisung. Das Ergebnis erscheint als „AI suggestion“, Merge-Tags als Tags und das Markup bereinigt; „Replace“ übernimmt es als eigene Änderung der Person.
- **Design zu Template:** PNG, JPEG, WebP, GIF oder PDF bis 5 MB; der Aufbau ist ein rückgängig machbarer Durchlauf.
- **Leere Arbeitsfläche:** Verknüpfungen zum Assistenten und zu Design zu Template.

KI-Inhalte werden immer als KI gekennzeichnet, wie Artikel 50 des EU AI Act es für Systeme vorsieht, die mit Menschen interagieren.

## Mit Zusammenarbeit

Mit einem [Zusammenarbeits-Provider](/de/backend/collaboration) werden die Operationen der KI als eigene Batches der Person mit `origin: 'ai'` übertragen. Ein Backend, das dies berücksichtigt, sendet den Batch mit einem `ai`-Akteur weiter. Andere Editoren zeigen „AI (for Ada) changed 3 blocks“ mit einem Rahmen um diese Blöcke; der anfragende Editor zeigt nur den Rahmen.

## Events

Fehler erreichen `init({ onError })`. Batches aus einer anderen Sitzung, auch die einer KI, erreichen `init({ onRemoteChange })` wie jeder Zusammenarbeits-Batch.

## Headless-Nutzung

Der Provider ist ein einfaches Objekt: Rufen Sie `chat` oder `rewrite` aus Ihrem eigenen Code mit denselben Anfragen auf, und wenden Sie die Operationen mit `applyOperations` aus `@templatical/types` an. `@templatical/ai-kit/testing` bietet `createMockAiProvider` für Oberflächentests und `runAiProviderConformance` zum Prüfen eines selbst geschriebenen Providers.

## Im Playground

Das **AI**-Setup spielt aufgezeichnete Durchläufe über `createMockAiProvider` ab: kein Modell und keine Schlüssel. Bitten Sie um eine Titeländerung, oder klicken Sie doppelt auf einen Absatz und formulieren Sie ihn um. `?history=1` behält einen Gesprächsverlauf; `?collaboration=1&user=Ada` in zwei Tabs zeigt, wie KI-Änderungen anderswo ankommen.

[Im Playground öffnen](https://play.templatical.com/scenes/ai)

## Prüfen

Öffnen Sie den Assistenten für eine geladene Vorlage ohne Blöcke: Er zeigt drei Einstiegsanfragen. Fügen Sie einen Block hinzu: Er zeigt vier. Ein Klick sendet den angezeigten Text. Prüfen Sie den Provider mit [der Konformitätssuite](/de/api/ai-kit#testen).

Öffnen Sie das Issues-Panel mit einem Befund aus der obigen Liste ohne deterministischen Fix. **Mit KI beheben** sendet die Lint-Projektion; nach der erneuten Prüfung verschwindet der Befund oder zeigt **Nach der Korrektur weiterhin markiert**. Ein Undo nimmt den gesamten Fix zurück.

Öffnen Sie einen Bildbefund und wählen Sie **Alt-Text schreiben**. Bearbeiten und übernehmen Sie den Entwurf, dann wählen Sie Rückgängig: `alt` und `decorative` erhalten ihre vorherigen Werte. **Als dekorativ markieren** entfernt `img-missing-alt` nach der erneuten Lint-Prüfung. Abbrechen lässt das Bild unverändert.
