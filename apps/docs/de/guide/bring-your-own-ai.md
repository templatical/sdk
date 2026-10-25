---
title: Eigenes KI-Backend anbinden
description: Stellen Sie die KI des Editors über Ihr eigenes Backend und Modell mit @templatical/ai-kit bereit — Fetch-API-Server, Modell-Adapter und Prüfung der Integration.
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
import { model } from './model'; // one of the adapters below

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

## Modell-Adapter

Jeder Adapter übersetzt die neutralen Nachrichten und Tools des Kits für ein SDK und zurück. Installieren Sie nur das SDK, das Sie verwenden.

Alle drei Adapter unterstützen Chat, Fix, Umformulieren und Alt-Text sowie `image-url`-Anhänge für Alt-Text. Nur das Anthropic-Beispiel übergibt Bild- und PDF-Blobs im Chat. Die Chat-Beispiele für OpenAI und Vercel unterstützen nur Text; setzen Sie `chatAttachments: false` und schalten Sie den gespeicherten Gesprächsverlauf aus:

| Adapter | Features | Anhänge |
| --- | --- | --- |
| OpenAI | Chat, Fix, Umformulieren, Alt-Text | Bild-URL |
| Vercel AI SDK | Chat, Fix, Umformulieren, Alt-Text | Bild-URL |
| Anthropic | Chat, Fix, Umformulieren, Alt-Text | Bild-URL, Bild-Blob, PDF-Blob |

```ts
import { createHttpAiProvider } from '@templatical/ai-kit/client';

const ai = createHttpAiProvider({
  baseUrl: '/api/ai',
  features: { chatAttachments: false, conversation: false },
});
```

Für Chat-Anhänge verwenden Sie das [Anthropic-Beispiel](#anthropic), das Bild- und PDF-Blobs an das Modell weitergibt. Die Import-Verknüpfung nutzt dieselbe Chat-Route; nach der Dateiauswahl sendet die Person die vorausgefüllte Anfrage selbst.

### Vercel AI SDK

```ts
import { jsonSchema, streamText, tool } from 'ai';
import type { AiModelAdapter } from '@templatical/ai-kit/server';
import { myModel } from './provider'; // e.g. anthropic('…') or openai('…') from the AI SDK

export const model: AiModelAdapter = {
  async *stream({ system, messages, tools, signal }) {
    const result = streamText({
      model: myModel,
      system,
      abortSignal: signal,
      tools: Object.fromEntries(tools.map((t) => [t.name, tool({ description: t.description, inputSchema: jsonSchema(t.inputSchema) })])),
      messages: messages.map((m) =>
        m.role === 'tool'
          ? { role: 'tool', content: [{ type: 'tool-result', toolCallId: m.toolCallId, toolName: m.name, output: { type: 'text', value: m.content } }] }
          : m.role === 'assistant'
            ? { role: 'assistant', content: [{ type: 'text', text: m.content }, ...(m.toolCalls ?? []).map((c) => ({ type: 'tool-call' as const, toolCallId: c.id, toolName: c.name, input: typeof c.input === 'string' ? JSON.parse(c.input) : c.input }))] }
            : { role: 'user', content: [{ type: 'text', text: m.content }, ...(m.attachments ?? []).map((a) => {
                if (a.kind !== 'image-url') throw new Error('This adapter supports image URLs only. Set chatAttachments: false.');
                return { type: 'image' as const, image: new URL(a.url) };
              })] },
      ),
    });
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') yield { type: 'text', text: part.text };
      else if (part.type === 'tool-call') yield { type: 'tool-call', id: part.toolCallId, name: part.toolName, input: part.input as Record<string, unknown> };
      else if (part.type === 'finish') yield { type: 'usage', inputTokens: part.totalUsage.inputTokens ?? 0, outputTokens: part.totalUsage.outputTokens ?? 0 };
      else if (part.type === 'error') throw part.error;
    }
  },
};
```

### OpenAI

```ts
import OpenAI from 'openai';
import type { AiModelAdapter } from '@templatical/ai-kit/server';

const client = new OpenAI();

export const model: AiModelAdapter = {
  async *stream({ system, messages, tools, signal }) {
    const stream = await client.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL!,
        stream: true,
        stream_options: { include_usage: true },
        tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } })),
        messages: [
          { role: 'system', content: system },
          ...messages.map((m) =>
            m.role === 'tool'
              ? { role: 'tool' as const, tool_call_id: m.toolCallId, content: m.content }
              : m.role === 'assistant'
                ? { role: 'assistant' as const, content: m.content, ...(m.toolCalls?.length ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: typeof c.input === 'string' ? c.input : JSON.stringify(c.input) } })) } : {}) }
                : { role: 'user' as const, content: [{ type: 'text' as const, text: m.content }, ...(m.attachments ?? []).map((a) => {
                    if (a.kind !== 'image-url') throw new Error('This adapter supports image URLs only. Set chatAttachments: false.');
                    return { type: 'image_url' as const, image_url: { url: a.url } };
                  })] },
          ),
        ],
      },
      { signal },
    );
    const calls = new Map<number, { id: string; name: string; args: string }>();
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) yield { type: 'text', text: delta.content };
      for (const call of delta?.tool_calls ?? []) {
        const seen = calls.get(call.index) ?? { id: '', name: '', args: '' };
        calls.set(call.index, { id: call.id ?? seen.id, name: call.function?.name ?? seen.name, args: seen.args + (call.function?.arguments ?? '') });
      }
      if (chunk.usage) yield { type: 'usage', inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens };
    }
    for (const call of calls.values()) yield { type: 'tool-call', id: call.id, name: call.name, input: call.args };
  },
};
```

### Anthropic

```ts
import Anthropic from '@anthropic-ai/sdk';
import { AI_ERROR_MESSAGES } from '@templatical/ai-kit';
import { SdkError, type AiModelAdapter, type AiModelMessage } from '@templatical/ai-kit/server';

const client = new Anthropic();

async function toAnthropic(messages: AiModelMessage[]): Promise<Anthropic.MessageParam[]> {
  const out: Anthropic.MessageParam[] = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      const result: Anthropic.ToolResultBlockParam = { type: 'tool_result', tool_use_id: m.toolCallId, content: m.content };
      const last = out.at(-1);
      // All results of one turn go back in one user message.
      if (last?.role === 'user' && Array.isArray(last.content) && last.content.every((b) => b.type === 'tool_result')) last.content.push(result);
      else out.push({ role: 'user', content: [result] });
    } else if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: [
          ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
          ...(m.toolCalls ?? []).map((c) => ({ type: 'tool_use' as const, id: c.id, name: c.name, input: typeof c.input === 'string' ? JSON.parse(c.input) : c.input })),
        ],
      });
    } else {
      const files = await Promise.all(
        (m.attachments ?? []).map(async (a) => {
          if (a.kind === 'image-url') return { type: 'image', source: { type: 'url', url: a.url } } as const;
          const data = Buffer.from(await a.data.arrayBuffer()).toString('base64');
          return a.kind === 'pdf'
            ? ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } } as const)
            : ({ type: 'image', source: { type: 'base64', media_type: a.mediaType as 'image/png', data } } as const);
        }),
      );
      out.push({ role: 'user', content: [...files, { type: 'text', text: m.content }] });
    }
  }
  return out;
}

export const model: AiModelAdapter = {
  async *stream({ system, messages, tools, signal }) {
    const stream = client.messages.stream(
      {
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        system,
        tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema as Anthropic.Tool.InputSchema })),
        messages: await toAnthropic(messages),
      },
      { signal },
    );
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') yield { type: 'text', text: event.delta.text };
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') throw new SdkError(AI_ERROR_MESSAGES.ai_provider_error, 502, 'ai_provider_error');
    for (const block of final.content) {
      if (block.type === 'tool_use') yield { type: 'tool-call', id: block.id, name: block.name, input: block.input as Record<string, unknown> };
    }
    yield { type: 'usage', inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens };
  },
};
```

(Die Tool-Aufrufe kommen mit der fertigen Nachricht vollständig an: Das Kit wendet sie nach dem Text an, wie bei einem Durchlauf.)

## Backend-Konformität und Modellevaluierung

Die [Testreferenz](/de/api/ai-kit#testen) dokumentiert beide Konformitätssignaturen und alle Optionen (`templateId`, `headers`, `timeoutMs`, `callTimeoutMs`, `features`). Mit einem authentifizierten `POST /api/templates`, der `{ name, content }` annimmt und `{ id }` liefert, prüft dieses Node.js-24-Beispiel eine neue Wegwerf-Vorlage. Speichern Sie es als `check-ai-backend.ts`, setzen Sie `AI_TEST_TOKEN` und führen Sie `node check-ai-backend.ts` aus. `AI_BASE_URL` und `AI_TEMPLATES_URL` überschreiben die URLs. Die Flags passen zum zustandslosen Server und zu einem Chat-Adapter ohne Dateianhänge.

<<< @/snippets/check-ai-backend.ts

Die Alt-Text-Prüfung verwendet `blockId: "conformance-image"` und standardmäßig `AI_CONFORMANCE_ALT_TEXT_IMAGE_URL`, ein Bild ohne Text ([Standard und Überschreibung](/de/api/ai-kit#testen)). Das Beispiel fügt dieses Bild in die Wegwerf-Vorlage ein, damit Ihr Backend die Blockzugehörigkeit prüfen kann. Halten Sie es während der Suite verfügbar; wenden Sie diese Testeinrichtung nicht auf produktive Vorlagen an.

Beide Konformitätssuiten können Tokens verbrauchen und Batches persistieren. Mit aktivem Verlauf werden Replay-Zustände verändert und der Verlauf über `clear` geleert, sofern verfügbar. Entfernen Sie die Testvorlage anschließend über Ihren Speicher. Fehler werden je Prüfung ausgegeben und führen zu einem Exit-Code ungleich null.

Für einen Lauf mit Node.js 24 speichern Sie einen der obigen Adapter als `model.ts` und dieses Beispiel als `evaluate.ts`. Installieren Sie `@templatical/ai-kit`, `@templatical/types`, `@templatical/quality` und das SDK Ihres Modellanbieters. Starten Sie Ihr Backend und führen Sie `node evaluate.ts` aus. Der Adapter muss Bild-URLs sowie PNG- und PDF-Anhänge unterstützen.

```ts
import { readFile } from 'node:fs/promises';
import { lintTemplate } from '@templatical/quality';
import {
  evalAltTextWith,
  evalTurnWith,
  runAiEvalSet,
} from '@templatical/ai-kit/testing';
import { model } from './model.ts';

const evalFolder = new URL('.', import.meta.resolve('@templatical/ai-kit/eval/cases.json'));
const evals = await runAiEvalSet({
  runTurn: evalTurnWith(model),
  runAltText: evalAltTextWith(model),
  lintCheck: (content) => lintTemplate(content).map((issue) => issue.ruleId),
  loadFile: async (file) => new Blob(
    [await readFile(new URL(file, evalFolder))],
    { type: file.endsWith('.pdf') ? 'application/pdf' : 'image/png' },
  ),
  model: 'my-model',
});
for (const result of evals.results) {
  if (!result.ok && !result.skipped) console.error('FAIL', result.name, result.reason);
}
console.log(`${evals.passed}/${evals.total} (${evals.rate}%), skipped: ${evals.skipped}`);
if (!evals.ok) process.exitCode = 1;
```

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
