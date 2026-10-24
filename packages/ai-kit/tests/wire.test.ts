import { describe, expect, it } from "vitest";
import {
  AI_ERROR_MESSAGES,
  AI_ERROR_STATUS,
  AI_LIMITS,
  AI_ROUTES,
  AI_SESSION_HEADER,
  AI_WIRE_HEADER,
  AI_WIRE_VERSION,
  aiRoutePath,
  matchAiRoute,
} from "../src";

describe("the wire", () => {
  it("names its version and session headers", () => {
    expect(AI_WIRE_HEADER).toBe("Templatical-AI-Wire");
    expect(AI_WIRE_VERSION).toBe("1");
    expect(AI_SESSION_HEADER).toBe("X-Templatical-Session");
  });

  it("has the routes including replay settlement, relative to the integrator's base URL", () => {
    expect(
      Object.fromEntries(
        Object.entries(AI_ROUTES).map(([name, { method, path }]) => [
          name,
          `${method} ${path}`,
        ]),
      ),
    ).toEqual({
      generate: "POST /templates/{template}/ai/generate",
      fixFinding: "POST /templates/{template}/ai/fix-finding",
      rewriteText: "POST /templates/{template}/ai/rewrite-text",
      altText: "POST /templates/{template}/ai/alt-text",
      conversationMessages:
        "GET /templates/{template}/ai/conversation-messages",
      undoMessage: "POST /templates/{template}/ai/messages/{message}/undo",
      redoMessage: "POST /templates/{template}/ai/messages/{message}/redo",
      settleReplay:
        "POST /templates/{template}/ai/messages/{message}/replays/{replayId}",
      clearConversation: "DELETE /templates/{template}/ai/conversation",
    });
  });

  it("fills a route's ids, encoded", () => {
    expect(
      aiRoutePath("undoMessage", { template: "tpl 1", message: "m/2" }),
    ).toBe("/templates/tpl%201/ai/messages/m%2F2/undo");
  });

  it("matches a request to its route under any base path", () => {
    expect(
      matchAiRoute("post", "/api/ai/templates/tpl%201/ai/generate"),
    ).toEqual({
      route: "generate",
      template: "tpl 1",
      message: null,
    });
    expect(matchAiRoute("POST", "/templates/t-1/ai/messages/m-9/redo")).toEqual(
      { route: "redoMessage", template: "t-1", message: "m-9" },
    );
    expect(matchAiRoute("GET", "/templates/t-1/ai/generate")).toBe(null);
    expect(matchAiRoute("POST", "/templates/t-1/ai/generate/extra")).toBe(null);
  });

  it("answers each AI code with S7's status and message", () => {
    expect(AI_ERROR_STATUS).toMatchObject({
      feature_unavailable: 403,
      limit_reached: 403,
      rate_limited: 429,
      ai_turn_running: 409,
      content_too_large: 413,
      ai_output_invalid: 422,
      ai_provider_error: 502,
      not_found: 404,
      precondition_failed: 409,
      lock_held: 409,
      invalid_operation: 422,
    });
    expect(AI_ERROR_MESSAGES.ai_provider_error).toBe(
      "AI is unavailable right now. Try again later.",
    );
    expect(AI_ERROR_MESSAGES.rate_limited).toBe(
      "Too many AI requests. Try again in a moment.",
    );
  });

  it("states the request limits", () => {
    expect(AI_LIMITS).toEqual({
      contentMaxBytes: 200_000,
      messageMaxChars: 4000,
      attachmentsMax: 4,
      attachmentMaxBytes: 5 * 1024 * 1024,
      attachmentsTotalMaxBytes: 10 * 1024 * 1024,
      rewriteHtmlMaxChars: 20_000,
      instructionMaxChars: 500,
      mergeTagsMax: 500,
      opsPerBatchMax: 100,
    });
  });
});

it("matches and encodes replay settlement", () => {
  expect(
    aiRoutePath("settleReplay", {
      template: "t/1",
      message: "m 2",
      replayId: "r/3",
    }),
  ).toBe("/templates/t%2F1/ai/messages/m%202/replays/r%2F3");
  expect(
    matchAiRoute("POST", "/templates/t%2F1/ai/messages/m%202/replays/r%2F3"),
  ).toEqual({
    route: "settleReplay",
    template: "t/1",
    message: "m 2",
    replayId: "r/3",
  });
});

it.each([
  "/templates/%ZZ/ai/generate",
  "/templates/t/ai/messages/%/undo",
  "/templates/t/ai/messages/m/replays/%E0%A4",
])("treats malformed route escapes as no route: %s", (path) => {
  expect(matchAiRoute("POST", path)).toBe(null);
});

it.each(["score", "suggestions"])(
  "does not match the removed %s route",
  (route) => {
    expect(matchAiRoute("POST", `/templates/t-1/ai/${route}`)).toBe(null);
  },
);
