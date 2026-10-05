import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { checkRecipe, getPath, replaceLiquid, runRecipe } from "../src/custom-block/recipe";

const SECRET = "sk_live_verysecretvalue123";
const fields = [
  { key: "productId", label: "Id", type: "text" },
  { key: "name", label: "Name", type: "text" },
  { key: "image", label: "Image", type: "image" },
];
const def = (recipe: object) => ({ type: "p", name: "P", template: "", fields, dataSourcePreview: recipe }) as never;
const ok = { label: "Fetch", request: { url: "https://x.test/p/{{ productId }}", headers: { Authorization: "Bearer ${env:SHOP_TOKEN}" } }, map: { name: "title", image: "images[0].url" } };

describe("checkRecipe", () => {
  it("accepts a well-formed recipe", () => {
    expect(checkRecipe(def(ok))).toEqual([]);
  });
  it.each([
    [{ ...ok, request: { ...ok.request, url: "https://x.test/{{ sku }}" } }, "recipe.undefined-variable"],
    [{ ...ok, map: { price: "price" } }, "recipe.unknown-map-key"],
    [{ ...ok, request: { ...ok.request, headers: { Authorization: "Bearer abc123" } } }, "recipe.literal-secret"],
    [{ ...ok, request: { ...ok.request, headers: { "X-Id": "{{ productId }}" } } }, "recipe.field-in-header"],
    [{ ...ok, request: { ...ok.request, url: "https://x.test/?k=${env:SHOP_TOKEN}" } }, "recipe.env-outside-headers"],
    [{ ...ok, request: { ...ok.request, url: "x.test/{{ productId }}" } }, "recipe.url"],
  ])("rejects %#", (recipe, ruleId) => {
    expect(checkRecipe(def(recipe)).map((i) => `${i.severity}:${i.ruleId}`)).toEqual([`error:${ruleId}`]);
  });
  it.each([
    "https://{{ productId }}.x.test/p",
    "https://x.test{{ productId }}/p",
    "https://x.test:{{ productId }}/p",
    "https://{% if productId %}x.test{% endif %}/p",
    "{{ productId }}://x.test/p",
  ])("rejects Liquid in the URL's scheme or authority: %s", (url) => {
    const ids = checkRecipe(def({ ...ok, request: { ...ok.request, url } })).map((i) => i.ruleId);
    expect(ids).toContain("recipe.url-host-template");
  });
  it("reports a URL template that does not parse", () => {
    const issues = checkRecipe(def({ ...ok, request: { ...ok.request, url: "https://x.test/{{ productId" } }));
    expect(issues.map((i) => i.ruleId)).toContain("recipe.undefined-variable");
    expect(issues.find((i) => i.message.startsWith("Does not parse:"))?.path).toBe("/dataSourcePreview/request/url");
  });
  it("accepts Liquid in the path and query after a literal host", () => {
    for (const url of ["https://x.test/{{ productId }}", "https://x.test/p?id={{ productId }}", "https://x.test?id={{ productId }}"]) {
      expect(checkRecipe(def({ ...ok, request: { ...ok.request, url } }))).toEqual([]);
    }
  });
  it("never prints a literal secret in its message", () => {
    const issues = checkRecipe(def({ ...ok, request: { ...ok.request, headers: { Authorization: `Bearer ${SECRET}` } } }));
    expect(JSON.stringify(issues)).not.toContain(SECRET);
  });
});

describe("getPath", () => {
  it("reads dot and index paths", () => {
    expect(getPath({ a: { b: [{ c: 3 }] } }, "a.b[0].c")).toBe(3);
    expect(getPath({ a: null }, "a.b")).toBe(undefined);
  });
});

describe("runRecipe against a local server", () => {
  let server: Server;
  let base: string;
  let seen: { url?: string; auth?: string; body?: string } = {};
  let redirectTo: string | undefined;
  let echoAuth = false;
  let errorBody: string | undefined;
  let status = 200;
  let body = JSON.stringify({ title: "Lamp", images: [{ url: "https://x.test/l.png" }] });

  beforeEach(async () => {
    seen = {}; status = 200; redirectTo = undefined; echoAuth = false; errorBody = undefined;
    body = JSON.stringify({ title: "Lamp", images: [{ url: "https://x.test/l.png" }] });
    server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        seen = { url: req.url, auth: req.headers.authorization, body: Buffer.concat(chunks).toString() };
        if (redirectTo) { res.writeHead(302, { location: redirectTo }); res.end(); return; }
        res.writeHead(status, { "content-type": "application/json" });
        res.end(errorBody !== undefined ? errorBody : echoAuth ? JSON.stringify({ title: req.headers.authorization }) : status === 200 ? body : `upstream saw ${req.headers.authorization}`);
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterEach(() => new Promise<void>((r) => server.close(() => r())));

  const recipe = () => ({ ...ok, request: { ...ok.request, url: `${base}/p/{{ productId }}` } });

  it("interpolates URL-encoded field values, resolves env in headers, maps the response", async () => {
    const r = await runRecipe(recipe(), { productId: "a b/1" }, { env: { SHOP_TOKEN: SECRET } });
    expect(r).toEqual({ ok: true, status: 200, values: { name: "Lamp", image: "https://x.test/l.png" }, unmapped: [] });
    expect(seen).toMatchObject({ url: "/p/a%20b%2F1", auth: `Bearer ${SECRET}` });
  });

  it("lists map entries the response didn't have", async () => {
    body = JSON.stringify({ title: "Lamp" });
    const r = await runRecipe(recipe(), { productId: "1" }, { env: { SHOP_TOKEN: SECRET } });
    expect(r).toEqual({ ok: true, status: 200, values: { name: "Lamp" }, unmapped: ["image"] });
  });

  it("names a missing env var and makes no request", async () => {
    const r = await runRecipe(recipe(), { productId: "1" }, { env: {} });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("SHOP_TOKEN") });
    expect(seen.url).toBe(undefined);
  });

  it("redacts the secret from an upstream error that echoes it", async () => {
    status = 500;
    const r = await runRecipe(recipe(), { productId: "1" }, { env: { SHOP_TOKEN: SECRET } });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain(SECRET);
    expect(r).toMatchObject({ status: 500 });
  });

  it("reports a non-JSON response", async () => {
    body = "<html>";
    const r = await runRecipe(recipe(), { productId: "1" }, { env: { SHOP_TOKEN: SECRET } });
    expect(r).toEqual({ ok: false, status: 200, error: expect.stringContaining("did not return JSON") });
  });

  it("a field value cannot inject an env reference", async () => {
    await runRecipe(recipe(), { productId: "${env:SHOP_TOKEN}" }, { env: { SHOP_TOKEN: SECRET } });
    expect(seen.url).toBe("/p/%24%7Benv%3ASHOP_TOKEN%7D");
  });

  it("a field value cannot inject an env reference into a POST body", async () => {
    const r = { ...recipe(), request: { ...recipe().request, method: "POST" as const, body: '{"id":"{{ productId }}"}' } };
    await runRecipe(r, { productId: "${env:SHOP_TOKEN}" }, { env: { SHOP_TOKEN: SECRET } });
    expect(seen.body).toBe('{"id":"${env:SHOP_TOKEN}"}');
  });

  it("redacts a secret echoed inside mapped values", async () => {
    echoAuth = true;
    const r = await runRecipe({ ...recipe(), map: { name: "title" } }, { productId: "1" }, { env: { SHOP_TOKEN: SECRET } });
    expect(JSON.stringify(r)).not.toContain(SECRET);
    expect(r).toMatchObject({ ok: true, values: { name: "Bearer ***" } });
  });

  it("does not follow redirects", async () => {
    let hits = 0;
    const other = createServer((_q, s) => { hits++; s.end("{}"); });
    await new Promise<void>((res) => other.listen(0, "127.0.0.1", res));
    redirectTo = `http://127.0.0.1:${(other.address() as { port: number }).port}/steal`;
    const r = await runRecipe(recipe(), { productId: "1" }, { env: { SHOP_TOKEN: SECRET } });
    await new Promise<void>((res) => other.close(() => res()));
    expect(hits).toBe(0);
    expect(r).toMatchObject({ ok: false, status: 302, error: expect.stringContaining(redirectTo) });
    expect(JSON.stringify(r)).not.toContain(SECRET);
  });

  it("resolves to a failure when the template does not render", async () => {
    const r = await runRecipe({ ...recipe(), request: { ...recipe().request, url: "https://x.test/{{ productId" } }, {}, { env: {} });
    expect(r).toMatchObject({ ok: false });
  });

  it("redacts before truncating the upstream error body", async () => {
    status = 500;
    errorBody = `${"x".repeat(195)}${SECRET}`;
    const r = await runRecipe(recipe(), { productId: "1" }, { env: { SHOP_TOKEN: SECRET } });
    expect(JSON.stringify(r)).not.toContain(SECRET.slice(0, 4));
  });

  it("URL-encodes non-scalar field values as JSON", async () => {
    const r = await runRecipe(recipe(), { productId: ["evil.test/"] }, { env: { SHOP_TOKEN: SECRET } });
    expect(r).toMatchObject({ ok: true, status: 200 });
    expect(seen.url).toBe("/p/%5B%22evil.test%2F%22%5D");
    await runRecipe(recipe(), { productId: { host: "evil.test" } }, { env: { SHOP_TOKEN: SECRET } });
    expect(seen.url).toBe("/p/%7B%22host%22%3A%22evil.test%22%7D");
    await runRecipe(recipe(), { productId: null }, { env: { SHOP_TOKEN: SECRET } });
    expect(seen.url).toBe("/p/");
  });

  it("refuses a URL whose origin a field value could change, without a request", async () => {
    const calls: string[] = [];
    const stub = (async (u: string) => { calls.push(String(u)); return new Response("{}"); }) as unknown as typeof fetch;
    const hostTemplate = { ...ok, request: { ...ok.request, url: "https://{{ productId }}.x.test/p" } };
    const r = await runRecipe(hostTemplate, { productId: "evil" }, { env: { SHOP_TOKEN: SECRET }, fetch: stub });
    expect(r).toEqual({ ok: false, error: "The request URL's scheme and host must be literal; Liquid may only follow the first `/` after the host." });
    expect(calls).toEqual([]);
  });

  it("ignores a __proto__ map key", async () => {
    const r = await runRecipe({ ...recipe(), map: JSON.parse('{"__proto__":"title","name":"title"}') }, { productId: "1" }, { env: { SHOP_TOKEN: SECRET } });
    expect(r).toMatchObject({ ok: true, values: { name: "Lamp" } });
    expect(Object.getPrototypeOf((r as { values: object }).values)).toBe(Object.prototype);
    expect(Object.keys((r as { values: object }).values)).toEqual(["name"]);
  });
});

describe("runRecipe without a server", () => {
  const json = (v: unknown) => (async () => new Response(JSON.stringify(v))) as unknown as typeof fetch;
  const at = (url: string, map: Record<string, string> = { name: "title" }) => ({ label: "F", request: { url }, map });

  it("refuses a URL with no scheme, since no origin can be derived", async () => {
    const r = await runRecipe(at("x.test/p"), {}, { fetch: json({}) });
    expect(r).toEqual({ ok: false, error: "The request URL's scheme and host must be literal; Liquid may only follow the first `/` after the host." });
  });

  it("accepts a URL that is only a scheme and host", async () => {
    let seen = "";
    const f = (async (u: string) => { seen = String(u); return new Response('{"title":"Lamp"}'); }) as unknown as typeof fetch;
    const r = await runRecipe(at("http://x.test"), {}, { fetch: f });
    expect(r).toEqual({ ok: true, status: 200, values: { name: "Lamp" }, unmapped: [] });
    expect(seen).toBe("http://x.test");
  });

  it("redacts a secret nested in mapped arrays and objects and keeps non-strings", async () => {
    const f = json({ tags: [SECRET, "a", 3], meta: { k: SECRET, n: 5, ok: true, z: null } });
    const r = await runRecipe(
      { ...ok, request: { ...ok.request, url: "http://x.test/p" }, map: { name: "tags", image: "meta" } },
      {},
      { env: { SHOP_TOKEN: SECRET }, fetch: f },
    );
    expect(r).toEqual({
      ok: true,
      status: 200,
      values: { name: ["***", "a", 3], image: { k: "***", n: 5, ok: true, z: null } },
      unmapped: [],
    });
  });

  it("names a redirect that carries no Location header", async () => {
    const f = (async () => new Response(null, { status: 302 })) as unknown as typeof fetch;
    const r = await runRecipe(at("http://x.test/p"), {}, { fetch: f });
    expect(r).toEqual({ ok: false, status: 302, error: expect.stringContaining("to (none)") });
  });

  it("reports a thrown fetch as a failure that names the URL", async () => {
    const f = (async () => { throw new Error("boom"); }) as unknown as typeof fetch;
    const r = await runRecipe(at("http://x.test/p"), {}, { fetch: f });
    expect(r).toEqual({ ok: false, error: "GET http://x.test/p failed: boom" });
  });
});

describe("replaceLiquid", () => {
  it("replaces each output and tag span with x", () => {
    expect(replaceLiquid("a{{ b }}c{% if d %}e{% endif %}f")).toBe("axcxexf");
  });
  it("swallows the rest of the text after an unterminated opener", () => {
    expect(replaceLiquid("https://x.test/{{ id")).toBe("https://x.test/x");
    expect(replaceLiquid("p{%")).toBe("px");
  });
  it("leaves text without Liquid untouched", () => {
    expect(replaceLiquid("https://x.test/{ a }")).toBe("https://x.test/{ a }");
  });
  it("scans adversarial input in linear time", () => {
    for (const input of ["{{".repeat(50000), "{{%".repeat(30000), "{%{{".repeat(25000), "{% %}".repeat(50000), "{{ }}".repeat(50000)]) {
      const t = performance.now();
      replaceLiquid(input);
      expect(performance.now() - t).toBeLessThan(200);
    }
  });
});
