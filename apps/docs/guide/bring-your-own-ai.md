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

In the editor, turn history off to match: `createHttpAiProvider({ baseUrl: '/api/ai', features: { conversation: false } })`. To store history, keep each turn's messages and `result.batches[].inverse` (last batch first) and implement the conversation routes including `settleReplay`, as described under [History](/backend/ai#history). Authorize the template id and message ids against the signed-in user before answering every AI route, conversation routes included.

The generate route accepts JSON without attachments and multipart with attachments. Set your framework's whole-body request limit above 10 MB plus the 200,000-byte template content and multipart overhead, or about 300 kB when chat attachments are disabled. The kit checks content and file sizes after reading them; the framework limit bounds buffering.

## Model adapters

Each adapter maps the kit's neutral messages and tools to one SDK and back. Install only the one you use.

All three adapters take chat, fix, rewrite and alt text, and accept `image-url` attachments for alt text. Only the Anthropic example maps image and PDF Blobs for chat. The OpenAI and Vercel chat examples take text only; set `chatAttachments: false` and turn off stored conversation history:

| Adapter | Features | Attachments |
| --- | --- | --- |
| OpenAI | Chat, fix, rewrite, alt text | Image URL |
| Vercel AI SDK | Chat, fix, rewrite, alt text | Image URL |
| Anthropic | Chat, fix, rewrite, alt text | Image URL, image Blob, PDF Blob |

```ts
import { createHttpAiProvider } from '@templatical/ai-kit/client';

const ai = createHttpAiProvider({
  baseUrl: '/api/ai',
  features: { chatAttachments: false, conversation: false },
});
```

For chat attachments, use the [Anthropic example](#anthropic), which maps image and PDF Blobs to the model. The import shortcut uses this same chat route; the author sends the prefilled request after choosing the files.

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

(The tool calls arrive with the final message, whole: the kit applies them after the text, as a turn would.)

## Backend conformance and model evaluation

The [testing reference](/api/ai-kit#testing) documents both conformance signatures and every option (`templateId`, `headers`, `timeoutMs`, `callTimeoutMs`, `features`). With an authenticated `POST /api/templates` that accepts `{ name, content }` and returns `{ id }`, this Node.js 24 example checks a new disposable template. Save it as `check-ai-backend.ts`, set `AI_TEST_TOKEN`, and run `node check-ai-backend.ts`. `AI_BASE_URL` and `AI_TEMPLATES_URL` override the URLs. Its flags match the stateless server and a chat adapter without file attachments.

<<< @/snippets/check-ai-backend.ts

The alt-text probe uses `blockId: "conformance-image"` and defaults to `AI_CONFORMANCE_ALT_TEXT_IMAGE_URL`, a text-free image ([default and override](/api/ai-kit#testing)). The example adds that image to the disposable template so your backend can check block membership. Keep it available during the suite; do not apply this test setup to production templates.

Both conformance suites can spend tokens and persist batches. With conversation enabled they change replay state and clear history through `clear` when available. Remove the test template through your store afterwards. Failures print per check and produce a non-zero exit.

For a Node.js 24 run, save one of the adapters above as `model.ts` and this example as `evaluate.ts`. Install `@templatical/ai-kit`, `@templatical/types`, `@templatical/quality` and your model provider's SDK. Start your backend, then run `node evaluate.ts`. The adapter must support image URLs and PNG and PDF attachments.

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

The wire suite checks your routes as the editor uses them. The eval set checks editing, chat attachments, alt text and lint fixes against your model. `lintCheck` returns the `ruleId` values from `lintTemplate(content)`; the kit has no dependency on `@templatical/quality`. `loadFile` reads attachments from the installed package. Without `loadFile`, the runner fetches them from the public release URL.

Without `runAltText`, alt-text cases are skipped. Without `lintCheck`, cases with a `lintGone` check are skipped. `skipped` counts these cases; `total` and `rate` count only cases that ran. The default `minPassRate` is 90; `rate` is a whole percent rounded down.

Default image URLs use `https://raw.githubusercontent.com/templatical/sdk/v${version}/packages/ai-kit/eval/${file}`, with `@templatical/ai-kit`'s own version. For an unreleased build, pass `evalAltTextWith(model, { imageUrl: (file) => new URL(file, 'https://preview.example.com/eval/').href })` with your public fixture URL. Every eval case that runs calls your model and costs tokens.

## Subject lines

The SDK has no subject field and no subject member on the AI provider. The host owns the subject. Call `editor.getContent()` and post it to your own backend, which asks your model for subject lines. This browser code needs a `<div id="editor" style="height: 100vh"></div>` container and your templates API:

<<< @/snippets/subject-lines-client.ts

Route `POST /api/subject-lines` to this Fetch-API handler and save one of the adapters above beside it as `model.ts`. The response belongs to the host, outside template JSON and AI history:

<<< @/snippets/subject-lines-server.ts

Check that the response contains `subjectLines` and `editor.getContent()` stays unchanged. The host displays the suggestions in its own subject field; each call spends model tokens.

## Data and responsibility

The AI runs on your provider, under your terms with it. Templatical sends nothing anywhere: the editor talks to your backend only, and your backend decides what reaches which model. The template content, the merge-tag list and the user's prompts go to the model you call; tell your users so in your privacy notice, and pick a provider and region your data-processing agreements cover.

## Other languages

A backend in PHP, Python, Go or Ruby follows [the wire](/api/ai-kit#the-wire) and reads prompts and schemas from the package's files (`prompts/*.md`, `schema/*.json`). Copy the entire `eval/` folder recursively, preserving relative paths and `MANIFEST.sha256`, to include the cases, templates, images, designs and HTML sources. Run `runAiWireConformance` from Node to check your backend's routes.
