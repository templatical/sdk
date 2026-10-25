import {
  createHttpAiProviderWithFetch,
  type HttpAiFeatures,
} from "../client/http-provider";
import {
  AI_SESSION_HEADER,
  AI_WIRE_HEADER,
  AI_WIRE_VERSION,
  aiRoutePath,
  matchAiRoute,
} from "../wire";
import {
  evaluateConformanceCheck,
  tinyPng,
  runAiProviderConformance,
  withConformanceDeadline,
  type AiConformanceCheck,
  type AiConformanceReport,
} from "./conformance";
import {
  AI_CONFORMANCE_ALT_TEXT_IMAGE_URL,
  AI_EVAL_TEMPLATES,
} from "./eval-set";

export interface AiWireConformanceOptions {
  baseUrl: string;
  features?: HttpAiFeatures;
  headers?:
    | Record<string, string>
    | (() => Record<string, string> | Promise<Record<string, string>>);
  templateId?: string;
  /** Defaults to AI_CONFORMANCE_ALT_TEXT_IMAGE_URL. */
  altTextImageUrl?: string;
  timeoutMs?: number;
  callTimeoutMs?: number;
}

/**
 * The provider suite over the wire, through `createHttpAiProvider`, plus the
 * wire's own rules: every response carries `Templatical-AI-Wire: 1`, streams
 * are `text/event-stream`, and a bad turn is refused before the stream with a
 * JSON error. For a backend in any language; run it from Node (no CORS).
 */
export async function runAiWireConformance(
  options: AiWireConformanceOptions,
): Promise<AiConformanceReport> {
  const base = options.baseUrl.replace(/\/+$/, "");
  const templateId = options.templateId ?? "conformance";
  const timeoutMs = Math.min(
    options.callTimeoutMs ?? options.timeoutMs ?? 5000,
    options.timeoutMs ?? 5000,
  );
  const checks: AiConformanceCheck[] = [];
  const responses: { route: string; response: Response; streamed: boolean }[] =
    [];
  const fetchRequest = fetch;
  const readHeaders = () =>
    withConformanceDeadline("request headers", timeoutMs, async () =>
      typeof options.headers === "function"
        ? await options.headers()
        : (options.headers ?? {}),
    );
  const observedFetch: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    const parent =
      init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");
    const route = matchAiRoute(method, url.pathname)?.route ?? url.pathname;
    const controller = new AbortController();
    const stop = () => controller.abort(parent?.reason);
    if (parent?.aborted) stop();
    else parent?.addEventListener("abort", stop, { once: true });
    const release = () => parent?.removeEventListener("abort", stop);
    try {
      const response = await withConformanceDeadline(
        `${route}: fetch`,
        timeoutMs,
        (signal) => {
          signal.throwIfAborted();
          return fetchRequest(input, { ...init, signal });
        },
        controller,
      );
      responses.push({
        route,
        response,
        streamed:
          response.ok &&
          ["generate", "fixFinding", "rewriteText", "altText"].includes(route),
      });
      if (!response.body) {
        release();
        return response;
      }
      const reader = response.body.getReader();
      let finished = false;
      const body = new ReadableStream<Uint8Array>(
        {
          async pull(stream) {
            try {
              const { done, value } = await withConformanceDeadline(
                `${route}: body read`,
                timeoutMs,
                () => reader.read(),
                controller,
              );
              if (finished) return;
              if (done) {
                finished = true;
                release();
                stream.close();
              } else stream.enqueue(value);
            } catch (error) {
              release();
              if (!finished) {
                finished = true;
                stream.error(error);
              }
              if (!controller.signal.aborted)
                void reader.cancel(error).catch(() => {});
            }
          },
          async cancel(reason) {
            finished = true;
            release();
            await withConformanceDeadline(
              `${route}: body cancel`,
              timeoutMs,
              () => reader.cancel(reason),
              controller,
            );
          },
        },
        { highWaterMark: 0 },
      );
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      release();
      throw error;
    }
  };
  let own: Record<string, string> = {};
  const headersCheck = await evaluateConformanceCheck(
    "request headers",
    async () => {
      own = await readHeaders();
      return { ok: true };
    },
  );
  if (!headersCheck.ok) checks.push(headersCheck);

  async function probe(
    route: "generate",
    body: unknown,
  ): Promise<Response | null> {
    try {
      const response = await observedFetch(
        `${base}${aiRoutePath(route, { template: templateId })}`,
        {
          method: "POST",
          headers: {
            ...own,
            [AI_WIRE_HEADER]: AI_WIRE_VERSION,
            [AI_SESSION_HEADER]: "conformance-session",
            ...(body instanceof FormData
              ? {}
              : { "Content-Type": "application/json" }),
            Accept: "text/event-stream",
          },
          body: body instanceof FormData ? body : JSON.stringify(body),
        },
      );
      return response;
    } catch (error) {
      checks.push(
        await evaluateConformanceCheck(`reaches ${route}`, () => ({
          ok: false,
          detail: String(error),
        })),
      );
      return null;
    }
  }

  const invalid =
    options.features?.chat === false
      ? null
      : await probe("generate", {
          message: "",
          selectedBlockId: null,
          mergeTags: { syntax: "liquid", tags: [] },
          content: AI_EVAL_TEMPLATES.welcome,
          revision: null,
        });
  const invalidCheck = await evaluateConformanceCheck(
    "refuses an invalid turn before the stream with a JSON error",
    async () => {
      if (options.features?.chat === false)
        return { ok: true, detail: "skipped: chat is disabled" };
      const invalidBody: unknown = invalid
        ? await withConformanceDeadline(
            "generate: JSON body read",
            timeoutMs,
            () => invalid.json(),
          )
        : null;
      return {
        ok:
          invalid !== null &&
          invalid.status >= 400 &&
          invalid.status < 500 &&
          typeof (invalidBody as { message?: unknown } | null)?.message ===
            "string",
        detail: invalid
          ? `${invalid.status} ${JSON.stringify(invalidBody)}`
          : "no response",
      };
    },
  );
  if (
    options.features?.chat !== false &&
    options.features?.chatAttachments !== false
  ) {
    const form = new FormData();
    form.set("message", "Use these references");
    form.set("content", JSON.stringify(AI_EVAL_TEMPLATES.welcome));
    for (let i = 0; i < 5; i++)
      form.append("attachment", tinyPng(), "reference.png");
    const refused = await probe("generate", form);
    checks.push(
      await evaluateConformanceCheck(
        "refuses more than 4 attachments with 422",
        async () => {
          const body: unknown = refused
            ? await withConformanceDeadline(
                "generate: attachment refusal JSON",
                timeoutMs,
                () => refused.json(),
              )
            : null;
          return {
            ok:
              refused?.status === 422 &&
              typeof (body as { message?: unknown } | null)?.message ===
                "string",
            detail: refused
              ? `${refused.status} ${JSON.stringify(body)}`
              : "no response",
          };
        },
      ),
    );
  }
  const report = await runAiProviderConformance(
    createHttpAiProviderWithFetch(
      { baseUrl: base, headers: readHeaders, features: options.features },
      observedFetch,
    ),
    {
      templateId,
      altTextImageUrl:
        options.altTextImageUrl ?? AI_CONFORMANCE_ALT_TEXT_IMAGE_URL,
      ...(options.timeoutMs !== undefined
        ? { timeoutMs: options.timeoutMs }
        : {}),
      ...(options.callTimeoutMs !== undefined
        ? { callTimeoutMs: options.callTimeoutMs }
        : {}),
    },
  );
  const responseCheck = await evaluateConformanceCheck(
    "responses carry Templatical-AI-Wire: 1",
    () => {
      const missing = responses.filter(
        ({ response }) =>
          response.headers.get(AI_WIRE_HEADER) !== AI_WIRE_VERSION,
      );
      return {
        ok: responses.length > 0 && missing.length === 0,
        detail:
          missing.length === 0
            ? `${responses.length} response(s)`
            : missing
                .map(
                  ({ route, response }) =>
                    `${route}: ${response.status} ${response.url}`,
                )
                .join(", "),
      };
    },
  );
  const streamCheck = await evaluateConformanceCheck(
    "streams answer as text/event-stream",
    () => {
      const streams = responses.filter(({ streamed }) => streamed);
      const wrong = streams.filter(
        ({ response }) =>
          !(response.headers.get("Content-Type") ?? "").startsWith(
            "text/event-stream",
          ),
      );
      return {
        ok: wrong.length === 0,
        detail:
          wrong.length === 0
            ? `${streams.length} streamed response(s)`
            : wrong
                .map(
                  ({ route, response }) =>
                    `${route}: ${response.headers.get("Content-Type") ?? "missing Content-Type"}`,
                )
                .join(", "),
      };
    },
  );
  checks.unshift(responseCheck, streamCheck, invalidCheck);
  const all = [...checks, ...report.checks];
  return { ok: all.every((check) => check.ok), checks: all };
}
