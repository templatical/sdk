import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AiProvider } from "../src";
import { createHttpAiProvider } from "../src/client";
import { AI_RECORDINGS, createMockAiProvider, runAiProviderConformance } from "../src/testing";
import { createReferenceHandler } from "./helpers/reference-server";
import { serve } from "./helpers/serve";

const failed = (report: { checks: { name: string; ok: boolean; detail: string }[] }) =>
  report.checks.filter((check) => !check.ok);

const disabled: AiProvider = {
  chat: false, fixFinding: false, design: false, rewrite: false, score: false,
  suggestions: false,
};
const assistant = {
  id: "a-1", role: "assistant", kind: "chat", text: "Done.",
  batches: [{ batchId: "b-1", revision: null, operationCount: 1 }],
  undone: false, createdAt: "2026-10-21T00:00:00Z",
};

async function within<T>(pending: Promise<T>, ms = 200): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([pending, new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    })]);
  } finally {
    clearTimeout(timer!);
  }
}

describe("runAiProviderConformance (the suite tests itself)", () => {
  it("bounds a chat promise that never settles and aborts its signal", async () => {
    let signal: AbortSignal | undefined;
    const report = await within(runAiProviderConformance({
      ...disabled,
      chat: (_request, _handlers, received) => {
        signal ??= received;
        return new Promise(() => {});
      },
    }, { timeoutMs: 20, callTimeoutMs: 20 }));
    expect(report).not.toBeNull();
    expect(report?.checks.find((check) => check.name === "chat: answers")).toMatchObject({
      ok: false, detail: expect.stringMatching(/chat.*20 ms/),
    });
    expect(signal?.aborted).toBe(true);
    expect(report?.checks.at(-1)?.name).toBe("errors are SdkErrors with known codes");
  });

  it("bounds conversation.list even though it receives no signal", async () => {
    const report = await within(runAiProviderConformance({
      ...disabled,
      conversation: { settleReplay: async () => {},
        list: () => new Promise(() => {}),
        undo: false, redo: false, clear: false,
      },
    }, { timeoutMs: 20, callTimeoutMs: 20 }));
    expect(report).not.toBeNull();
    expect(report?.checks.find((check) => check.name === "conversation.list: answers")).toMatchObject({
      ok: false, detail: expect.stringMatching(/conversation.list.*20 ms/),
    });
    expect(report?.checks.at(-1)?.name).toBe("errors are SdkErrors with known codes");
  });

  it("fails the abort check of a rewrite-only provider that ignores its signal", async () => {
    const report = await runAiProviderConformance({ ...disabled, rewrite: async () => ({ html: "<p>Rewritten.</p>" }) }, { timeoutMs: 20 });
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.name === "rewrite: stops on abort with an AbortError")).toMatchObject({ ok: false, detail: expect.stringContaining("resolved") });
  });

  it("checks chat and score aborts independently", async () => {
    const report = await runAiProviderConformance({
      ...disabled,
      chat: async (_request, _handlers, signal) => {
        signal.throwIfAborted();
        return { messageId: null, text: "Done." };
      },
      score: async () => ({ score: 50, categories: {
        spam: { score: 50, findings: [] }, readability: { score: 50, findings: [] },
        bestPractices: { score: 50, findings: [] },
      } }),
    }, { timeoutMs: 20 });
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.name === "chat: stops on abort with an AbortError")?.ok).toBe(true);
    expect(report.checks.find((check) => check.name === "score: stops on abort with an AbortError")?.ok).toBe(false);
  });

  it("probes abort for all six declared features without changing valid passes", async () => {
    const report = await runAiProviderConformance(createMockAiProvider({ ...AI_RECORDINGS, delayMs: 0 }));
    expect(report.ok).toBe(true);
    expect(report.checks.filter((check) => check.name.includes(": stops on abort")).map((check) => [check.name, check.ok])).toEqual([
      ["chat: stops on abort with an AbortError", true],
      ["fixFinding: stops on abort with an AbortError", true],
      ["design: stops on abort with an AbortError", true],
      ["rewrite: stops on abort with an AbortError", true],
      ["score: stops on abort with an AbortError", true],
      ["suggestions: stops on abort with an AbortError", true],
    ]);
  });

  it("clears deadline timers when the calls settle first", async () => {
    vi.useFakeTimers();
    try {
      const report = await runAiProviderConformance({
        ...disabled,
        suggestions: async (_request, signal) => { signal.throwIfAborted(); return ["One"]; },
      }, { timeoutMs: 20 });
      expect(report.ok).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports numeric chat text without throwing and continues the other checks", async () => {
    const report = await runAiProviderConformance({
      ...disabled,
      chat: async (_request, _handlers, signal) => {
        signal.throwIfAborted();
        return { messageId: null, text: 42 } as never;
      },
      suggestions: async (_request, signal) => {
        signal.throwIfAborted();
        return ["Try another change"];
      },
    });
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.name === "chat: streams text and resolves with it")).toMatchObject({
      ok: false, detail: expect.stringContaining("number"),
    });
    expect(report.checks.find((check) => check.name === "suggestions: at most 4 of at most 80 characters")?.ok).toBe(true);
    expect(report.checks.at(-1)).toMatchObject({ name: "errors are SdkErrors with known codes", ok: true });
  });

  it.each([null, undefined, false, 0])("reports a malformed resolved chat result %#", async (result) => {
    const report = await runAiProviderConformance({
      ...disabled,
      chat: async (_request, _handlers, signal) => {
        signal.throwIfAborted();
        return result as never;
      },
    });
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.name === "chat: streams text and resolves with it")?.ok).toBe(false);
    expect(report.checks.at(-1)?.name).toBe("errors are SdkErrors with known codes");
  });

  it("reports a rewrite without html and continues to scoring", async () => {
    const report = await runAiProviderConformance({
      ...disabled,
      rewrite: async () => ({}) as never,
      score: async () => ({ score: 50, categories: {
        spam: { score: 50, findings: [] },
        readability: { score: 50, findings: [] },
        bestPractices: { score: 50, findings: [] },
      } }),
    });
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.name === "rewrite: answers with html")).toMatchObject({
      ok: false, detail: expect.stringContaining("undefined"),
    });
    expect(report.checks.find((check) => check.name === "score: three categories scored 0–100")?.ok).toBe(true);
  });

  it("catches a score check's null-category error and continues", async () => {
    const report = await runAiProviderConformance({
      ...disabled,
      score: async () => ({ score: 50, categories: {
        spam: null, readability: { score: 50, findings: [] },
        bestPractices: { score: 50, findings: [] },
      } }) as never,
      suggestions: async (_request, signal) => {
        signal.throwIfAborted();
        return ["Try another change"];
      },
    });
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.name === "score: three categories scored 0–100")).toMatchObject({
      ok: false, detail: expect.stringMatching(/null.*score|score.*null/),
    });
    expect(report.checks.find((check) => check.name === "suggestions: at most 4 of at most 80 characters")?.ok).toBe(true);
    expect(report.checks.at(-1)?.name).toBe("errors are SdkErrors with known codes");
  });

  it("reports an undefined suggestion rather than treating it as no bad item", async () => {
    const report = await runAiProviderConformance({
      ...disabled,
      suggestions: async (_request, signal) => {
        signal.throwIfAborted();
        return [undefined] as never;
      },
    });
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.name === "suggestions: at most 4 of at most 80 characters")?.ok).toBe(false);
    expect(report.checks.at(-1)?.name).toBe("errors are SdkErrors with known codes");
  });

  it.each([{}, [null], [{ ...assistant, batches: [null] }]])("reports malformed history %# and still checks clear", async (messages) => {
    let cleared = false;
    const report = await runAiProviderConformance({
      ...disabled,
      conversation: { settleReplay: async () => {},
        list: async () => (cleared ? [] : messages) as never,
        undo: false, redo: false,
        clear: async () => { cleared = true; },
      },
    });
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.name === "conversation: lists messages in the Y7 shape")?.ok).toBe(false);
    expect(cleared).toBe(true);
    expect(report.checks.find((check) => check.name === "conversation: clear empties it")?.ok).toBe(true);
    expect(report.checks.at(-1)?.name).toBe("errors are SdkErrors with known codes");
  });

  it.each([42, { operations: null }])("reports malformed replay %# and still checks clear", async (replay) => {
    let cleared = false;
    const report = await runAiProviderConformance({
      ...disabled,
      conversation: { settleReplay: async () => {},
        list: async () => (cleared ? [] : [assistant]) as never,
        undo: async () => replay as never,
        redo: async () => replay as never,
        clear: async () => { cleared = true; },
      },
    });
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.name === "conversation: undo and redo replay")?.ok).toBe(false);
    expect(cleared).toBe(true);
    expect(report.checks.find((check) => check.name === "conversation: clear empties it")?.ok).toBe(true);
    expect(report.checks.at(-1)?.name).toBe("errors are SdkErrors with known codes");
  });

  it("passes the mock provider playing the playground's recordings", async () => {
    const report = await runAiProviderConformance(
      createMockAiProvider({ ...AI_RECORDINGS, delayMs: 0, conversation: true }),
    );
    expect(failed(report)).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        "declares at least one feature",
        "chat: streams text and resolves with it",
        "operations apply cleanly to the snapshot",
        "applied events carry increasing revisions",
        "rewrite: answers with html",
        "score: three categories scored 0–100",
        "suggestions: at most 4 of at most 80 characters",
        "stops on abort with an AbortError",
        "errors are SdkErrors with known codes",
        "conversation: lists messages in the Y7 shape",
        "conversation: undo and redo replay",
        "conversation: clear empties it",
      ]),
    );
  });

  it("fails a provider whose operations don't apply", async () => {
    const report = await runAiProviderConformance(
      createMockAiProvider({
        chat: [{ events: [{ type: "operations", ops: [{ op: "deleteBlock", blockId: "nope" }] }, { type: "done", messageId: null }] }],
      }),
    );
    expect(report.ok).toBe(false);
    expect(failed(report).map((check) => check.name)).toContain(
      "operations apply cleanly to the snapshot",
    );
  });

  it("fails a provider that rejects with a plain Error", async () => {
    const provider: AiProvider = {
      chat: false, fixFinding: false, design: false, rewrite: false, score: false,
      suggestions: async () => {
        throw new Error("boom");
      },
    };
    const report = await runAiProviderConformance(provider);
    expect(failed(report).map((check) => check.name)).toContain(
      "errors are SdkErrors with known codes",
    );
  });

  it("fails a provider that ignores an abort", async () => {
    const provider: AiProvider = {
      chat: false, fixFinding: false, design: false, rewrite: false, score: false,
      suggestions: () => new Promise((resolve) => setTimeout(() => resolve(["Late"]), 300)),
    };
    const report = await runAiProviderConformance(provider, { timeoutMs: 50 });
    expect(failed(report).find((check) => check.name === "stops on abort with an AbortError")?.detail).toMatch(/still running after 50 ms|resolved/);
  });

  describe("over HTTP, against a reference server built from the kit", () => {
    let server: Awaited<ReturnType<typeof serve>>;
    beforeAll(async () => {
      server = await serve(createReferenceHandler());
    });
    afterAll(() => server.close());

    it("passes", async () => {
      const report = await runAiProviderConformance(
        createHttpAiProvider({ baseUrl: server.baseUrl }),
      );
      expect(failed(report)).toEqual([]);
    });
  });
});


it.each(["early", "never", "repeat", "refused"] as const)("fails a provider with %s history settlement", async (fault) => {
  const provider = createMockAiProvider({ ...AI_RECORDINGS, delayMs: 0, conversation: true });
  const real = provider.conversation!;
  const settled = new Map<string, Parameters<typeof real.settleReplay>[2]>();
  provider.conversation = { ...real,
    list: async (id) => {
      const messages = await real.list(id);
      if (fault === "early" && messages.at(-1)) messages.at(-1)!.undone = true;
      return messages;
    },
    settleReplay: async (t, m, outcome) => {
      if (fault === "never") return;
      if (fault === "refused" && !outcome.applied) return real.settleReplay(t, m, { ...outcome, applied: true });
      if (fault === "repeat" && settled.has(outcome.replayId)) {
        const retry = await (real[outcome.direction] as Function)(t, m, { sessionId: outcome.sessionId });
        return real.settleReplay(t, m, { ...outcome, replayId: retry.replayId });
      }
      settled.set(outcome.replayId, outcome);
      return real.settleReplay(t, m, outcome);
    },
  };
  const report = await runAiProviderConformance(provider);
  expect(report.ok).toBe(false);
  expect(report.checks.some((check) => !check.ok && /replay/.test(check.name))).toBe(true);
});

describe("runAiProviderConformance: precise diagnostics", () => {
  it.each([undefined, null, 42])(
    "reports an invalid feature declaration %j",
    async (chat) => {
      const report = await runAiProviderConformance({
        ...disabled,
        chat,
      } as never);
      expect(failed(report)).toEqual([
        {
          name: "declares at least one feature",
          ok: false,
          detail: "declared: none",
        },
        {
          name: "chat: false or a function",
          ok: false,
          detail: `got ${typeof chat}`,
        },
      ]);
    },
  );

  it("describes null chat text in its failed check", async () => {
    const report = await runAiProviderConformance({
      ...disabled,
      chat: async (_request, _handlers, signal) => {
        signal.throwIfAborted();
        return { messageId: null, text: null } as never;
      },
    });
    expect(failed(report)).toEqual([
      {
        name: "chat: streams text and resolves with it",
        ok: false,
        detail: 'streamed "", resolved null',
      },
    ]);
  });

  it.each([
    {
      label: "increasing revisions",
      batches: [
        { batchId: "a", revision: 1, operationCount: 1 },
        { batchId: "b", revision: 2, operationCount: 1 },
      ],
      ok: true,
      detail: "revisions 1, 2",
    },
    {
      label: "repeated revisions",
      batches: [
        { batchId: "a", revision: 1, operationCount: 1 },
        { batchId: "b", revision: 1, operationCount: 1 },
      ],
      ok: false,
      detail: "revisions 1, 1",
    },
    {
      label: "fractional revision",
      batches: [{ batchId: "a", revision: 1.5, operationCount: 1 }],
      ok: false,
      detail: "revisions 1.5",
    },
    {
      label: "empty batch",
      batches: [{ batchId: "a", revision: 1, operationCount: 0 }],
      ok: false,
      detail: "revisions 1",
    },
    {
      label: "missing batch id",
      batches: [{ batchId: null, revision: 1, operationCount: 1 }],
      ok: false,
      detail: "revisions 1",
    },
  ])("reports $label in applied events", async ({ batches, ok, detail }) => {
    const report = await runAiProviderConformance(
      createMockAiProvider({
        chat: [
          {
            events: [
              ...batches.map((batch) => ({ type: "applied", ...batch })),
              { type: "done", messageId: null },
            ] as never,
          },
        ],
      }),
    );
    const check = {
      name: "applied events carry increasing revisions",
      ok,
      detail,
    };
    expect(report.checks.find((row) => row.name === check.name)).toEqual(check);
    expect(failed(report)).toEqual(ok ? [] : [check]);
  });

  it("skips replay when a conversation has no assistant changes", async () => {
    const report = await runAiProviderConformance(
      createMockAiProvider({
        suggestions: ["Add a footer"],
        conversation: true,
      }),
    );
    expect(failed(report)).toEqual([]);
    expect(
      report.checks.find(
        (check) => check.name === "conversation: undo and redo replay",
      ),
    ).toEqual({
      name: "conversation: undo and redo replay",
      ok: true,
      detail: "nothing to undo, or undo/redo are false",
    });
  });

  it("requires a settlement method for an editor-applied replay", async () => {
    const provider = createMockAiProvider({
      ...AI_RECORDINGS,
      delayMs: 0,
      conversation: true,
    });
    provider.conversation = {
      ...provider.conversation!,
      settleReplay: undefined as never,
    };
    const report = await runAiProviderConformance(provider);
    expect(failed(report)).toEqual([
      {
        name: "conversation: undo and redo replay",
        ok: false,
        detail: "settleReplay is required",
      },
    ]);
  });

  it("fails each replay state check when later history stops being a list", async () => {
    const provider = createMockAiProvider({
      ...AI_RECORDINGS,
      delayMs: 0,
      conversation: true,
    });
    const conversation = provider.conversation!;
    let listed = false;
    provider.conversation = {
      ...conversation,
      list: async (templateId) => {
        if (listed) return null as never;
        listed = true;
        return conversation.list(templateId);
      },
      clear: false,
    };
    const report = await runAiProviderConformance(provider);
    expect(failed(report)).toEqual([
      ...["undo", "redo"].flatMap((direction) => [
        {
          name: `conversation: ${direction} replay waits for settlement`,
          ok: false,
          detail: "ok",
        },
        {
          name: `conversation: ${direction} refused replay keeps its state`,
          ok: false,
          detail: "ok",
        },
        {
          name: `conversation: ${direction} replay settlement is idempotent`,
          ok: false,
          detail: "ok",
        },
        {
          name: `conversation: ${direction} accepted replay changes its state`,
          ok: false,
          detail: "ok",
        },
        {
          name: `conversation: ${direction} accepted replay settles only once`,
          ok: false,
          detail: "ok",
        },
      ]),
      {
        name: "conversation: undo and redo replay",
        ok: false,
        detail: "a replay was malformed, refused or settled incorrectly",
      },
    ]);
  });

  it.each([
    {
      label: "valid",
      applied: { batchId: "server-batch", revision: 4 },
      ok: true,
    },
    { label: "missing applied batch", applied: null, ok: false },
    {
      label: "non-string batch id",
      applied: { batchId: 4, revision: 4 },
      ok: false,
    },
    {
      label: "fractional revision",
      applied: { batchId: "server-batch", revision: 4.5 },
      ok: false,
    },
  ])("checks a $label server-applied replay", async ({ applied, ok }) => {
    const provider = createMockAiProvider({ suggestions: ["Add a footer"] });
    provider.conversation = {
      list: async () => [assistant] as never,
      undo: async () => ({ applied }) as never,
      redo: async () => ({ applied }) as never,
      settleReplay: async () => {},
      clear: false,
    };
    const report = await runAiProviderConformance(provider);
    const check = {
      name: "conversation: undo and redo replay",
      ok,
      detail: ok
        ? "ok"
        : "a replay was malformed, refused or settled incorrectly",
    };
    expect(report.checks.find((row) => row.name === check.name)).toEqual(check);
    expect(failed(report)).toEqual(ok ? [] : [check]);
  });

  it("accepts rewrite text emitted before checking an already-aborted signal", async () => {
    const report = await runAiProviderConformance({
      ...disabled,
      rewrite: async (_request, handlers, signal) => {
        handlers.onText("<p>Rewritten.</p>");
        signal.throwIfAborted();
        return { html: "<p>Rewritten.</p>" };
      },
    });
    expect(failed(report)).toEqual([]);
    expect(
      report.checks.find(
        (check) => check.name === "rewrite: answers with html",
      ),
    ).toEqual({
      name: "rewrite: answers with html",
      ok: true,
      detail: '"<p>Rewritten.</p>"',
    });
  });
});
