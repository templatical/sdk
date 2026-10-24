# @templatical/ai-kit

> Bring your own AI backend to the [Templatical](https://templatical.com) email editor.

[![npm version](https://img.shields.io/npm/v/@templatical/ai-kit?label=npm&color=cb3837)](https://www.npmjs.com/package/@templatical/ai-kit)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/templatical/sdk/blob/main/LICENSE-MIT)

The editor's AI (the AI assistant with Undo and attachments, Rewrite, Fix with AI, Write alt text and static localized chat starters) runs on an `AiProvider` you pass to `init({ ai })`. This package is everything around that contract, with no LLM SDK and no Node-only API: it runs in Node, Deno, Bun, Workers and the browser.

| Entry | What it is |
|---|---|
| `@templatical/ai-kit` | The wire: routes, headers, events, bodies, error statuses, limits; the contract types |
| `@templatical/ai-kit/client` | `createHttpAiProvider()`: an `AiProvider` over the wire, for the browser |
| `@templatical/ai-kit/server` | Prompts, the `apply_operations` tool, `createEditingSession`, `runEditingTurn`, `aiEventStream`, output checks |
| `@templatical/ai-kit/testing` | `runAiProviderConformance`, `runAiWireConformance`, `createMockAiProvider`, the test set and `runAiEvalSet` |
| `@templatical/ai-kit/prompts/*`, `/schema/*`, `/eval/*` | The prompt files, the JSON schemas and the test set, for backends in any language |

## Install

```bash
npm install @templatical/ai-kit
pnpm add @templatical/ai-kit
yarn add @templatical/ai-kit
bun add @templatical/ai-kit
```

Choose the command for your package manager.

## In the editor

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";
import { createHttpAiProvider } from "@templatical/ai-kit/client";

const editor = await init({
  container: "#editor",
  templates: {
    load: async (id) => {
      const response = await fetch(`/api/templates/${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error("Template load failed.");
      return response.json();
    },
    create: false,
    save: false,
  },
  ai: createHttpAiProvider({
    baseUrl: "/api/ai",
  }),
});
await editor.load("tpl_123");
```

AI needs a loaded template: the AI assistant and other entry points appear after `editor.load(id)` or `editor.create()` resolves. Omit `ai` to leave the feature out. Fix with AI and Write alt text also require `@templatical/quality` and lint on. The AI kit is MIT; the editor UI is source-available under FSL-1.1-MIT.

## On your server

See [Bring your own AI backend](https://docs.templatical.com/guide/bring-your-own-ai) for a complete Fetch-API server, model adapters for the Vercel AI SDK, OpenAI and Anthropic, and the wire for other languages.

## License

MIT
