// The preview-only data-source recipe. The live bridge runs it from Node so
// the page never sees a secret and no CORS applies; the agent generates the
// shipped onFetch from the same recipe, so preview and production agree.
//
// These rules keep secrets contained, and each is load-bearing:
//   - `${env:NAME}` resolves only in header values;
//   - field values interpolate only into `url` and `body`;
//   - the URL's scheme and host are literal, every field value is URL-encoded
//     (non-scalars as JSON), and the rendered URL must keep the recipe's
//     origin, so no field value can send the headers to another host.
// A field value can never pull an env var into the request, and a secret can
// never be moved into the URL or off to a host the author didn't write.

import { createLiquid } from "./liquid";
import type {
  CustomBlockIssue,
  CustomBlockWorkingFile,
  DataSourcePreview,
} from "./types";

const ENV_REF = /\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g;
const LIQUID = /\{\{|\{%/;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const SECRET_HEADER = /authorization|token|key|secret|cookie|session/i;

const HOST_TEMPLATE_ERROR =
  "The request URL's scheme and host must be literal; Liquid may only follow the first `/` after the host.";

/**
 * Where the URL's scheme and authority end: the first `/`, `?` or `#` after
 * `://`, or the whole string when there is no `://`. Anything before this
 * index decides the origin, so it must hold no Liquid.
 */
function authorityEnd(url: string): number {
  const scheme = url.indexOf("://");
  if (scheme < 0) return url.length;
  const rest = url.slice(scheme + 3).search(/[/?#]/);
  return rest < 0 ? url.length : scheme + 3 + rest;
}

/** The recipe URL's origin, or null when Liquid can reach it. */
function literalOrigin(url: string): string | null {
  const prefix = url.slice(0, authorityEnd(url));
  if (LIQUID.test(prefix)) return null;
  try {
    return new URL(prefix).origin;
  } catch {
    return null;
  }
}

function encodeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") {
    return encodeURIComponent(String(value));
  }
  return encodeURIComponent(JSON.stringify(value));
}

export function getPath(value: unknown, path: string): unknown {
  const parts = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  let cur: unknown = value;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function checkRecipe(def: CustomBlockWorkingFile): CustomBlockIssue[] {
  const r = def.dataSourcePreview;
  if (!r) return [];
  const issues: CustomBlockIssue[] = [];
  const keys = new Set(def.fields.map((f) => f.key));
  const err = (ruleId: string, path: string, message: string) =>
    issues.push({
      ruleId,
      severity: "error",
      path: `/dataSourcePreview${path}`,
      message,
    });
  const engine = createLiquid();

  for (const [part, text] of [
    ["/request/url", r.request.url],
    ["/request/body", r.request.body],
  ] as const) {
    if (text === undefined) continue;
    if (new RegExp(ENV_REF.source).test(text)) {
      err(
        "recipe.env-outside-headers",
        part,
        "`${env:…}` is resolved only in header values; keep secrets out of the URL and body.",
      );
    }
    try {
      for (const [name] of engine.globalVariableSegmentsSync(text)) {
        if (!keys.has(String(name)))
          err(
            "recipe.undefined-variable",
            part,
            `The recipe reads \`${String(name)}\`, which no field defines.`,
          );
      }
    } catch (e) {
      err(
        "recipe.undefined-variable",
        part,
        `Does not parse: ${(e as Error).message}`,
      );
    }
  }
  // Without `://` the URL is not absolute, which recipe.url below reports.
  if (
    r.request.url.includes("://") &&
    LIQUID.test(r.request.url.slice(0, authorityEnd(r.request.url)))
  ) {
    err("recipe.url-host-template", "/request/url", HOST_TEMPLATE_ERROR);
  }
  const probeUrl = r.request.url.replace(
    /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g,
    "x",
  );
  let parses = true;
  try {
    new URL(probeUrl);
  } catch {
    parses = false;
  }
  if (!/^https?:\/\//i.test(probeUrl) || !parses) {
    err(
      "recipe.url",
      "/request/url",
      "The request URL must be an absolute http(s) URL.",
    );
  }
  for (const [name, value] of Object.entries(r.request.headers ?? {})) {
    if (LIQUID.test(value)) {
      err(
        "recipe.field-in-header",
        `/request/headers/${name}`,
        `Header \`${name}\` interpolates a field; headers take only \`\${env:NAME}\`.`,
      );
    } else if (
      SECRET_HEADER.test(name) &&
      !new RegExp(ENV_REF.source).test(value)
    ) {
      err(
        "recipe.literal-secret",
        `/request/headers/${name}`,
        `Header \`${name}\` holds a literal credential. Use \`\${env:NAME}\` and export the variable instead.`,
      );
    }
  }
  for (const field of Object.keys(r.map)) {
    if (!keys.has(field))
      err(
        "recipe.unknown-map-key",
        `/map/${field}`,
        `\`map\` writes \`${field}\`, which no field defines.`,
      );
  }
  return issues;
}

export interface RecipeOptions {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  timeoutMs?: number;
}
export type RecipeResult =
  | {
      ok: true;
      status: number;
      values: Record<string, unknown>;
      unmapped: string[];
    }
  | { ok: false; status?: number; error: string };

export async function runRecipe(
  recipe: DataSourcePreview,
  fieldValues: Record<string, unknown>,
  {
    env = process.env,
    fetch: doFetch = fetch,
    timeoutMs = 10_000,
  }: RecipeOptions = {},
): Promise<RecipeResult> {
  const expectedOrigin = literalOrigin(recipe.request.url);
  if (expectedOrigin === null) return { ok: false, error: HOST_TEMPLATE_ERROR };
  const engine = createLiquid();
  const encoded = Object.fromEntries(
    Object.entries(fieldValues).map(([k, v]) => [k, encodeValue(v)]),
  );
  let url: string;
  let body: string | undefined;
  try {
    url = String(await engine.parseAndRender(recipe.request.url, encoded));
    body =
      recipe.request.body === undefined
        ? undefined
        : String(await engine.parseAndRender(recipe.request.body, fieldValues));
  } catch (e) {
    return {
      ok: false,
      error: `The request template does not render: ${(e as Error).message}`,
    };
  }

  let renderedOrigin: string | null = null;
  try {
    renderedOrigin = new URL(url).origin;
  } catch {
    /* reported below */
  }
  if (renderedOrigin !== expectedOrigin) {
    return {
      ok: false,
      error: `The rendered URL's origin (${renderedOrigin ?? "unparseable"}) differs from the recipe's (${expectedOrigin}); no request was made.`,
    };
  }

  const secrets: string[] = [];
  const headers: Record<string, string> = {};
  for (const [name, template] of Object.entries(recipe.request.headers ?? {})) {
    let missing: string | undefined;
    headers[name] = template.replace(ENV_REF, (_, variable: string) => {
      const value = env[variable];
      if (value === undefined || value === "") {
        missing ??= variable;
        return "";
      }
      secrets.push(value);
      return value;
    });
    if (missing) {
      return {
        ok: false,
        error: `Environment variable ${missing} is not set. Export it in the shell that runs the live server.`,
      };
    }
  }
  const redact = (s: string) =>
    secrets.reduce((acc, secret) => acc.split(secret).join("***"), s);
  const redactDeep = (v: unknown): unknown => {
    if (typeof v === "string") return redact(v);
    if (Array.isArray(v)) return v.map(redactDeep);
    if (v !== null && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, redactDeep(x)]),
      );
    }
    return v;
  };
  const method = recipe.request.method ?? "GET";

  try {
    const res = await doFetch(url, {
      method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location") ?? "(none)";
      return {
        ok: false,
        status: res.status,
        error: redact(
          `${method} ${url} redirected (${res.status}) to ${location}. Redirects are not followed; point the recipe at the final URL.`,
        ),
      };
    }
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: `${redact(`${method} ${url} returned ${res.status}: `)}${redact(text).slice(0, 200)}`,
      };
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        ok: false,
        status: res.status,
        error: redact(`${method} ${url} did not return JSON.`),
      };
    }
    const values: Record<string, unknown> = {};
    const unmapped: string[] = [];
    for (const [field, path] of Object.entries(recipe.map)) {
      if (UNSAFE_KEYS.has(field)) continue;
      const v = getPath(json, path);
      if (v === undefined) unmapped.push(field);
      else values[field] = redactDeep(v);
    }
    return { ok: true, status: res.status, values, unmapped };
  } catch (e) {
    return {
      ok: false,
      error: redact(`${method} ${url} failed: ${(e as Error).message}`),
    };
  }
}
