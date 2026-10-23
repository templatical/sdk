---
title: KI
description: Chat mit Template-Bearbeitung, Umformulieren und Design zu Template über Ihr eigenes KI-Backend.
---

# KI

Geben Sie dem Editor einen KI-Provider, und Ihre Nutzenden erhalten einen Assistenten, der das geöffnete Template bearbeitet: einen Chat mit Rückgängig, „Rewrite with AI“ in der Absatz-Werkzeugleiste, statische, lokalisierte Einstiegsanfragen und ein Template aus einem Screenshot oder einer PDF. Ihr Backend spricht mit dem Modell — mit Ihren Schlüsseln, Ihren Vereinbarungen zur Datenverarbeitung und Ihren Regeln.

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

Jede Anfrage enthält `templateId`, `content` (das Template im Editor, nachdem ausstehende Änderungen gesendet wurden), `revision` (die Zusammenarbeitsrevision oder `null`), `sessionId` und `mergeTags` (`{ syntax, tags }` oder `null`, wenn keine deklariert sind). Jeder Aufruf erhält ein `AbortSignal`: „Stop“ bricht ihn ab.

### Durchläufe: Chat, Beheben und Design

Ein Durchlauf streamt seine Antwort über `on.onText` und übergibt Änderungen auf einem von zwei Wegen:

- **`on.onOperations(ops)`**: [Operationen](/de/api/operations), die der Editor anwenden soll. Er wendet sie sofort an und antwortet mit `{ applied: true, inverse }` oder mit `{ applied: false, code, opIndex, message }`, wenn sie nicht mehr zum Template passen (jemand hat einen Block geändert oder hält seine Sperre). Die Batches eines Durchlaufs bilden einen Rückgängig-Schritt.
- **`on.onApplied({ batchId, revision, operationCount })`**: Ihr Backend hat den Batch bereits auf seine Kopie angewendet. Mit einem [Zusammenarbeits-Provider](/de/backend/collaboration) folgt der Editor der Revision; mit einem reinen Templates-Provider lädt er das Template am Ende des Durchlaufs neu. Ohne beide verweigert er den Batch.

`chat` sendet `message` und `selectedBlockId` (nur einen Block, den Ihr Backend kennt), `fixFinding` einen Befund (`finding`), `design` ein Bild oder eine PDF (`file`, `fileKind`) und einen optionalen `prompt`.

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

Setzen Sie ein Mitglied auf `false`, entfällt sein Einstiegspunkt: `chat: false` blendet den Assistenten aus, `rewrite: false` die Schaltfläche der Werkzeugleiste, `fixFinding: false` die „Fix“-Schaltflächen bei Befunden, `design: false` Design zu Template. Bei `createHttpAiProvider` übergeben Sie `features: { rewrite: false, conversation: false }`.

## Fehler

Lehnen Sie mit einem `SdkError` ab, dessen `code` der Editor kennt und dessen Nachricht die Nutzenden verstehen:

| `code` | Wann |
| --- | --- |
| `feature_unavailable` | Das Feature ist für diese Person ausgeschaltet |
| `limit_reached` | Ein Kontingent ist aufgebraucht; `details: { limit, resetsAt }` |
| `rate_limited` | Zu viele Anfragen; ein `ThrottledError` mit `retryAfterMs` |
| `ai_turn_running` | Auf diesem Template läuft bereits ein Durchlauf |
| `content_too_large` | Das Template ist für das Modell zu groß |
| `ai_output_invalid` | Die Umformulierung des Modells verletzt auch nach einer Reparatur die Regeln |
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
