# @templatical/ai

> Bring your own AI backend to the [Templatical](https://templatical.com) email editor.

[![npm version](https://img.shields.io/npm/v/@templatical/ai?label=npm&color=cb3837)](https://www.npmjs.com/package/@templatical/ai)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/templatical/sdk/blob/main/LICENSE-MIT)

The editor's AI (a chat that edits the template with Undo, rewrite, scoring with fixes, starter suggestions and design-to-template) runs on an `AiProvider` you pass to `init({ ai })`. This package is everything around that contract, with no LLM SDK and no Node-only API: it runs in Node, Deno, Bun, Workers and the browser.

| Entry | What it is |
|---|---|
| `@templatical/ai` | The wire: routes, headers, events, bodies, error statuses, limits; the contract types |
| `@templatical/ai/client` | `createHttpAiProvider()`: an `AiProvider` over the wire, for the browser |
| `@templatical/ai/server` | Prompts, the `apply_operations` tool, `createEditingSession`, `runEditingTurn`, `aiEventStream`, output checks |
| `@templatical/ai/testing` | `runAiProviderConformance`, `runAiWireConformance`, `createMockAiProvider`, the test set and `runAiEvalSet` |
| `@templatical/ai/prompts/*`, `/schema/*`, `/eval/*` | The prompt files, the JSON schemas and the test set, for backends in any language |

## Install

```bash
npm install @templatical/ai
```

## In the editor

```ts
import { init } from "@templatical/editor";
import { createHttpAiProvider } from "@templatical/ai/client";

await init({
  container: "#editor",
  templates,
  ai: createHttpAiProvider({
    baseUrl: "/api/ai",
    headers: async () => ({ Authorization: `Bearer ${await getToken()}` }),
  }),
});
```

## On your server

See [Bring your own AI backend](https://docs.templatical.com/guide/bring-your-own-ai) for a complete Fetch-API server, model adapters for the Vercel AI SDK, OpenAI and Anthropic, and the wire for other languages.

## License

MIT
