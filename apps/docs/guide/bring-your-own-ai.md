---
title: Bring your own AI backend
description: Serve the editor's AI from your own backend and model with @templatical/ai-kit — a Fetch-API server, model adapters, and how to check it works.
---

# Bring your own AI backend

The editor's [AI](/backend/ai) talks to your backend through `createHttpAiProvider`. This page builds that backend with `@templatical/ai-kit/server` on any Fetch-API runtime (Next.js route handlers, Hono, Cloudflare Workers, Deno, Bun; Express through an adapter) and one model adapter.

## The server

```ts
import { AI_ERROR_MESSAGES } from '@templatical/ai-kit';
import {
  aiErrorResponse,
  aiEventStream,
  aiJsonResponse,
  blockIds,
  buildChatRequest,
  buildDesignRequest,
  buildFixRequest,
  buildRewritePrompt,
  buildRewriteRepairPrompt,
  buildScorePrompt,
  buildSuggestionsPrompt,
  checkRewrite,
  normalizeScoringResult,
  parseSuggestions,
  readAiRequest,
  rewriteInstructions,
  runEditingTurn,
  scoreInstructions,
  SdkError,
  suggestionsInstructions,
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
    case 'score': {
      const body = read.body;
      return aiEventStream(async (stream) => {
        const answer = await complete(scoreInstructions, buildScorePrompt(body), stream.signal);
        stream.send({ type: 'done', result: normalizeScoringResult(answer, blockIds(body.content.blocks)) });
      });
    }
    case 'suggestions': {
      const body = read.body;
      return aiEventStream(async (stream) => {
        const answer = await complete(suggestionsInstructions, buildSuggestionsPrompt(body), stream.signal);
        stream.send({ type: 'done', suggestions: parseSuggestions(answer) });
      });
    }
    default:
      // No stored history here: the editor keeps the chat in memory.
      return aiJsonResponse({ message: 'Not found.', code: 'not_found' }, 404);
  }
}
```

In the editor, turn history off to match: `createHttpAiProvider({ baseUrl: '/api/ai', features: { conversation: false } })`. To store history, keep each turn's messages and `result.batches[].inverse` (last batch first) and implement the conversation routes including `settleReplay`, as described under [History](/backend/ai#history). Authorize the template id and message ids against the signed-in user before answering every AI route, conversation routes included.

With structured output, pass `scoringResultSchema` and `suggestionsSchema` to your model instead of asking for JSON in prose; the kit's checks normalize either.

Set your framework's whole-body request limit to about 6 MB with design uploads, or about 300 kB otherwise. The kit checks content and file sizes after reading them; the framework limit bounds buffering.

## Model adapters

Each adapter maps the kit's neutral messages and tools to one SDK and back. Install only the one you use.

The Vercel AI SDK and OpenAI adapters below are text-only: they do not forward image or PDF uploads to the model. Use this client configuration with either adapter to turn off design-to-template and stored conversation history:

```ts
import { createHttpAiProvider } from '@templatical/ai-kit/client';

const ai = createHttpAiProvider({
  baseUrl: '/api/ai',
  features: { design: false, conversation: false },
});
```

For design-to-template, use the [Anthropic example](#anthropic), which maps image and PDF attachments to the model.

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
            : { role: 'user', content: m.content },
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
                : { role: 'user' as const, content: m.content },
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

(The tool calls arrive with the final message, whole: the kit applies them after the text, as a turn would.)

## Check it

```ts
import { runAiWireConformance, runAiEvalSet, evalTurnWith } from '@templatical/ai-kit/testing';
import { model } from './model';

const wire = await runAiWireConformance({
  baseUrl: 'http://localhost:8787/ai',
  features: { conversation: false, design: false }, // text-only adapters
});
const evals = await runAiEvalSet({ runTurn: evalTurnWith(model), model: 'my-model' });
console.log(wire.ok, `${evals.passed}/${evals.total} (${evals.rate}%)`);
```

The wire suite checks your routes as the editor uses them; the test set runs 32 editing requests on three templates (a prompt-injection case included) against your model and reports how many it gets right. Every eval run calls your model: it costs real tokens.

## Data and responsibility

The AI runs on your provider, under your terms with it. Templatical sends nothing anywhere: the editor talks to your backend only, and your backend decides what reaches which model. The template content, the merge-tag list and the user's prompts go to the model you call; tell your users so in your privacy notice, and pick a provider and region your data-processing agreements cover.

## Other languages

A backend in PHP, Python, Go or Ruby follows [the wire](/api/ai-kit#the-wire) and reads the prompts, schemas and test set from the package's files (`prompts/*.md`, `schema/*.json`, `eval/*.json`), copied as files. Only `eval/` has `MANIFEST.sha256`. `runAiWireConformance`, run from Node, checks it.
