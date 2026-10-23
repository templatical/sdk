---
title: "@templatical/ai-kit"
description: Das KI-Protokoll, ein HTTP-Provider, ein Server-Kit mit Prompts und Tools und eine Konformitätssuite. MIT.
---

# @templatical/ai-kit

::: code-group

```bash [npm]
npm install @templatical/ai-kit
```

```bash [pnpm]
pnpm add @templatical/ai-kit
```

```bash [yarn]
yarn add @templatical/ai-kit
```

```bash [bun]
bun add @templatical/ai-kit
```

:::

MIT, ohne LLM-SDK und ohne reine Node-API: Web Streams und `fetch`, sodass derselbe Code in Node, Deno, Bun, Cloudflare Workers und Browsern läuft.

## Client

```ts
import { createHttpAiProvider } from '@templatical/ai-kit/client';

const ai = createHttpAiProvider({
  baseUrl: '/api/ai',
  headers: async () => ({ Authorization: `Bearer ${await getToken()}` }),
  credentials: 'include',
  features: { design: false, conversation: false },
});
```

| Option | |
| --- | --- |
| `baseUrl` | Wo die Routen des Protokolls liegen |
| `headers` | Ihre Auth-Header oder eine Funktion (für eine Token-Erneuerung auch asynchron), die pro Anfrage aufgerufen wird |
| `credentials` | Die `credentials` von `fetch` für Cookie-Authentifizierung |
| `features` | `false` schaltet ein Mitglied aus, auch `conversation` |

Der Provider liest den Event-Stream und lehnt mit `SdkError` ab (`ThrottledError` bei 429, `CollaborationConflict` bei einer verweigerten Operation). Da ein Stream nur in eine Richtung läuft, beendet er einen Durchlauf, dessen Operationen der Editor verweigert hat, durch Abbruch der Anfrage: Der Durchlauf lehnt mit dem Code dieser Operation und „The template changed while the AI was working.“ ab.

## Server

```ts
import {
  aiErrorResponse,
  aiEventStream,
  applyOperationsTool,
  buildChatRequest,
  checkRewrite,
  createEditingSession,
  editingInstructions,
  readAiRequest,
  runEditingTurn,
} from '@templatical/ai-kit/server';
```

| Export | |
| --- | --- |
| `editingInstructions` | Der System-Prompt zum Bearbeiten: die Regeln, die [Operationen](/de/api/operations) und das Template-Schema |
| `rewriteInstructions`, `designInstructions` | Die anderen Prompts |
| `buildEditingPrompt`, `buildChatRequest`, `buildFixRequest`, `buildDesignRequest`, `buildRewritePrompt` | Prompts pro Anfrage |
| `applyOperationsTool` | Das einzige Tool: `apply_operations`, dessen `ops` ein JSON-String ist |
| `createEditingSession` | Die Arbeitskopie eines Durchlaufs: prüft jeden Aufruf (Form, die Grenze von 100 Operationen, keine neuen Custom-, Slot- oder Wrapper-Blöcke, deklarierte Merge-Tags, die Engine, eine Größenbegrenzung) und antwortet mit einem Satz, auf den das Modell reagieren kann |
| `runEditingTurn` | Die Referenzschleife über einen `AiModelAdapter`, höchstens drei Modellaufrufe |
| `aiEventStream` | Die Event-Stream-`Response` für jeden Fetch-API-Server |
| `aiErrorResponse`, `aiJsonResponse` | Fehler vor dem Stream und JSON-Antworten, mit dem Header des Protokolls |
| `readAiRequest` | Eine Anfrage des Protokolls, eingelesen und geprüft |
| `checkRewrite`, `buildRewriteRepairPrompt` | Prüfungen der Ausgabe |

Das Kit enthält keine HTML-Bereinigung. Der Editor bereinigt die Vorschau einer Umformulierung und das mit „Replace“ übernommene HTML. HTML-Blöcke, die die KI schreibt, behalten ihr Markup unverändert; befolgen Sie die [Hinweise zur serverseitigen Bereinigung vor dem Speichern oder Versenden](/de/guide/blocks#html).

### Modell-Adapter

`runEditingTurn` ruft Ihr Modell über eine Methode auf:

```ts
interface AiModelAdapter {
  stream(input: {
    system: string;
    messages: AiModelMessage[];
    tools: AiToolDefinition[];
    signal?: AbortSignal;
  }): AsyncIterable<
    | { type: 'text'; text: string }
    | { type: 'tool-call'; id: string; name: string; input: string | Record<string, unknown> }
    | { type: 'usage'; inputTokens: number; outputTokens: number }
  >;
}
```

[Eigenes KI-Backend anbinden](/de/guide/bring-your-own-ai#modell-adapter) enthält Adapter für das Vercel AI SDK, OpenAI und Anthropic. Die Beispiele für Vercel AI SDK und OpenAI verarbeiten nur Text; ihre Client-Konfiguration schaltet Design und den gespeicherten Gesprächsverlauf aus. Das Anthropic-Beispiel verarbeitet auch Bild- und PDF-Anhänge.

## Testen

```ts
import {
  createMockAiProvider,
  runAiEvalSet,
  runAiProviderConformance,
  runAiWireConformance,
} from '@templatical/ai-kit/testing';

const report = await runAiWireConformance({ baseUrl: 'http://localhost:8787/ai' });
for (const check of report.checks) console.log(check.ok ? 'ok ' : 'FAIL', check.name, check.detail);
```

- `runAiProviderConformance(provider)` steuert einen Provider wie der Editor und prüft den Vertrag; `runAiWireConformance({ baseUrl, headers, features })` macht dasselbe über das Protokoll und prüft zusätzlich dessen Regeln — auch für Backends in anderen Sprachen.
- `createMockAiProvider(script)` spielt aufgezeichnete Streams für Ihre Oberflächentests ab; `AI_RECORDINGS` enthält die des Playgrounds.
- `runAiEvalSet({ runTurn, model })` führt den Testsatz mit 32 Fällen aus und meldet die Erfolgsquote; `evalTurnWith(adapter)` erstellt `runTurn` aus der eigenen Schleife des Kits.

## Dateien

`@templatical/ai-kit/prompts/*.md`, `@templatical/ai-kit/schema/*.json` und `@templatical/ai-kit/eval/*.json` (mit `MANIFEST.sha256`) sind Prompts, Schemas und Testsatz als Dateien für ein Backend in einer anderen Sprache. Der System-Prompt zum Bearbeiten besteht aus `editing.md`, dann `"\n\n# Operations\n\n"` und `operations.md`, dann `"\n\n# Template content schema\n\n"` und `template-content.schema.json`.

## Das Protokoll

Jede Anfrage und Antwort enthält `Templatical-AI-Wire: 1`; Durchläufe, Rückgängig, Wiederholen und deren Bestätigung enthalten `X-Templatical-Session`. Ein Cross-Origin-Backend erlaubt beim Preflight `Templatical-AI-Wire`, `X-Templatical-Session` und den Authentifizierungs-Header in `Access-Control-Allow-Headers` und gibt `Templatical-AI-Wire` über `Access-Control-Expose-Headers` frei. Die Routen sind relativ zu Ihrer Basis-URL; `{t}` ist die Template-ID.

| Route | Request | Response |
| --- | --- | --- |
| `POST /templates/{t}/ai/generate` | JSON `{ message, selectedBlockId, mergeTags, content, revision }` | SSE |
| `POST /templates/{t}/ai/fix-finding` | JSON `{ finding, mergeTags, content, revision }` | SSE |
| `POST /templates/{t}/ai/generate-from-design` | multipart: `prompt?`, `image_upload` or `pdf_upload`, `mergeTags` and `content` as JSON strings, `revision` | SSE |
| `POST /templates/{t}/ai/rewrite-text` | JSON `{ html, preset, language, instruction, mergeTags }` | SSE: `text`*, `done { html }` |
| `GET /templates/{t}/ai/conversation-messages` | — | JSON `{ data: AiChatMessage[] }` |
| `POST /templates/{t}/ai/messages/{m}/undo`, `…/redo` | — | JSON `{ data: { operations, replayId } }` or `{ data: { batchId, revision } }` |
| `POST /templates/{t}/ai/messages/{m}/replays/{replayId}` | JSON `{ direction, applied }`, `X-Templatical-Session` | 204 |
| `DELETE /templates/{t}/ai/conversation` | — | 204 |

**Events** sind `data: {json}`-Zeilen mit jeweils einem `type`; `: ping`-Kommentare halten die Verbindung offen. `text { text }`; `operations { ops }` (der Editor wendet sie an); `applied { batchId, revision, operationCount }`; `done { messageId }` (Durchläufe: String oder `null` ohne Verlauf), `done { html }` (Umformulieren); `error { code, message }`. `done` oder `error` ist das letzte Event.

**Fehler vor dem Stream** sind JSON `{ message, code, …details }` mit dem Status des Codes: `feature_unavailable` und `limit_reached` 403, `rate_limited` 429 mit `Retry-After`, `ai_turn_running` 409, `content_too_large` 413, `ai_output_invalid` 422, `ai_provider_error` 502, `not_found` 404, ein Operationscode 409 (`invalid_operation` 422). Ein Validierungsfehler ist ein 422 `{ message }`.

Die `batches` einer Nachricht sind `{ batchId, revision, operationCount }`; ein Batch, den der Editor selbst angewendet hat, hat keine Backend-Revision. Speichern Sie dafür `revision: null`.


`AI_LIMITS.contentMaxBytes` begrenzt den JSON-serialisierten Template-Inhalt auf 200.000 UTF-8-Bytes; `readAiRequest` lehnt größere Inhalte mit `content_too_large` (413) ab. `selectedBlockId` und die Sitzungs-ID sind auf 200 Zeichen begrenzt. Zeichenlimits zählen Unicode-Codepunkte.
