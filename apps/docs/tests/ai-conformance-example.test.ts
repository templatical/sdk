import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";
import { createHttpAiProvider } from "../../../packages/ai-kit/src/client";
import type { AiWireConformanceOptions } from "../../../packages/ai-kit/src/testing/wire-conformance";
import {
  AI_CONFORMANCE_ALT_TEXT_IMAGE_URL,
  AI_EVAL_TEMPLATES,
} from "../../../packages/ai-kit/src/testing/eval-set";

it("seeds the authenticated template and enables attachment probes in both suites", async () => {
  const source = readFileSync(
    join(import.meta.dirname, "../snippets/check-ai-backend.ts"),
    "utf8",
  );
  const file = ts.createSourceFile(
    "example.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const body = file.statements
    .filter((node) => !ts.isImportDeclaration(node))
    .map((node) => node.getText(file))
    .join("\n");
  const js = ts.transpileModule(body, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  let sent: { content: { blocks: { id: string; src?: string }[] } } | undefined;
  const report = { ok: true, checks: [] };
  const run = new Function(
    "AI_CONFORMANCE_ALT_TEXT_IMAGE_URL",
    "AI_EVAL_TEMPLATES",
    "fetch",
    "process",
    "createHttpAiProvider",
    "runAiProviderConformance",
    "runAiWireConformance",
    "console",
    `return (async () => { ${js} })();`,
  );
  await run(
    AI_CONFORMANCE_ALT_TEXT_IMAGE_URL,
    AI_EVAL_TEMPLATES,
    async (_url: string, init: RequestInit) => {
      expect(new Headers(init.headers).get("Authorization")).toBe(
        "Bearer test-token",
      );
      sent = JSON.parse(init.body as string);
      return Response.json({ id: "disposable-test-template" });
    },
    { env: { AI_TEST_TOKEN: "test-token" } },
    createHttpAiProvider,
    async (provider: ReturnType<typeof createHttpAiProvider>) => {
      expect(provider.chatAttachments).toBe(true);
      expect(provider.conversation).toBeUndefined();
      return report;
    },
    async (options: AiWireConformanceOptions) => {
      expect(options.features).toEqual({
        conversation: false,
        chatAttachments: true,
      });
      return report;
    },
    { log: () => {} },
  );
  expect(
    sent?.content.blocks.find((block) => block.id === "conformance-image"),
  ).toMatchObject({
    src: AI_CONFORMANCE_ALT_TEXT_IMAGE_URL,
  });
});
