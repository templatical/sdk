import { version } from "../package.json";
import * as testing from "../src/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStandInEditor, runAiWireConformance } from "../src/testing";
import { createHttpAiProvider } from "../src/client";
import { createReferenceHandler } from "./helpers/reference-server";
import { serve } from "./helpers/serve";
import { fakeFetch, streamResponse } from "./helpers/fake-fetch";
import { scriptedModel } from "./helpers/scripted-model";

let server: Awaited<ReturnType<typeof serve>> | null = null;
async function within<T>(pending: Promise<T>, ms = 1000): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      pending,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
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
  it("passes the alt-text probe after repairing a self-correcting model answer", async () => {
    const answer =
      "Explore the editor\nWait, I need to output only the final alt text…\nExplore the email editor";
    const model = scriptedModel([
      [{ type: "text", text: answer }],
      [{ type: "text", text: "Explore the email editor" }],
    ]);
    const repair = createReferenceHandler(model);
    const reference = createReferenceHandler();
    let altRequests = 0;
    server = await serve((request) =>
      new URL(request.url).pathname.endsWith("/alt-text") && ++altRequests === 1
        ? repair(request)
        : reference(request),
    );
    const report = await runAiWireConformance({
      baseUrl: server.baseUrl,
      features: {
        chat: false,
        fixFinding: false,
        rewrite: false,
        conversation: false,
        chatAttachments: false,
      },
    });
    expect(report.checks.filter((check) => !check.ok)).toEqual([]);
    expect(report.ok).toBe(true);
    expect(
      report.checks.find(
        (check) => check.name === "altText: answers within maxLength",
      ),
    ).toMatchObject({ ok: true });
    expect(model.calls).toHaveLength(2);
    expect(model.calls[1].messages.slice(-2)).toEqual([
      { role: "assistant", content: answer },
      {
        role: "user",
        content:
          "Your answer had several lines. Reply again with only the alt text: one line of plain text, at most 125 characters.",
      },
    ]);
  });
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
      if (!new URL(request.url).pathname.endsWith("/rewrite-text"))
        return response;
      const headers = new Headers(response.headers);
      headers.set("Content-Type", "application/json");
      return new Response(response.body, { status: response.status, headers });
    });
    const report = await runAiWireConformance({ baseUrl: server.baseUrl });
    expect(report.ok).toBe(false);
    expect(
      report.checks.find(
        (check) => check.name === "streams answer as text/event-stream",
      ),
    ).toMatchObject({ ok: false, detail: expect.stringMatching(/rewrite/) });
  });

  it("bounds a headers callback that never settles", async () => {
    server = await serve(createReferenceHandler());
    const report = await within(
      runAiWireConformance({
        baseUrl: server.baseUrl,
        timeoutMs: 20,
        callTimeoutMs: 20,
        headers: () => new Promise(() => {}),
      }),
    );
    expect(report).not.toBeNull();
    expect(
      report?.checks.find((check) => check.name === "request headers"),
    ).toMatchObject({ ok: false, detail: expect.stringMatching(/20 ms/) });
  });

  it("bounds a probe fetch that never receives response headers", async () => {
    const reference = createReferenceHandler();
    server = await serve((request) =>
      new URL(request.url).pathname.endsWith("/generate")
        ? new Promise(() => {})
        : reference(request),
    );
    const report = await within(
      runAiWireConformance({
        baseUrl: server.baseUrl,
        timeoutMs: 20,
        callTimeoutMs: 20,
      }),
    );
    expect(report).not.toBeNull();
    expect(
      report?.checks.some(
        (check) => !check.ok && /generate.*20 ms/.test(check.detail),
      ),
    ).toBe(true);
  });

  it("bounds a JSON body read that never completes", async () => {
    const reference = createReferenceHandler();
    server = await serve(async (request) => {
      if (
        new URL(request.url).pathname.endsWith("/generate") &&
        request.headers.get("Content-Type")?.startsWith("application/json") &&
        (await request.clone().json()).message === ""
      ) {
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"message":'));
            },
          }),
          {
            status: 422,
            headers: {
              "Content-Type": "application/json",
              "Templatical-AI-Wire": "1",
            },
          },
        );
      }
      return reference(request);
    });
    const report = await within(
      runAiWireConformance({
        baseUrl: server.baseUrl,
        timeoutMs: 20,
        callTimeoutMs: 20,
      }),
    );
    expect(report).not.toBeNull();
    expect(
      report?.checks.some(
        (check) => !check.ok && /generate.*20 ms/.test(check.detail),
      ),
    ).toBe(true);
  });

  it("reports a rejected headers callback and continues the wire checks", async () => {
    server = await serve(createReferenceHandler());
    const report = await runAiWireConformance({
      baseUrl: server.baseUrl,
      headers: async () => {
        throw new Error("headers unavailable");
      },
    });
    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual({
      name: "request headers",
      ok: false,
      detail: "headers unavailable",
    });
    expect(report.checks.map((check) => check.name)).toContain(
      "refuses an invalid turn before the stream with a JSON error",
    );
    expect(report.checks.at(-1)?.name).toBe(
      "errors are SdkErrors with known codes",
    );
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
    expect(report.checks[0]).toMatchObject({
      name: "responses carry Templatical-AI-Wire: 1",
      ok: false,
    });
  });
});

it("settles reference-server replay only once, after editor acceptance", async () => {
  server = await serve(createReferenceHandler());
  const ai = createHttpAiProvider({ baseUrl: server.baseUrl });
  const content = { blocks: [], settings: { width: 600 } } as never;
  const editor = createStandInEditor(content);
  const turn = await (ai.chat as Function)(
    {
      templateId: "settlement",
      content,
      revision: null,
      sessionId: "s",
      mergeTags: { syntax: "liquid" as const, tags: [] },
      message: "Change background",
      selectedBlockId: null,
      attachments: [],
    },
    editor.handlers(),
    new AbortController().signal,
  );
  const conversation = ai.conversation!;
  const undo = await (conversation.undo as Function)(
    "settlement",
    turn.messageId,
    { sessionId: "s" },
  );
  expect(undo.replayId).toEqual(expect.any(String));
  expect((await conversation.list("settlement"))[1].undone).toBe(false);
  await conversation.settleReplay("settlement", turn.messageId, {
    replayId: undo.replayId,
    direction: "undo",
    applied: false,
    sessionId: "s",
  });
  await conversation.settleReplay("settlement", turn.messageId, {
    replayId: undo.replayId,
    direction: "undo",
    applied: true,
    sessionId: "s",
  });
  expect((await conversation.list("settlement"))[1].undone).toBe(false);
  const accepted = await (conversation.undo as Function)(
    "settlement",
    turn.messageId,
    { sessionId: "s" },
  );
  expect(editor.apply(accepted.operations).applied).toBe(true);
  await conversation.settleReplay("settlement", turn.messageId, {
    replayId: accepted.replayId,
    direction: "undo",
    applied: true,
    sessionId: "s",
  });
  expect((await conversation.list("settlement"))[1].undone).toBe(true);
  const redo = await (conversation.redo as Function)(
    "settlement",
    turn.messageId,
    { sessionId: "s" },
  );
  expect(editor.apply(redo.operations).applied).toBe(true);
  await conversation.settleReplay("settlement", turn.messageId, {
    replayId: redo.replayId,
    direction: "redo",
    applied: true,
    sessionId: "s",
  });
  await conversation.settleReplay("settlement", turn.messageId, {
    replayId: accepted.replayId,
    direction: "undo",
    applied: true,
    sessionId: "s",
  });
  expect((await conversation.list("settlement"))[1].undone).toBe(false);
});

it("passes a backend without history or attachments and reports disabled checks as skipped", async () => {
  const reference = createReferenceHandler();
  const requests: string[] = [];
  server = await serve((request) => {
    requests.push(new URL(request.url).pathname);
    if (/conversation|messages/.test(new URL(request.url).pathname))
      return new Response(null, { status: 404 });
    return reference(request);
  });
  const report = await runAiWireConformance({
    baseUrl: server.baseUrl,
    features: { conversation: false, chatAttachments: false },
  });
  expect(report.checks.filter((check) => !check.ok)).toEqual([]);
  expect(report.ok).toBe(true);
  expect(
    report.checks.find((check) => check.name === "conversation: off")?.detail,
  ).toMatch(/skipped/);
  expect(
    report.checks.find((check) => check.name === "chatAttachments: off")
      ?.detail,
  ).toMatch(/skipped/);
  expect(requests.some((path) => /conversation|messages/.test(path))).toBe(
    false,
  );
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
      chatAttachments: false,
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
    {
      name: "rewrite: stops an in-flight call with an AbortError",
      ok: false,
      detail:
        "SdkError ai_provider_error 502: AI is unavailable right now. Try again later.",
    },
    {
      name: "stops on abort with an AbortError",
      ok: false,
      detail:
        "rewrite: stops an in-flight call with an AbortError: SdkError ai_provider_error 502: AI is unavailable right now. Try again later.",
    },
  ]);
  expect(
    report.checks.find(
      (check) => check.name === "responses carry Templatical-AI-Wire: 1",
    ),
  ).toEqual({
    name: "responses carry Templatical-AI-Wire: 1",
    ok: true,
    detail: "2 response(s)",
  });
});

it("sends the configured alt image URL and skips altText when false", async () => {
  // Bodies are keyed by template: a cancelled probe from the first run can
  // still reach the server after that run reports, and must not count
  // against the second.
  const bodies: { template: string; body: unknown }[] = [];
  const reference = createReferenceHandler();
  server = await serve(async (request) => {
    const path = new URL(request.url).pathname;
    if (path.endsWith("/alt-text"))
      bodies.push({
        template: path.split("/templates/")[1]?.split("/")[0] ?? "",
        body: await request.clone().json(),
      });
    return reference(request);
  });
  const report = await runAiWireConformance({
    baseUrl: server.baseUrl,
    templateId: "alt-on",
    altTextImageUrl: "https://example.com/public.png",
  });
  expect(report.ok).toBe(true);
  expect(
    bodies.filter((entry) => entry.template === "alt-on").map((e) => e.body),
  ).toContainEqual(
    expect.objectContaining({
      image: { url: "https://example.com/public.png" },
      maxLength: 125,
    }),
  );
  const off = await runAiWireConformance({
    baseUrl: server.baseUrl,
    templateId: "alt-off",
    features: { altText: false },
  });
  expect(off.ok).toBe(true);
  expect(off.checks.find((c) => c.name === "altText: off")).toMatchObject({
    ok: true,
  });
  expect(bodies.filter((entry) => entry.template === "alt-off")).toEqual([]);
});

it("checks chat attachments and refuses five files before streaming", async () => {
  const reference = createReferenceHandler();
  const counts: number[] = [];
  server = await serve(async (request) => {
    if (request.headers.get("Content-Type")?.startsWith("multipart/form-data"))
      counts.push(
        (await request.clone().formData()).getAll("attachment").length,
      );
    return reference(request);
  });
  const report = await runAiWireConformance({ baseUrl: server.baseUrl });
  expect(report.ok).toBe(true);
  expect(counts).toContain(1);
  expect(counts).toContain(5);
  expect(
    report.checks.find(
      (c) => c.name === "refuses more than 4 attachments with 422",
    ),
  ).toMatchObject({ ok: true });
});

it("maps chat files into model attachments and keeps metadata only in user history", async () => {
  const { referenceModel } = await import("./helpers/reference-server");
  const { editingInstructions } = await import("../src/server");
  const model = referenceModel();
  const inputs: Parameters<typeof model.stream>[0][] = [];
  const handle = createReferenceHandler({
    async *stream(input) {
      inputs.push(input);
      yield* model.stream(input);
    },
  });
  const form = new FormData();
  form.set("message", "Change only the heading using this reference");
  form.set("mergeTags", JSON.stringify({ syntax: "liquid", tags: [] }));
  form.set("content", JSON.stringify({ blocks: [], settings: { width: 600 } }));
  form.append(
    "attachment",
    new Blob(["png"], { type: "image/png" }),
    "shot.png",
  );
  form.append(
    "attachment",
    new Blob(["pdf"], { type: "application/pdf" }),
    "plan.pdf",
  );
  const response = await handle(
    new Request("https://x.test/templates/metadata/ai/generate", {
      method: "POST",
      body: form,
    }),
  );
  expect(await response.text()).toContain('"type":"done"');
  expect(inputs[0].system).toBe(editingInstructions);
  const user = inputs[0].messages[0];
  if (user.role !== "user") throw new Error("Expected a user message");
  expect(user.content).toContain(
    "Attachments are designs or references from the author.",
  );
  expect(user.attachments).toEqual([
    { kind: "image", mediaType: "image/png", data: expect.any(Blob) },
    { kind: "pdf", mediaType: "application/pdf", data: expect.any(Blob) },
  ]);
  expect(
    await Promise.all(
      (user.attachments ?? []).map((a) =>
        a.kind === "image-url" ? a.url : a.data.text(),
      ),
    ),
  ).toEqual(["png", "pdf"]);
  const history = await (
    await handle(
      new Request("https://x.test/templates/metadata/ai/conversation-messages"),
    )
  ).json();
  expect(history.data[0]).toMatchObject({
    role: "user",
    kind: "chat",
    text: "Change only the heading using this reference",
    attachments: [
      { name: "shot.png", kind: "image" },
      { name: "plan.pdf", kind: "pdf" },
    ],
  });
  expect(history.data[1]).not.toHaveProperty("attachments");
});

it("checks live cancellation over the streaming HTTP adapter", async () => {
  server = await serve(createReferenceHandler());
  const report = await runAiWireConformance({ baseUrl: server.baseUrl });
  for (const feature of ["chat", "fixFinding", "rewrite", "altText"]) {
    expect(
      report.checks.find(
        (check) =>
          check.name ===
          `${feature}: stops an in-flight call with an AbortError`,
      ),
    ).toMatchObject({ ok: true });
  }
});


it.each([undefined, "https://example.com/override.png"])("uses the versioned alt-text probe or override %s in wire conformance", async (altTextImageUrl) => {
  const expectedDefault = `https://raw.githubusercontent.com/templatical/sdk/v${version}/packages/ai-kit/eval/images/probe.png`;
  const urls: string[] = [];
  const reference = createReferenceHandler();
  server = await serve(async (request) => {
    if (new URL(request.url).pathname.endsWith("/alt-text")) {
      const body = await request.clone().json() as { image: { url: string } };
      urls.push(body.image.url);
    }
    return reference(request);
  });
  const report = await runAiWireConformance({ baseUrl: server.baseUrl, altTextImageUrl });
  expect(report.ok).toBe(true);
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) expect(url).toBe(altTextImageUrl ?? expectedDefault);
  expect(testing).toHaveProperty("AI_CONFORMANCE_ALT_TEXT_IMAGE_URL", expectedDefault);
});
