import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CollaborationConflict,
  SdkError,
  ThrottledError,
  matchAiRoute,
  type AiChatRequest,
  type AiTurnHandlers,
} from "../src";
import {
  AI_TEMPLATE_CHANGED_MESSAGE,
  createHttpAiProvider,
} from "../src/client";
import {
  fakeFetch,
  jsonResponse,
  sse,
  sseThenHang,
  streamResponse,
} from "./helpers/fake-fetch";

afterEach(() => vi.unstubAllGlobals());

const content = { blocks: [], settings: { width: 600 } } as never;
const base = {
  templateId: "t-1",
  content,
  revision: 4,
  sessionId: "s-1",
  mergeTags: { syntax: "liquid" as const, tags: [] },
};
const chat: AiChatRequest = {
  ...base,
  message: "Hi",
  selectedBlockId: "b-1",
  attachments: [],
};
const ops = [{ op: "deleteBlock" as const, blockId: "b-1" }];

function handlers(overrides: Partial<AiTurnHandlers> = {}) {
  return {
    onText: vi.fn(),
    onOperations: vi.fn(async () => ({ applied: true as const, inverse: [] })),
    onApplied: vi.fn(),
    ...overrides,
  };
}

const provider = (features = {}) =>
  createHttpAiProvider({
    baseUrl: "https://api.example.com/ai/",
    headers: async () => ({ Authorization: "Bearer t0k" }),
    credentials: "include",
    features,
  });

describe.each([
  { feature: "chat", request: chat },
  {
    feature: "fixFinding",
    request: {
      ...base,
      finding: {
        ruleId: "a11y.text-all-caps",
        message: "m",
        suggestion: "s",
        reference: "https://docs.templatical.com/quality/",
        blockId: null,
      },
    },
  },
] as const)(
  "createHttpAiProvider: $feature turn completion",
  ({ feature, request }) => {
    it.each([
      ["missing", {}],
      ["number", { messageId: 7 }],
      ["boolean", { messageId: false }],
      ["object", { messageId: {} }],
      ["array", { messageId: [] }],
    ])("rejects a done event with a %s messageId", async (_label, fields) => {
      fakeFetch(() =>
        streamResponse(
          sse(`data: ${JSON.stringify({ type: "done", ...fields })}\n\n`),
        ),
      );
      await expect(
        (provider()[feature] as Function)(
          request,
          handlers(),
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({
        name: "SdkError",
        message: "AI is unavailable right now. Try again later.",
        statusCode: 502,
        code: "ai_provider_error",
      });
    });

    it("accepts an explicit null messageId without history", async () => {
      fakeFetch(() => streamResponse(sse({ type: "done", messageId: null })));
      await expect(
        (provider()[feature] as Function)(
          request,
          handlers(),
          new AbortController().signal,
        ),
      ).resolves.toEqual({ messageId: null, text: "" });
    });
  },
);

describe("createHttpAiProvider: turns", () => {
  it("rejects a successful turn response without a body as a provider failure", async () => {
    fakeFetch(
      () =>
        new Response(null, {
          headers: {
            "Content-Type": "text/event-stream",
            "Templatical-AI-Wire": "1",
          },
        }),
    );
    const on = handlers();
    await expect(
      (provider().chat as Function)(chat, on, new AbortController().signal),
    ).rejects.toMatchObject({
      name: "SdkError",
      statusCode: 502,
      code: "ai_provider_error",
      message: "AI is unavailable right now. Try again later.",
    });
    expect(on.onText).not.toHaveBeenCalled();
    expect(on.onOperations).not.toHaveBeenCalled();
    expect(on.onApplied).not.toHaveBeenCalled();
  });

  it("posts the wire's body and headers, and plays the stream into the handlers", async () => {
    const seen = fakeFetch(() =>
      streamResponse(
        sse(
          { type: "text", text: "Done" },
          ": ping\n\n",
          { type: "operations", ops },
          { type: "applied", batchId: "b-9", revision: 5, operationCount: 2 },
          { type: "done", messageId: "m-1" },
        ),
      ),
    );
    const on = handlers();

    const result = await (provider().chat as Function)(
      chat,
      on,
      new AbortController().signal,
    );

    expect(result).toEqual({ messageId: "m-1", text: "Done" });
    expect(on.onText).toHaveBeenCalledWith("Done");
    expect(on.onOperations).toHaveBeenCalledWith(ops);
    expect(on.onApplied).toHaveBeenCalledWith({
      batchId: "b-9",
      revision: 5,
      operationCount: 2,
    });
    expect(seen[0].url).toBe(
      "https://api.example.com/ai/templates/t-1/ai/generate",
    );
    expect(seen[0].method).toBe("POST");
    expect(seen[0].headers.get("Templatical-AI-Wire")).toBe("1");
    expect(seen[0].headers.get("X-Templatical-Session")).toBe("s-1");
    expect(seen[0].headers.get("Authorization")).toBe("Bearer t0k");
    expect(seen[0].headers.get("Accept")).toBe("text/event-stream");
    expect(seen[0].body).toEqual({
      message: "Hi",
      selectedBlockId: "b-1",
      mergeTags: { syntax: "liquid", tags: [] },
      content: { blocks: [], settings: { width: 600 } },
      revision: 4,
    });
  });

  it("aborts the request and fails the turn when the editor refuses operations (§4)", async () => {
    let signal: AbortSignal | null = null;
    fakeFetch((request) => {
      signal = request.signal;
      return streamResponse(
        sseThenHang(() => signal, { type: "operations", ops }),
      );
    });
    const on = handlers({
      onOperations: vi.fn(async () => ({
        applied: false as const,
        code: "precondition_failed" as const,
        opIndex: 0,
        message: "Changed.",
      })),
    });

    const turn = (provider().chat as Function)(
      chat,
      on,
      new AbortController().signal,
    );

    await expect(turn).rejects.toBeInstanceOf(CollaborationConflict);
    await expect(turn).rejects.toMatchObject({
      message: AI_TEMPLATE_CHANGED_MESSAGE,
      code: "precondition_failed",
      opIndex: 0,
      statusCode: 409,
    });
    expect(signal!.aborted).toBe(true);
  });

  it("fails with the error event's code, status and details", async () => {
    fakeFetch(() =>
      streamResponse(
        sse({
          type: "error",
          code: "limit_reached",
          message: "You've used this month's AI.",
          limit: "aiMonthly",
          resetsAt: "2026-11-01T00:00:00Z",
        }),
      ),
    );
    const turn = (provider().chat as Function)(
      chat,
      handlers(),
      new AbortController().signal,
    );
    await expect(turn).rejects.toBeInstanceOf(SdkError);
    await expect(turn).rejects.toMatchObject({
      code: "limit_reached",
      statusCode: 403,
      details: { limit: "aiMonthly", resetsAt: "2026-11-01T00:00:00Z" },
    });
  });

  it("maps a refusal before the stream, a 429 to a ThrottledError", async () => {
    fakeFetch(() =>
      jsonResponse(
        {
          message: "Too many AI requests. Try again in a moment.",
          code: "rate_limited",
        },
        429,
        { "Retry-After": "2" },
      ),
    );
    const turn = (provider().chat as Function)(
      chat,
      handlers(),
      new AbortController().signal,
    );
    await expect(turn).rejects.toBeInstanceOf(ThrottledError);
    await expect(turn).rejects.toMatchObject({
      retryAfterMs: 2000,
      code: "rate_limited",
    });
  });

  it("treats a stream that ends without done as the provider's failure", async () => {
    fakeFetch(() => streamResponse(sse({ type: "text", text: "Half" })));
    await expect(
      (provider().chat as Function)(
        chat,
        handlers(),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      code: "ai_provider_error",
      statusCode: 502,
      message: "AI is unavailable right now. Try again later.",
    });
  });

  it("rejects with an AbortError when stopped", async () => {
    let signal: AbortSignal | null = null;
    fakeFetch((request) => {
      signal = request.signal;
      return streamResponse(
        sseThenHang(() => signal, { type: "text", text: "Hi" }),
      );
    });
    const stop = new AbortController();
    const turn = (provider().chat as Function)(
      chat,
      handlers({ onText: () => stop.abort() }),
      stop.signal,
    );
    await expect(turn).rejects.toMatchObject({ name: "AbortError" });
  });

  it("stops before buffered operations when onText aborts a single decoded chunk", async () => {
    fakeFetch(() =>
      streamResponse(
        sse(
          `data: ${JSON.stringify({ type: "text", text: "Hi" })}\n\n` +
            `data: ${JSON.stringify({ type: "operations", ops })}\n\n` +
            `data: ${JSON.stringify({ type: "done", messageId: "m-1" })}\n\n`,
        ),
      ),
    );
    const stop = new AbortController();
    const on = handlers({ onText: vi.fn(() => stop.abort()) });
    const turn = (provider().chat as Function)(chat, on, stop.signal);

    await expect(turn).rejects.toMatchObject({ name: "AbortError" });
    expect(on.onText).toHaveBeenCalledWith("Hi");
    expect(on.onOperations).not.toHaveBeenCalled();
  });

  it("fails the turn with the editor's own error when it refuses a server-applied batch", async () => {
    fakeFetch(() =>
      streamResponse(
        sse(
          { type: "applied", batchId: "b", revision: 2, operationCount: 1 },
          { type: "done", messageId: "m" },
        ),
      ),
    );
    const refusal = new SdkError(
      "Needs a templates provider.",
      undefined,
      "ai_provider_error",
    );
    const turn = (provider().chat as Function)(
      chat,
      handlers({
        onApplied: () => {
          throw refusal;
        },
      }),
      new AbortController().signal,
    );
    await expect(turn).rejects.toBe(refusal);
  });

  it("sends a fix with its finding", async () => {
    const seen = fakeFetch(() =>
      streamResponse(sse({ type: "done", messageId: "m" })),
    );
    const finding = {
      excerpt: "EXCERPT",
      ruleId: "a11y.text-all-caps",
      message: "m",
      suggestion: "s",
      reference: "https://docs.templatical.com/quality/",
      blockId: null,
    };
    await (provider().fixFinding as Function)(
      { ...base, finding },
      handlers(),
      new AbortController().signal,
    );
    expect(seen[0].url).toBe(
      "https://api.example.com/ai/templates/t-1/ai/fix-finding",
    );
    expect(seen[0].body).toEqual({
      finding,
      mergeTags: base.mergeTags,
      content: { blocks: [], settings: { width: 600 } },
      revision: 4,
    });
  });
});

describe("createHttpAiProvider: one-shot features", () => {
  it("rewrites, streaming text, and answers the final html", async () => {
    const seen = fakeFetch(() =>
      streamResponse(
        sse(
          { type: "text", text: "<p>Hey" },
          { type: "text", text: "</p>" },
          { type: "done", html: "<p>Hey</p>" },
        ),
      ),
    );
    const onText = vi.fn();
    const result = await (provider().rewrite as Function)(
      {
        ...base,
        html: "<p>Hi</p>",
        preset: "friendlier",
        language: null,
        instruction: null,
      },
      { onText },
      new AbortController().signal,
    );
    expect(result).toEqual({ html: "<p>Hey</p>" });
    expect(onText.mock.calls).toEqual([["<p>Hey"], ["</p>"]]);
    expect(seen[0].body).toEqual({
      html: "<p>Hi</p>",
      preset: "friendlier",
      language: null,
      instruction: null,
      mergeTags: base.mergeTags,
    });
    expect(seen[0].headers.get("X-Templatical-Session")).toBe(null);
  });
});

describe("createHttpAiProvider: history and features", () => {
  it.each([undefined, null, {}, "messages", 7])(
    "rejects history whose data is not an array: %j",
    async (data) => {
      fakeFetch(() => jsonResponse({ data }));
      await expect(provider().conversation!.list("t-1")).rejects.toMatchObject({
        name: "SdkError",
        statusCode: 502,
        code: "ai_provider_error",
        message: "AI is unavailable right now. Try again later.",
      });
    },
  );

  it.each(["list", "undo", "redo"] as const)(
    "rejects a null JSON history response for %s",
    async (method) => {
      fakeFetch(() => jsonResponse(null));
      const conversation = provider().conversation!;
      const response =
        method === "list"
          ? conversation.list("t-1")
          : (conversation[method] as Function)("t-1", "m-1", {
              sessionId: "s-1",
            });

      await expect(response).rejects.toMatchObject({
        name: "SdkError",
        statusCode: 502,
        code: "ai_provider_error",
      });
    },
  );

  it("sends Undo and Redo with the session the editor passes (D41)", async () => {
    const seen = fakeFetch(() =>
      jsonResponse({ data: { operations: [], replayId: "r-1" } }),
    );
    const ai = provider();
    await (ai.conversation!.undo as Function)("t-1", "m-1", {
      sessionId: "s-7",
    });
    await (ai.conversation!.redo as Function)("t-1", "m-1", {
      sessionId: "s-8",
    });
    expect(seen.map((r) => r.headers.get("X-Templatical-Session"))).toEqual([
      "s-7",
      "s-8",
    ]);
  });

  it("lists, clears, undoes and redoes over JSON", async () => {
    const seen = fakeFetch((request) => {
      if (request.method === "GET")
        return jsonResponse({ data: [{ id: "m-1" }] });
      if (request.method === "DELETE") return jsonResponse(null, 204);
      return request.url.endsWith("/undo")
        ? jsonResponse({ data: { operations: ops, replayId: "r-1" } })
        : jsonResponse({ data: { batchId: "b-2", revision: 7 } });
    });
    const conversation = provider().conversation!;

    expect(await conversation.list("t-1")).toEqual([{ id: "m-1" }]);
    await (conversation.clear as Function)("t-1");
    expect(
      await (conversation.undo as Function)("t-1", "m-1", { sessionId: "s-1" }),
    ).toEqual({ operations: ops, replayId: "r-1" });
    expect(
      await (conversation.redo as Function)("t-1", "m-1", { sessionId: "s-1" }),
    ).toEqual({
      applied: { batchId: "b-2", revision: 7 },
    });
    expect(
      seen.map(
        ({ method, url }) =>
          `${method} ${url.replace("https://api.example.com/ai", "")}`,
      ),
    ).toEqual([
      "GET /templates/t-1/ai/conversation-messages",
      "DELETE /templates/t-1/ai/conversation",
      "POST /templates/t-1/ai/messages/m-1/undo",
      "POST /templates/t-1/ai/messages/m-1/redo",
    ]);
  });

  it("keeps an Undo the template overtook a CollaborationConflict", async () => {
    fakeFetch(() =>
      jsonResponse(
        { message: "Changed since.", code: "precondition_failed", opIndex: 1 },
        409,
      ),
    );
    await expect(
      (provider().conversation!.undo as Function)("t-1", "m-1", {
        sessionId: "s-1",
      }),
    ).rejects.toMatchObject({
      name: "CollaborationConflict",
      code: "precondition_failed",
      opIndex: 1,
    });
  });

  it("turns features off, conversation included", () => {
    const off = provider({ chat: false, rewrite: false, conversation: false });
    expect(off.chat).toBe(false);
    expect(off.rewrite).toBe(false);
    expect(off.chatAttachments).toBe(false);
    expect(off.conversation).toBe(undefined);
  });

  it("fails a network error as the provider's failure, not a TypeError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(
      (provider().chat as Function)(
        chat,
        handlers(),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ name: "SdkError", code: "ai_provider_error" });
  });
});

describe("two-phase replay transport", () => {
  it("settles an encoded replay with the session and only the outcome in JSON", async () => {
    const seen = fakeFetch(() => jsonResponse(null, 204));
    await provider().conversation!.settleReplay("t/1", "m 2", {
      replayId: "r/3",
      direction: "undo",
      applied: false,
      sessionId: "s-9",
    });
    expect(seen[0].url).toBe(
      "https://api.example.com/ai/templates/t%2F1/ai/messages/m%202/replays/r%2F3",
    );
    expect(seen[0].body).toEqual({ direction: "undo", applied: false });
    expect(seen[0].headers.get("X-Templatical-Session")).toBe("s-9");
  });
  it("refuses editor-applied replay without a replay id", async () => {
    fakeFetch(() => jsonResponse({ data: { operations: [] } }));
    await expect(
      (provider().conversation!.undo as Function)("t", "m", { sessionId: "s" }),
    ).rejects.toMatchObject({ code: "ai_provider_error" });
  });
});

it("delivers received applied facts after Stop while suppressing buffered text and operations", async () => {
  fakeFetch(() =>
    streamResponse(
      sse(
        [
          { type: "text", text: "First" },
          { type: "text", text: "Ignored" },
          { type: "operations", ops },
          { type: "applied", batchId: "a", revision: 2, operationCount: 1 },
          { type: "done", messageId: null },
        ]
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join(""),
      ),
    ),
  );
  const stop = new AbortController();
  const on = handlers({ onText: vi.fn(() => stop.abort()) });
  await expect(
    (provider().chat as Function)(chat, on, stop.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(on.onText.mock.calls).toEqual([["First"]]);
  expect(on.onOperations).not.toHaveBeenCalled();
  expect(on.onApplied).toHaveBeenCalledWith({
    batchId: "a",
    revision: 2,
    operationCount: 1,
  });
});

describe("createHttpAiProvider: transport edge cases", () => {
  it.each([new TypeError("broken stream"), "broken stream"])(
    "maps an unreadable stream rejection to the provider error: %s",
    async (error) => {
      fakeFetch(() =>
        streamResponse(
          new ReadableStream({
            start(controller) {
              controller.error(error);
            },
          }),
        ),
      );
      await expect(
        (provider().chat as Function)(
          chat,
          handlers(),
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({
        name: "SdkError",
        message: "AI is unavailable right now. Try again later.",
        statusCode: 502,
        code: "ai_provider_error",
      });
    },
  );

  it("rejects history whose response is not JSON", async () => {
    fakeFetch(
      () =>
        new Response("{", { headers: { "Content-Type": "application/json" } }),
    );
    await expect(provider().conversation!.list("t-1")).rejects.toMatchObject({
      name: "SdkError",
      message: "AI is unavailable right now. Try again later.",
      statusCode: 502,
      code: "ai_provider_error",
    });
  });

  it("disables every requested feature", () => {
    expect(
      provider({
        altText: false,
        chat: false,
        fixFinding: false,
        chatAttachments: false,
        rewrite: false,

        conversation: false,
      }),
    ).toEqual({
      altText: false,
      chat: false,
      fixFinding: false,
      chatAttachments: false,
      rewrite: false,
    });
  });
});

it.each(["score", "suggestions"])(
  "does not match the removed %s route",
  (route) => {
    expect(matchAiRoute("POST", `/templates/t-1/ai/${route}`)).toBe(null);
  },
);

it("opens chat without requesting model starters", async () => {
  const seen = fakeFetch(() =>
    streamResponse(sse({ type: "done", messageId: null })),
  );
  const ai = provider();
  expect("suggestions" in ai).toBe(false);
  expect(seen).toEqual([]);
});

describe("createHttpAiProvider altText", () => {
  const request = {
    templateId: "t-1",
    sessionId: "s-1",
    blockId: "i",
    image: { url: "https://example.com/image.png" },
    currentAlt: null,
    linkHref: null,
    nearbyText: "Shop",
    locale: "en",
    maxLength: 60,
  };
  it("posts only the alt-text body and session header and reads done.alt", async () => {
    const seen = fakeFetch(() =>
      streamResponse(sse({ type: "done", alt: "Shop autumn arrivals" })),
    );
    const ai = provider();
    expect(typeof ai.altText).toBe("function");
    const result = await (ai.altText as Function)(
      request,
      new AbortController().signal,
    );
    expect(result).toEqual({ alt: "Shop autumn arrivals" });
    expect(seen[0].url).toBe(
      "https://api.example.com/ai/templates/t-1/ai/alt-text",
    );
    expect(seen[0].headers.get("X-Templatical-Session")).toBe("s-1");
    const { templateId: _t, sessionId: _s, ...body } = request;
    expect(seen[0].body).toEqual(body);
  });
  it("disables alt text explicitly", () =>
    expect(provider({ altText: false }).altText).toBe(false));
  it.each([{}, { html: "no" }, { alt: 42 }])(
    "refuses a missing or malformed alt result %j",
    async (fields) => {
      fakeFetch(() =>
        streamResponse(
          sse(`data: ${JSON.stringify({ type: "done", ...fields })}\n\n`),
        ),
      );
      await expect(
        (provider().altText as Function)(request, new AbortController().signal),
      ).rejects.toMatchObject({ code: "ai_provider_error" });
    },
  );
});

describe("chat attachment transport", () => {
  it("uses repeated attachment parts, the generate fields and the session header", async () => {
    const seen = fakeFetch(() =>
      streamResponse(sse({ type: "done", messageId: null })),
    );
    await (provider().chat as Function)(
      {
        ...chat,
        attachments: [
          {
            file: new Blob(["png"], { type: "image/png" }),
            kind: "image",
            name: "shot.png",
          },
          {
            file: new Blob(["pdf"], { type: "application/pdf" }),
            kind: "pdf",
            name: "plan.pdf",
          },
        ],
      },
      handlers(),
      new AbortController().signal,
    );
    expect(seen[0].url).toBe(
      "https://api.example.com/ai/templates/t-1/ai/generate",
    );
    expect(seen[0].headers.get("X-Templatical-Session")).toBe("s-1");
    expect(seen[0].headers.get("Content-Type")).toBe(null);
    const form = seen[0].body as FormData;
    expect([...form.keys()]).toEqual([
      "message",
      "selectedBlockId",
      "mergeTags",
      "content",
      "revision",
      "attachment",
      "attachment",
    ]);
    expect(form.get("message")).toBe("Hi");
    expect(form.get("selectedBlockId")).toBe("b-1");
    expect(form.get("mergeTags")).toBe('{"syntax":"liquid","tags":[]}');
    expect(form.get("content")).toBe('{"blocks":[],"settings":{"width":600}}');
    expect(form.get("revision")).toBe("4");
    const files = form.getAll("attachment") as File[];
    expect(files.map((f) => [f.name, f.type])).toEqual([
      ["shot.png", "image/png"],
      ["plan.pdf", "application/pdf"],
    ]);
    expect(await Promise.all(files.map((f) => f.text()))).toEqual([
      "png",
      "pdf",
    ]);
  });
  it("keeps the JSON body byte-identical without attachments", async () => {
    let raw: unknown;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        raw = init.body;
        return streamResponse(sse({ type: "done", messageId: null }));
      }),
    );
    await (provider().chat as Function)(
      chat,
      handlers(),
      new AbortController().signal,
    );
    expect(raw).toBe(
      '{"message":"Hi","selectedBlockId":"b-1","mergeTags":{"syntax":"liquid","tags":[]},"content":{"blocks":[],"settings":{"width":600}},"revision":4}',
    );
  });
  it.each([
    [{}, true],
    [{ chatAttachments: false }, false],
    [{ chat: false }, false],
    [{ chat: false, chatAttachments: true }, false],
  ])("declares attachment support from %j", (features, expected) =>
    expect(provider(features).chatAttachments).toBe(expected),
  );
});
