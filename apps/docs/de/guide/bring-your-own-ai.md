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
  checkAltText,
  buildChatRequest,
  buildDesignRequest,
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
    case 'fixFinding':
    case 'generateFromDesign': {
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
                ? buildChatRequest(turn.body.message)
                : turn.route === 'fixFinding'
                  ? buildFixRequest(turn.body.finding)
                  : buildDesignRequest(turn.body.prompt),
            ...(turn.route === 'generateFromDesign'
              ? { attachments: [{ kind: turn.body.fileKind, mediaType: turn.body.file.type, data: turn.body.file }] }
              : {}),
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

Setzen Sie im Framework ein Limit für den gesamten Request-Body: etwa 6 MB mit Design-Uploads, sonst etwa 300 kB. Das Kit prüft Inhalt und Dateigröße nach dem Einlesen; das Framework-Limit begrenzt das Puffern.

## Modell-Adapter

Jeder Adapter übersetzt die neutralen Nachrichten und Tools des Kits für ein SDK und zurück. Installieren Sie nur das SDK, das Sie verwenden.

OpenAI und Vercel unterstützen Chat, Fix, Umformulieren und Alt-Text; Anthropic ergänzt Design. Alle drei Adapter unterstützen `image-url`-Anhänge. Blob-Anhänge für Design bleiben auf Anthropic beschränkt. Verwenden Sie für OpenAI oder Vercel diese Client-Konfiguration, die Design zu Template und den gespeicherten Gesprächsverlauf ausschaltet:

| Adapter | Features | Anhänge |
| --- | --- | --- |
| OpenAI | Chat, Fix, Umformulieren, Alt-Text | Bild-URL |
| Vercel AI SDK | Chat, Fix, Umformulieren, Alt-Text | Bild-URL |
| Anthropic | Chat, Fix, Umformulieren, Alt-Text, Design | Bild-URL, Bild-Blob, PDF-Blob |

```ts
import { createHttpAiProvider } from '@templatical/ai-kit/client';

const ai = createHttpAiProvider({
  baseUrl: '/api/ai',
  features: { design: false, conversation: false },
});
```

Für Design zu Template verwenden Sie das [Anthropic-Beispiel](#anthropic), das Bild- und PDF-Anhänge an das Modell weitergibt.

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
                if (a.kind !== 'image-url') throw new Error('This adapter supports image URLs only. Disable design.');
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
                    if (a.kind !== 'image-url') throw new Error('This adapter supports image URLs only. Disable design.');
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

## Prüfen

```ts
import { runAiWireConformance, runAiEvalSet, evalTurnWith } from '@templatical/ai-kit/testing';
import { model } from './model';

const wire = await runAiWireConformance({
  baseUrl: 'http://localhost:8787/ai',
  features: { conversation: false, design: false }, // adapters without design
});
const evals = await runAiEvalSet({ runTurn: evalTurnWith(model), model: 'my-model' });
console.log(wire.ok, `${evals.passed}/${evals.total} (${evals.rate}%)`);
```

Die Protokoll-Suite prüft Ihre Routen so, wie der Editor sie verwendet. Der Testsatz führt 32 Bearbeitungsanfragen auf drei Templates gegen Ihr Modell aus (einschließlich eines Prompt-Injection-Falls) und meldet, wie viele es richtig beantwortet. Jeder Eval-Lauf ruft Ihr Modell auf und kostet echte Tokens.

## Daten und Verantwortung

Die KI läuft bei Ihrem Provider unter Ihren Vereinbarungen mit ihm. Templatical sendet nichts an andere Stellen: Der Editor spricht nur mit Ihrem Backend, und Ihr Backend entscheidet, was welches Modell erreicht. Template-Inhalt, Merge-Tag-Liste und die Prompts der Nutzenden gehen an das von Ihnen aufgerufene Modell. Informieren Sie Ihre Nutzenden darüber in Ihrer Datenschutzerklärung, und wählen Sie einen Provider und eine Region, die Ihre Vereinbarungen zur Datenverarbeitung abdecken.

## Andere Sprachen

Ein Backend in PHP, Python, Go oder Ruby folgt [dem Protokoll](/de/api/ai-kit#das-protokoll) und liest Prompts, Schemas und Testsatz aus den Paketdateien (`prompts/*.md`, `schema/*.json`, `eval/*.json`), die Sie kopieren können. Nur `eval/` enthält `MANIFEST.sha256`. `runAiWireConformance` prüft es von Node aus.
