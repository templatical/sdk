import { afterEach, describe, expect, it, vi } from "vitest";
import { createStandInEditor, runAiWireConformance } from "../src/testing";
import { createHttpAiProvider } from "../src/client";
import { createReferenceHandler } from "./helpers/reference-server";
import { serve } from "./helpers/serve";
import { fakeFetch, streamResponse } from "./helpers/fake-fetch";

let server: Awaited<ReturnType<typeof serve>> | null = null;
async function within<T>(pending: Promise<T>, ms = 1000): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([pending, new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    })]);
  } finally {
    clearTimeout(timer!);
  }
}
afterEach(async () => {
  vi.unstubAllGlobals();
  await server?.close();
  server = null;
});

describe("runAiWireConformance", () => {
  it("sends the lint projection through the HTTP wire", async () => {
    const findings: unknown[] = [];
    const reference = createReferenceHandler();
    server = await serve(async (request) => {
      if (new URL(request.url).pathname.endsWith("/fix-finding"))
        findings.push((await request.clone().json()).finding);
      return reference(request);
    });
    const report = await runAiWireConformance({ baseUrl: server.baseUrl });
    expect(report.ok).toBe(true);
    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings)
      expect(finding).toEqual({
        ruleId: "a11y.button-vague-label",
        message: "The button text doesn't say what happens.",
        suggestion: "Say where the button goes.",
        reference:
          "https://docs.templatical.com/quality/accessibility/rule-catalog#buttons",
        blockId: null,
      });
  });
  it("fails the MIME check when only rewrite uses the wrong content type", async () => {
    const reference = createReferenceHandler();
    server = await serve(async (request) => {
      const response = await reference(request);
      if (!new URL(request.url).pathname.endsWith("/rewrite-text")) return response;
      const headers = new Headers(response.headers);
      headers.set("Content-Type", "application/json");
      return new Response(response.body, { status: response.status, headers });
    });
    const report = await runAiWireConformance({ baseUrl: server.baseUrl });
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.name === "streams answer as text/event-stream")).toMatchObject({ ok: false, detail: expect.stringMatching(/rewrite/) });
  });

  it("bounds a headers callback that never settles", async () => {
    server = await serve(createReferenceHandler());
    const report = await within(runAiWireConformance({
      baseUrl: server.baseUrl, timeoutMs: 20, callTimeoutMs: 20,
      headers: () => new Promise(() => {}),
    }));
    expect(report).not.toBeNull();
    expect(report?.checks.find((check) => check.name === "request headers")).toMatchObject({ ok: false, detail: expect.stringMatching(/20 ms/) });
  });

  it("bounds a probe fetch that never receives response headers", async () => {
    const reference = createReferenceHandler();
    server = await serve((request) =>
      new URL(request.url).pathname.endsWith("/generate")
        ? new Promise(() => {})
        : reference(request),
    );
    const report = await within(runAiWireConformance({ baseUrl: server.baseUrl, timeoutMs: 20, callTimeoutMs: 20 }));
    expect(report).not.toBeNull();
    expect(report?.checks.some((check) => !check.ok && /generate.*20 ms/.test(check.detail))).toBe(true);
  });

  it("bounds a JSON body read that never completes", async () => {
    const reference = createReferenceHandler();
    server = await serve(async (request) => {
      if (new URL(request.url).pathname.endsWith("/generate") && (await request.clone().json()).message === "") {
        return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"message":')); } }), {
          status: 422, headers: { "Content-Type": "application/json", "Templatical-AI-Wire": "1" },
        });
      }
      return reference(request);
    });
    const report = await within(runAiWireConformance({ baseUrl: server.baseUrl, timeoutMs: 20, callTimeoutMs: 20 }));
    expect(report).not.toBeNull();
    expect(report?.checks.some((check) => !check.ok && /generate.*20 ms/.test(check.detail))).toBe(true);
  });

  it("reports a rejected headers callback and continues the wire checks", async () => {
    server = await serve(createReferenceHandler());
    const report = await runAiWireConformance({
      baseUrl: server.baseUrl,
      headers: async () => { throw new Error("headers unavailable"); },
    });
    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual({ name: "request headers", ok: false, detail: "headers unavailable" });
    expect(report.checks.map((check) => check.name)).toContain("refuses an invalid turn before the stream with a JSON error");
    expect(report.checks.at(-1)?.name).toBe("errors are SdkErrors with known codes");
  });

  it("passes the reference server", async () => {
    server = await serve(createReferenceHandler());
    const report = await runAiWireConformance({ baseUrl: server.baseUrl });
    expect(report.checks.filter((check) => !check.ok)).toEqual([]);
    expect(report.checks.map((check) => check.name).slice(0, 3)).toEqual([
      "responses carry Templatical-AI-Wire: 1",
      "streams answer as text/event-stream",
      "refuses an invalid turn before the stream with a JSON error",
    ]);
  });

  it("fails a server that leaves out the wire header", async () => {
    const reference = createReferenceHandler();
    server = await serve(async (request) => {
      const response = await reference(request);
      const headers = new Headers(response.headers);
      headers.delete("Templatical-AI-Wire");
      return new Response(response.body, { status: response.status, headers });
    });
    const report = await runAiWireConformance({ baseUrl: server.baseUrl });
    expect(report.ok).toBe(false);
    expect(report.checks[0]).toMatchObject({ name: "responses carry Templatical-AI-Wire: 1", ok: false });
  });
});

it("settles reference-server replay only once, after editor acceptance", async () => {
  server = await serve(createReferenceHandler());
  const ai = createHttpAiProvider({ baseUrl: server.baseUrl });
  const content = { blocks: [], settings: { width: 600 } } as never;
  const editor = createStandInEditor(content);
  const turn = await (ai.chat as Function)({ templateId: "settlement", content, revision: null, sessionId: "s", mergeTags: null, message: "Change background", selectedBlockId: null }, editor.handlers(), new AbortController().signal);
  const conversation = ai.conversation!;
  const undo = await (conversation.undo as Function)("settlement", turn.messageId, { sessionId: "s" });
  expect(undo.replayId).toEqual(expect.any(String));
  expect((await conversation.list("settlement"))[1].undone).toBe(false);
  await conversation.settleReplay("settlement", turn.messageId, { replayId: undo.replayId, direction: "undo", applied: false, sessionId: "s" });
  await conversation.settleReplay("settlement", turn.messageId, { replayId: undo.replayId, direction: "undo", applied: true, sessionId: "s" });
  expect((await conversation.list("settlement"))[1].undone).toBe(false);
  const accepted = await (conversation.undo as Function)("settlement", turn.messageId, { sessionId: "s" });
  expect(editor.apply(accepted.operations).applied).toBe(true);
  await conversation.settleReplay("settlement", turn.messageId, { replayId: accepted.replayId, direction: "undo", applied: true, sessionId: "s" });
  expect((await conversation.list("settlement"))[1].undone).toBe(true);
  const redo = await (conversation.redo as Function)("settlement", turn.messageId, { sessionId: "s" });
  expect(editor.apply(redo.operations).applied).toBe(true);
  await conversation.settleReplay("settlement", turn.messageId, { replayId: redo.replayId, direction: "redo", applied: true, sessionId: "s" });
  await conversation.settleReplay("settlement", turn.messageId, { replayId: accepted.replayId, direction: "undo", applied: true, sessionId: "s" });
  expect((await conversation.list("settlement"))[1].undone).toBe(false);
});

it("passes a backend without history or design and reports disabled checks as skipped", async () => {
  const reference = createReferenceHandler();
  const requests: string[] = [];
  server = await serve((request) => {
    requests.push(new URL(request.url).pathname);
    if (/conversation|messages|generate-from-design/.test(new URL(request.url).pathname)) return new Response(null, { status: 404 });
    return reference(request);
  });
  const report = await runAiWireConformance({ baseUrl: server.baseUrl, features: { conversation: false, design: false } });
  expect(report.checks.filter((check) => !check.ok)).toEqual([]);
  expect(report.ok).toBe(true);
  expect(report.checks.find((check) => check.name === "conversation: off")?.detail).toMatch(/skipped/);
  expect(report.checks.find((check) => check.name === "design: off")?.detail).toMatch(/skipped/);
  expect(requests.some((path) => /conversation|messages|generate-from-design/.test(path))).toBe(false);
});

it("skips the invalid-generate probe when chat is disabled", async () => {
  const reference = createReferenceHandler();
  const requests: string[] = [];
  server = await serve((request) => {
    requests.push(new URL(request.url).pathname);
    return reference(request);
  });
  const report = await runAiWireConformance({
    baseUrl: server.baseUrl,
    features: { chat: false },
  });
  expect(report.checks.filter((check) => !check.ok)).toEqual([]);
  expect(
    report.checks.find(
      (check) =>
        check.name ===
        "refuses an invalid turn before the stream with a JSON error",
    ),
  ).toEqual({
    name: "refuses an invalid turn before the stream with a JSON error",
    ok: true,
    detail: "skipped: chat is disabled",
  });
  expect(requests.filter((path) => /\/ai\/generate$/.test(path))).toEqual([]);
});

it("reports an unreadable response body without leaking the transport TypeError", async () => {
  fakeFetch(() =>
    streamResponse(
      new ReadableStream({
        pull() {
          throw new TypeError("connection lost");
        },
      }),
    ),
  );
  const report = await runAiWireConformance({
    baseUrl: "https://api.example.com",
    features: {
      chat: false,
      fixFinding: false,
      design: false,
      rewrite: true,
      altText: false,
      conversation: false,
    },
  });
  expect(report.checks.filter((check) => !check.ok)).toEqual([
    {
      name: "rewrite: answers",
      ok: false,
      detail:
        "SdkError ai_provider_error 502: AI is unavailable right now. Try again later.",
    },
  ]);
  expect(
    report.checks.find(
      (check) => check.name === "responses carry Templatical-AI-Wire: 1",
    ),
  ).toEqual({
    name: "responses carry Templatical-AI-Wire: 1",
    ok: true,
    detail: "1 response(s)",
  });
});


it("sends the configured alt image URL and skips altText when false", async () => {
  const bodies: unknown[] = [];
  const reference = createReferenceHandler();
  server = await serve(async request => {
    if (new URL(request.url).pathname.endsWith("/alt-text")) bodies.push(await request.clone().json());
    return reference(request);
  });
  const report = await runAiWireConformance({ baseUrl: server.baseUrl, altTextImageUrl: "https://example.com/public.png" });
  expect(report.ok).toBe(true);
  expect(bodies).toContainEqual(expect.objectContaining({ image: { url: "https://example.com/public.png" }, maxLength: 125 }));
  bodies.length = 0;
  const off = await runAiWireConformance({ baseUrl: server.baseUrl, features: { altText: false } });
  expect(off.ok).toBe(true);
  expect(off.checks.find(c => c.name === "altText: off")).toMatchObject({ ok: true });
  expect(bodies).toEqual([]);
});
