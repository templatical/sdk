---
title: Eigenes KI-Backend anbinden
description: Stellen Sie die KI des Editors über Ihr eigenes Backend und Modell mit @templatical/ai-kit bereit — ein Fetch-API-Server, eigene Modelladapter für Anthropic, OpenAI und das Vercel AI SDK und die Prüfung der Integration.
---

# Eigenes KI-Backend anbinden

Die [KI des Editors](/de/backend/ai) spricht über `createHttpAiProvider` mit Ihrem Backend. Diese Seite baut das Backend mit `@templatical/ai-kit/server` auf einer beliebigen Fetch-API-Laufzeit auf (Next.js Route Handlers, Hono, Cloudflare Workers, Deno, Bun; Express über einen Adapter) und bindet einen Modell-Adapter an.

## Der Server

```ts
import { AI_ERROR_MESSAGES } from '@templatical/ai-kit';
import {
  aiErrorResponse,
  aiEventStream,
  aiJsonResponse,
  buildAltTextRequest,
  buildAltTextRepairRequest,
  checkAltText,
  checkAltTextAnswer,
  buildChatRequest,
  buildFixRequest,
  buildRewritePrompt,
  buildRewriteRepairPrompt,
  checkRewrite,
  readAiRequest,
  rewriteInstructions,
  runEditingTurn,
  SdkError,
  type AiModelAdapter,
} from '@templatical/ai-kit/server';
import { model } from './model'; // one of the model adapters below

async function complete(system: string, prompt: string, signal: AbortSignal, onText?: (t: string) => void) {
  let text = '';
  for await (const part of model.stream({ system, messages: [{ role: 'user', content: prompt }], tools: [], signal })) {
    if (part.type === 'text') {
      text += part.text;
      onText?.(part.text);
    }
  }
  return text;
}

export async function handle(request: Request): Promise<Response> {
  // Authenticate the signed-in user before reading the request.
  let read;
  try {
    read = await readAiRequest(request);
  } catch (error) {
    return aiErrorResponse(error);
  }
  if (!read) return aiJsonResponse({ message: 'Not found.', code: 'not_found' }, 404);
  // Authorize read.template and any message id for this user on every AI route.

  switch (read.route) {
    case 'generate':
    case 'fixFinding': {
      const turn = read;
      return aiEventStream(async (stream) => {
        await runEditingTurn({
          request: {
            content: turn.body.content,
            revision: turn.body.revision,
            mergeTags: turn.body.mergeTags,
            sessionId: turn.sessionId,
            selectedBlockId: turn.route === 'generate' ? turn.body.selectedBlockId : null,
            request:
              turn.route === 'generate'
                ? buildChatRequest(turn.body.message, { hasAttachments: turn.body.attachments.length > 0 })
                : buildFixRequest(turn.body.finding),
            attachments: turn.route === 'generate'
              ? turn.body.attachments.map(({ kind, file }) => ({ kind, mediaType: file.type, data: file }))
              : [],
          },
          model,
          write: stream.send,
          signal: stream.signal,
        });
        stream.send({ type: 'done', messageId: null });
      });
    }
    case 'altText': {
      const body = read.body;
      // Authorize the template and block as on every route. The model provider
      // fetches the image URL; resolve private or signed media in your backend.
      const built = buildAltTextRequest({ ...body, templateId: read.template, sessionId: read.sessionId ?? '' });
      return aiEventStream(async (stream) => {
        let answer = '';
        for await (const part of model.stream({ ...built, tools: [], signal: stream.signal })) {
          if (part.type === 'text') answer += part.text;
        }
        const check = checkAltTextAnswer(answer, { maxLength: body.maxLength });
        if (!check.ok) {
          const repair = buildAltTextRepairRequest(built, answer, check.reason, body.maxLength);
          answer = '';
          for await (const part of model.stream({ ...repair, tools: [], signal: stream.signal })) {
            if (part.type === 'text') answer += part.text;
          }
        }
        stream.send({ type: 'done', alt: checkAltText(answer, { maxLength: body.maxLength }) });
      });
    }
    case 'rewriteText': {
      const body = read.body;
      const prompt = buildRewritePrompt(body);
      return aiEventStream(async (stream) => {
        let check = checkRewrite(await complete(rewriteInstructions, prompt, stream.signal, (text) => stream.send({ type: 'text', text })), body.html, body.mergeTags);
        if (!check.ok) {
          check = checkRewrite(await complete(rewriteInstructions, buildRewriteRepairPrompt(prompt, check.reason), stream.signal), body.html, body.mergeTags);
        }
        if (!check.ok) throw new SdkError(AI_ERROR_MESSAGES.ai_output_invalid, 422, 'ai_output_invalid');
        stream.send({ type: 'done', html: check.html });
      });
    }
    default:
      // No stored history here: the editor keeps the chat in memory.
      return aiJsonResponse({ message: 'Not found.', code: 'not_found' }, 404);
  }
}
```

Schalten Sie im Editor passend dazu den gespeicherten Verlauf aus: `createHttpAiProvider({ baseUrl: '/api/ai', features: { conversation: false } })`. Um den Verlauf zu speichern, bewahren Sie die Nachrichten jedes Durchlaufs und `result.batches[].inverse` auf (letzter Batch zuerst) und implementieren Sie die Gesprächsrouten einschließlich `settleReplay`, wie unter [Verlauf](/de/backend/ai#verlauf) beschrieben. Prüfen Sie bei jeder KI-Route, auch bei Gesprächsrouten, ob die angemeldete Person auf die Template-ID und Nachrichten-IDs zugreifen darf.

Die Generate-Route akzeptiert JSON ohne Anhänge und Multipart mit Anhängen. Setzen Sie im Framework ein Limit für den gesamten Request-Body über 10 MB zuzüglich 200.000 Byte Template-Inhalt und Multipart-Overhead; ohne Chat-Anhänge genügen etwa 300 kB. Das Kit prüft Inhalt und Dateigröße nach dem Einlesen; das Framework-Limit begrenzt das Puffern.

```ts
import { createHttpAiProvider } from '@templatical/ai-kit/client';

const ai = createHttpAiProvider({
  baseUrl: '/api/ai',
  features: { conversation: false },
});
```

Die Import-Verknüpfung nutzt dieselbe Chat-Route; nach der Dateiauswahl sendet die Person die vorausgefüllte Anfrage selbst.

## Modelladapter {#modell-adapter}

`@templatical/ai-kit` enthält einen Adapter pro SDK. Jeder übersetzt die Nachrichten, Tools und Dateien des Kits für sein SDK und zurück. Installieren Sie das Kit und das SDK des Adapters, den Sie importieren. Die SDKs sind optionale Peers; weitere SDKs werden nicht installiert. Speichern Sie eines dieser Beispiele als `model.ts`:

### Anthropic

<<< @/snippets/model-anthropic.ts

### OpenAI

<<< @/snippets/model-openai.ts

### Vercel AI SDK

<<< @/snippets/model-vercel.ts

| Adapter | Import | Installation | Übergabe |
| --- | --- | --- | --- |
| Anthropic | `createAnthropicAdapter` aus `@templatical/ai-kit/adapters/anthropic` | `@anthropic-ai/sdk` | `new Anthropic()` |
| OpenAI | `createOpenAiAdapter` aus `@templatical/ai-kit/adapters/openai` | `openai` | `client`: `new OpenAI()`, `new AzureOpenAI()` oder `new OpenAI({ baseURL })` für einen Server, der Chat Completions implementiert |
| Vercel AI SDK | `createVercelAdapter` aus `@templatical/ai-kit/adapters/vercel` | `ai` und Ihr Provider-Paket | `model`: ein AI-SDK-Modell oder eine Gateway-Modell-ID |

### Adapteroptionen

| Option | Typ | Standard | Adapter |
| --- | --- | --- | --- |
| `client` | Ihr SDK-Client | Erforderlich | Anthropic, OpenAI |
| `model` | `string` (Anthropic, OpenAI) oder ein AI-SDK-`LanguageModel` (Vercel) | Erforderlich; kein Standardmodell | Alle |
| `maxTokens` | `number` | 16.000 für Anthropic; der API-eigene Standard für OpenAI und Vercel | Alle |
| `cache` | `boolean` | `true` | Anthropic |
| `params` | Weitere Request-Felder des SDKs ohne die adaptereigenen Felder in [den Optionstypen](/de/api/ai-kit#modell-adapter) | Keine | Alle |

Alle drei Adapter unterstützen Chat, Fix, Umformulieren und Alt-Text. Sie akzeptieren Bild-Blobs, PDF-Blobs und Bild-URLs, sodass `chatAttachments: true` mit jedem funktioniert.

### Was die Adapter übernehmen

- **Thinking über mehrere Schritte.** Die Anthropic- und Vercel-Adapter geben das Thinking des Modells als `state` zurück. `runEditingTurn` legt es auf der Assistant-Nachricht des Schritts ab, und der Adapter sendet es im nächsten Schritt unverändert zurück. Eine eigene Schleife sollte `state` ebenfalls auf ihren Assistant-Nachrichten behalten. Ohne diesen Zustand funktioniert der Durchlauf weiterhin, aber das Modell erarbeitet seine Überlegungen erneut.
- **Prompt-Caching.** Bei aktiviertem `cache` fordert der Anthropic-Adapter die API auf, das Ende des System-Prompts und den bisherigen Gesprächsverlauf zu cachen. Lesezugriffe erfolgen, wenn eine spätere Anfrage das gecachte Präfix innerhalb der Cache-Lebensdauer wiederholt. `cacheReadInputTokens` und `cacheWriteInputTokens` in `usage` zeigen, was gelesen und geschrieben wurde; `inputTokens` zählt nur die nicht gecachte Eingabe. OpenAI verwaltet seinen Cache selbst; der OpenAI-Adapter meldet diese Lesezugriffe.
- **Fehler:**
  - Ein 429 des Providers führt zu `ThrottledError`; dessen `retryAfterMs` stammt aus `retry-after`.
  - Eine Ablehnung oder ein Inhaltsfilter führt zu `ai_provider_error`.
  - Eine am Tokenlimit abgeschnittene Ausgabe während eines Tool-Aufrufs führt zu `ai_output_invalid`.
  - Jeder andere Provider-Fehler wird unverändert weitergegeben, damit Ihre Logs ihn behalten. Das Protokoll meldet ihn als `ai_provider_error`.

### Grenzen der Adapter

- Eine Anfrage, die das Kontextfenster des Modells überschreitet, meldet `ai_provider_error`, nicht `content_too_large`.
- Der OpenAI-Adapter verwendet Chat Completions und überträgt daher kein Reasoning zwischen Schritten.
- Vertex-AI- und Claude-on-AWS-Clients sind nicht durch die Typtests abgedeckt und werden hier deshalb nicht aufgeführt.
- Beim Vercel-Adapter hängt die PDF-Unterstützung von Ihrem AI-SDK-Provider-Paket ab.

### Eigener Adapter

Jedes andere Modell lässt sich durch Implementieren von `AiModelAdapter` anbinden, dem [Modellvertrag](/de/api/ai-kit#modell-adapter): ein `stream()`, der Text, Tool-Aufrufe, optionalen Zustand und Verbrauchsdaten liefert und `signal` beachtet.

## Backend-Konformität und Modellevaluierung

Die [Testreferenz](/de/api/ai-kit#testen) dokumentiert beide Konformitätssignaturen und alle Optionen (`templateId`, `headers`, `timeoutMs`, `callTimeoutMs`, `features`). Mit einem authentifizierten `POST /api/templates`, der `{ name, content }` annimmt und `{ id }` liefert, prüft dieses Node.js-24-Beispiel eine neue Wegwerf-Vorlage. Speichern Sie es als `check-ai-backend.ts`, setzen Sie `AI_TEST_TOKEN` und führen Sie `node check-ai-backend.ts` aus. `AI_BASE_URL` und `AI_TEMPLATES_URL` überschreiben die URLs. Die Flags passen zum zustandslosen Server oben, mit Chat-Anhängen.

Der Multipart-Chat muss bei einem PNG-Anhang nicht leeren Text liefern; bei fünf Anhängen muss das Backend eine JSON-Antwort mit Status 422 und `message` zurückgeben.

<<< @/snippets/check-ai-backend.ts

Die Alt-Text-Prüfung verwendet `blockId: "conformance-image"` und standardmäßig `AI_CONFORMANCE_ALT_TEXT_IMAGE_URL`, ein Bild ohne Text ([Standard und Überschreibung](/de/api/ai-kit#testen)). Das Beispiel fügt dieses Bild in die Wegwerf-Vorlage ein, damit Ihr Backend die Blockzugehörigkeit prüfen kann. Halten Sie es während der Suite verfügbar; wenden Sie diese Testeinrichtung nicht auf produktive Vorlagen an.

Beide Konformitätssuiten können Tokens verbrauchen und Batches persistieren. Mit aktivem Verlauf werden Replay-Zustände verändert und der Verlauf über `clear` geleert, sofern verfügbar. Entfernen Sie die Testvorlage anschließend über Ihren Speicher. Fehler werden je Prüfung ausgegeben und führen zu einem Exit-Code ungleich null.

Für einen Lauf mit Node.js 24 speichern Sie dieses Beispiel als `evaluate.ts` neben Ihrer `model.ts`. Installieren Sie `@templatical/ai-kit`, `@templatical/types`, `@templatical/quality` und Ihr SDK. Starten Sie Ihr Backend und führen Sie `node evaluate.ts` aus. Der Adapter muss Bild-URLs sowie PNG- und PDF-Anhänge akzeptieren; alle drei eigenen Adapter unterstützen dies.

<<< @/snippets/evaluate-model.ts

Die Protokoll-Suite prüft Ihre Routen so, wie der Editor sie verwendet. Der Testsatz prüft Bearbeitungen, Chat-Anhänge, Alt-Text und Korrekturen von Lint-Befunden gegen Ihr Modell. `lintCheck` gibt die `ruleId`-Werte aus `lintTemplate(content)` zurück; das Kit hängt nicht von `@templatical/quality` ab. `loadFile` liest Anhänge aus dem installierten Paket. Ohne `loadFile` lädt der Runner sie über die öffentliche Release-URL.

Ohne `runAltText` werden Alt-Text-Fälle übersprungen. Ohne `lintCheck` werden Fälle mit einer `lintGone`-Prüfung übersprungen. `skipped` zählt diese Fälle; `total` und `rate` berücksichtigen nur ausgeführte Fälle. Die Standard-Erfolgsgrenze `minPassRate` ist 90; `rate` ist eine abgerundete ganze Prozentzahl.

Die Standard-Bild-URLs haben die Form `https://raw.githubusercontent.com/templatical/sdk/v${version}/packages/ai-kit/eval/${file}` und verwenden die Version von `@templatical/ai-kit`. Für einen unveröffentlichten Build übergeben Sie `evalAltTextWith(model, { imageUrl: (file) => new URL(file, 'https://preview.example.com/eval/').href })` mit Ihrer öffentlichen Fixture-URL. Jeder ausgeführte Eval-Fall ruft Ihr Modell auf und kostet Tokens.

## Betreffzeilen

Das SDK hat kein Betreff-Feld und kein Subject-Mitglied im AI-Provider. Der Host verwaltet den Betreff. Rufen Sie `editor.getContent()` auf und senden Sie den Inhalt an Ihr eigenes Backend; dieses fragt Ihr Modell nach Betreffzeilen. Der folgende Browser-Code benötigt einen Container `<div id="editor" style="height: 100vh"></div>` und Ihre Templates-API:

<<< @/snippets/subject-lines-client.ts

Verwenden Sie für `POST /api/subject-lines` diesen Fetch-API-Handler und speichern Sie einen der obigen Adapter daneben als `model.ts`. Die Antwort gehört zum Host, nicht zum Template-JSON oder AI-Verlauf:

<<< @/snippets/subject-lines-server.ts

Prüfen Sie, dass die Antwort `subjectLines` enthält und `editor.getContent()` unverändert bleibt. Der Host zeigt die Vorschläge in seinem Betreff-Feld an; jeder Aufruf verbraucht Modell-Tokens.

## Daten und Verantwortung

Die KI läuft bei Ihrem Provider unter Ihren Vereinbarungen mit ihm. Templatical sendet nichts an andere Stellen: Der Editor spricht nur mit Ihrem Backend, und Ihr Backend entscheidet, was welches Modell erreicht. Template-Inhalt, Merge-Tag-Liste und die Prompts der Nutzenden gehen an das von Ihnen aufgerufene Modell. Informieren Sie Ihre Nutzenden darüber in Ihrer Datenschutzerklärung, und wählen Sie einen Provider und eine Region, die Ihre Vereinbarungen zur Datenverarbeitung abdecken.

## Andere Sprachen

Ein Backend in PHP, Python, Go oder Ruby folgt [dem Protokoll](/de/api/ai-kit#das-protokoll) und liest Prompts und Schemas aus den Paketdateien (`prompts/*.md`, `schema/*.json`). Kopieren Sie den gesamten Ordner `eval/` rekursiv und behalten Sie die relativen Pfade und `MANIFEST.sha256` bei, damit Fälle, Templates, Bilder, Designs und HTML-Quellen enthalten sind. Führen Sie `runAiWireConformance` von Node aus, um die Routen Ihres Backends zu prüfen.
