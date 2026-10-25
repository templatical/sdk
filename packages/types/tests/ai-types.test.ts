import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type AiLimitDetails,
  CollaborationConflict,
  invertOperations,
  SdkError,
  ThrottledError,
} from "../src";

const SRC = resolve(import.meta.dirname, "../src");
const read = (file: string) => readFileSync(resolve(SRC, file), "utf8");

/** `export interface name … {`, up to its closing brace at column 0. */
function interfaceBody(source: string, name: string): string {
  const start = source.search(
    new RegExp(`export interface ${name}(<[^>]*>)?( extends [^{]+)? \\{`),
  );
  expect(start, name).toBeGreaterThan(-1);
  return source.slice(start, source.indexOf("\n}", start));
}

describe("the AI provider contract (BYO contract)", () => {
  const ai = read("ai.ts");

  it("has one false-or-function member per feature, and history as an extra", () => {
    const body = interfaceBody(ai, "AiProvider");
    expect(body).toContain("chatAttachments: false | true;");
    for (const member of [
      /\n  chat:\s+\| false\s+\| \(\(\s*request: AiChatRequest,\s*on: AiTurnHandlers,\s*signal: AbortSignal,?\s*\) => Promise<AiTurnResult>\);/,
      /\n  fixFinding:\s+\| false\s+\| \(\(\s*request: AiFixRequest,\s*on: AiTurnHandlers,\s*signal: AbortSignal,?\s*\) => Promise<AiTurnResult>\);/,
      /\n  rewrite:\s+\| false\s+\| \(\(\s*request: AiRewriteRequest,\s*on: AiRewriteHandlers,\s*signal: AbortSignal,?\s*\) => Promise<\{ html: string \}>\);/,
      /\n  conversation\?: AiConversationProvider;/,
    ]) {
      expect(body).toMatch(member);
    }
  });

  it("lets a backend withhold each part of history", () => {
    const body = interfaceBody(ai, "AiConversationProvider");
    expect(body).toMatch(
      /\n  list\(templateId: string\): Promise<AiChatMessage\[\]>;/,
    );
    expect(body).toMatch(
      /\n  clear: false \| \(\(templateId: string\) => Promise<void>\);/,
    );
    expect(body).toMatch(
      /\n  undo:\s+\| false\s+\| \(\(\s*templateId: string,\s*messageId: string,\s*context: AiReplayContext,?\s*\) => Promise<AiReplay>\);/,
    );
    expect(body).toMatch(
      /\n  redo:\s+\| false\s+\| \(\(\s*templateId: string,\s*messageId: string,\s*context: AiReplayContext,?\s*\) => Promise<AiReplay>\);/,
    );
  });

  it("sends every request the editor's snapshot, revision, session and merge tags", () => {
    const body = interfaceBody(ai, "AiRequestBase");
    for (const field of [
      "templateId: string;",
      "content: TemplateContent;",
      "revision: number | null;",
      "sessionId: string;",
      "mergeTags: AiMergeTags;",
    ]) {
      expect(body).toContain(field);
    }
    expect(interfaceBody(ai, "AiChatRequest")).toContain(
      "selectedBlockId: string | null;",
    );
    expect(interfaceBody(ai, "AiChatRequest")).toContain(
      "attachments: AiChatAttachment[];",
    );
    expect(interfaceBody(ai, "AiChatAttachment")).toContain(
      'kind: "image" | "pdf";',
    );
    expect(interfaceBody(ai, "AiRewriteRequest")).toContain("html: string;");
  });

  it("has a turn hand edits over as operations or as batches already applied", () => {
    const body = interfaceBody(ai, "AiTurnHandlers");
    expect(body).toMatch(/\n  onText\(text: string\): void;/);
    expect(body).toMatch(
      /\n  onOperations\(ops: Operation\[\]\): Promise<AiOperationsResult>;/,
    );
    expect(body).toMatch(/\n  onApplied\(batch: AiAppliedBatch\): void;/);
    expect(ai).toContain("| { applied: true; inverse: Operation[] }");
    expect(ai).toMatch(
      /\| \{\s+applied: false;\s+code: OperationErrorCode;\s+opIndex: number;\s+message: string;\s+\}/,
    );
  });

  it("stores conversation messages in S7's Y7 shape", () => {
    const body = interfaceBody(ai, "AiChatMessage");
    for (const field of [
      "id: string;",
      'role: "user" | "assistant";',
      "kind: AiMessageKind;",
      "text: string;",
      "batches: AiMessageBatch[];",
      "undone: boolean;",
      "createdAt: string;",
    ]) {
      expect(body).toContain(field);
    }
    expect(ai).toContain('export type AiMessageKind = "chat" | "fix";');
  });
});

describe("errors", () => {
  it("carries a refusal's details only when there are some", () => {
    const limited = new SdkError(
      "You've used this month's AI.",
      403,
      "limit_reached",
      {
        limit: "aiMonthly",
        resetsAt: "2026-11-01T00:00:00Z",
      },
    );
    expect(limited.details).toEqual({
      limit: "aiMonthly",
      resetsAt: "2026-11-01T00:00:00Z",
    });
    expect(limited.statusCode).toBe(403);
    expect(limited.code).toBe("limit_reached");

    const plain = new SdkError("Nope.", 500);
    expect("details" in plain).toBe(false);
  });

  it("accepts typed AI limit details", () => {
    const details: AiLimitDetails = {
      limit: "aiMonthly",
      resetsAt: "2026-11-01T00:00:00Z",
    };
    const error = new SdkError(
      "You've used this month's AI.",
      403,
      "limit_reached",
      details,
    );
    expect(error.details).toEqual(details);
  });

  it("a throttled error says when to retry", () => {
    const error = new ThrottledError(
      "Too many AI requests. Try again in a moment.",
      2000,
      "rate_limited",
    );
    expect(error).toBeInstanceOf(SdkError);
    expect(error.name).toBe("ThrottledError");
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe("rate_limited");
    expect(error.retryAfterMs).toBe(2000);
  });

  it("names the AI codes", () => {
    const config = read("config.ts");
    for (const code of [
      "rate_limited",
      "ai_turn_running",
      "ai_output_invalid",
      "ai_provider_error",
      "feature_unavailable",
      "limit_reached",
      "content_too_large",
    ]) {
      expect(config).toContain(`| "${code}"`);
    }
  });

  it("keeps a collaboration refusal an SdkError (guard)", () => {
    const conflict = new CollaborationConflict("Changed.", {
      code: "precondition_failed",
      opIndex: 1,
    });
    expect(conflict).toBeInstanceOf(SdkError);
    expect(conflict.statusCode).toBe(409);
    expect("details" in conflict).toBe(false);
  });
});

describe("collaboration and AI (BY9, BYO contract)", () => {
  const collaboration = read("collaboration.ts");

  it("lets a batch say an AI turn made it", () => {
    expect(interfaceBody(collaboration, "OperationBatch")).toMatch(
      /\n  origin\?: "ai";/,
    );
  });

  it("knows the ai actor", () => {
    expect(interfaceBody(collaboration, "CollaborationActor")).toContain(
      'type: "user" | "guest" | "mcp" | "api" | "ai";',
    );
  });
});

describe("invertOperations, now in @templatical/types", () => {
  it("undoes an update, guarded by what the update left", () => {
    const before = {
      blocks: [{ id: "p1", type: "paragraph", content: "<p>Hi</p>" }],
      settings: { width: 600 },
    } as never;

    expect(
      invertOperations(before, [
        { op: "updateBlock", blockId: "p1", set: { content: "<p>Hello</p>" } },
      ]),
    ).toEqual([
      {
        op: "updateBlock",
        blockId: "p1",
        set: { content: "<p>Hi</p>" },
        expect: { content: "<p>Hello</p>" },
      },
    ]);
  });

  it("undoes an add with a guarded delete, inverses last first", () => {
    const before = { blocks: [], settings: { width: 600 } } as never;
    const block = { id: "b1", type: "spacer", height: 20 } as never;

    expect(
      invertOperations(before, [
        { op: "addBlock", block, parent: null, after: null },
        { op: "updateSettings", set: { width: 640 } },
      ]),
    ).toEqual([
      { op: "updateSettings", set: { width: 600 }, expect: { width: 640 } },
      { op: "deleteBlock", blockId: "b1", expect: { block } },
    ]);
  });
});

it("gives a provider's default ThrottledError its rate_limited code", () => {
  expect(new ThrottledError("Slow down", 1000).code).toBe("rate_limited");
});
