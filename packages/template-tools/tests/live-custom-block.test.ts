import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "node:net";
import { createServer, request as httpRequest, type Server } from "node:http";
import { startBridge, type BridgeHandle } from "../src/live/index";

const JSON_HDR = { "content-type": "application/json" };
const SECRET = "tok_supersecret_987";
const open: BridgeHandle[] = [];
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((h) => h.close()));
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
});

const def = (extra: object = {}) => ({
  type: "quote", name: "Quote",
  fields: [{ key: "id", label: "Id", type: "text", default: "7" }, { key: "text", label: "Text", type: "text", default: "Hi" }],
  template: '<table role="presentation"><tr><td>{{ text }}{{ id }}</td></tr></table>', ...extra,
});

async function project(definition: unknown, env: Record<string, string> = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "tt-live-cb-"));
  mkdirSync(join(cwd, ".templatical/custom-blocks"), { recursive: true });
  const file = ".templatical/custom-blocks/quote.json";
  writeFileSync(join(cwd, file), JSON.stringify(definition));
  const h = await startBridge({ cwd, customBlock: file, env });
  open.push(h);
  return { cwd, file, h, get: (p: string, init?: RequestInit) => fetch(`${h.url.replace(/\/$/, "")}${p}`, init) };
}

async function upstream(): Promise<{ base: string; seen: { url?: string; auth?: string }[] }> {
  const seen: { url?: string; auth?: string }[] = [];
  const s = createServer((req, res) => {
    seen.push({ url: req.url, auth: req.headers.authorization });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ quote: "From API" }));
  });
  servers.push(s);
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  return { base: `http://127.0.0.1:${(s.address() as { port: number }).port}`, seen };
}

describe("bridge custom-block mode", () => {
  it("serves the definition without the recipe, and the label only", async () => {
    const { get } = await project(def({ dataSourcePreview: { label: "Fetch", request: { url: "https://x.test/{{ id }}", headers: { Authorization: "Bearer ${env:T}" } }, map: { text: "quote" } } }));
    const body = await (await get("/custom-block")).json();
    expect(body.dataSource).toEqual({ label: "Fetch" });
    expect(body.definition.dataSourcePreview).toBe(undefined);
    expect(JSON.stringify(body)).not.toContain("env:T");
  });

  it("serves a specimen template on /template", async () => {
    const { get } = await project(def());
    const t = await (await get("/template")).json();
    expect(t.blocks.filter((b: { type: string }) => b.type === "custom")).toHaveLength(3);
  });

  it("answers 422 for an invalid definition", async () => {
    const { get } = await project({ type: "quote" });
    expect((await get("/template")).status).toBe(422);
    expect((await get("/custom-block")).status).toBe(422);
  });

  it("proxies the recipe with env from the bridge, ignoring URL/headers in the body", async () => {
    const up = await upstream();
    const { get } = await project(def({ dataSourcePreview: { label: "F", request: { url: `${up.base}/q/{{ id }}`, headers: { Authorization: "Bearer ${env:T}" } }, map: { text: "quote" } } }), { T: SECRET });
    const res = await get("/data-source/fetch", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ fieldValues: { id: "42" }, url: "http://evil.test/", headers: { Authorization: "x" } }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ values: { text: "From API" }, unmapped: [] });
    expect(up.seen).toEqual([{ url: "/q/42", auth: `Bearer ${SECRET}` }]);
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("a non-scalar field value never changes the outbound host", async () => {
    const up = await upstream();
    const { get } = await project(def({ dataSourcePreview: { label: "F", request: { url: `${up.base}/q/{{ id }}`, headers: { Authorization: "Bearer ${env:T}" } }, map: { text: "quote" } } }), { T: SECRET });
    const res = await get("/data-source/fetch", { method: "POST", headers: JSON_HDR, body: JSON.stringify({ fieldValues: { id: ["evil.test/"] } }) });
    expect(res.status).toBe(200);
    expect(up.seen).toEqual([{ url: "/q/%5B%22evil.test%2F%22%5D", auth: `Bearer ${SECRET}` }]);
  });

  it("refuses a recipe with Liquid in the host, before any request", async () => {
    const up = await upstream();
    const upHost = up.base.replace("http://", "");
    const { get } = await project(def({ dataSourcePreview: { label: "F", request: { url: "http://{{ id }}/q", headers: { Authorization: "Bearer ${env:T}" } }, map: { text: "quote" } } }), { T: SECRET });
    const res = await get("/data-source/fetch", { method: "POST", headers: JSON_HDR, body: JSON.stringify({ fieldValues: { id: [upHost] } }) });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("recipe.url-host-template");
    expect(up.seen).toEqual([]);
  });

  it("names a missing env var with 502 and no secret", async () => {
    const up = await upstream();
    const { get } = await project(def({ dataSourcePreview: { label: "F", request: { url: `${up.base}/q`, headers: { Authorization: "Bearer ${env:T}" } }, map: {} } }));
    const res = await get("/data-source/fetch", { method: "POST", headers: JSON_HDR, body: "{}" });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("T is not set");
    expect(up.seen).toEqual([]);
  });

  it("409 without a recipe; 204/404 outside custom-block mode", async () => {
    const { get } = await project(def());
    expect((await get("/data-source/fetch", { method: "POST", headers: JSON_HDR, body: "{}" })).status).toBe(409);
    const plain = await startBridge({ cwd: mkdtempSync(join(tmpdir(), "tt-plain-")) });
    open.push(plain);
    expect((await fetch(`${plain.url}custom-block`)).status).toBe(204);
    expect((await fetch(`${plain.url}data-source/fetch`, { method: "POST", headers: JSON_HDR, body: "{}" })).status).toBe(404);
  });

  it("reload broadcasts a custom-block event carrying the block and the specimen", async () => {
    const { h } = await project(def());
    const res = await fetch(`${h.url}events`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    const pump = async (marker: string) => {
      while (!text.includes(marker)) {
        const { done, value } = await reader.read();
        if (done) throw new Error(`stream ended before ${marker}`);
        text += decoder.decode(value);
      }
    };
    await pump("event: ready");
    expect(h.reload()).toEqual({ ok: true, clients: 1, consumed: false, mode: "custom-block" });
    await pump("event: custom-block");
    const frame = text.slice(text.indexOf("event: custom-block"));
    const data = JSON.parse(frame.slice(frame.indexOf("data: ") + 6, frame.indexOf("\n\n", frame.indexOf("data: "))));
    expect(data.block.definition.type).toBe("quote");
    expect(data.template.blocks.some((b: { type: string }) => b.type === "custom")).toBe(true);
    await reader.cancel();
  });

  it("refuses a foreign Host header on every route", async () => {
    const { h } = await project(def());
    const status = await new Promise<number>((resolve, reject) => {
      const r = httpRequest({ host: "127.0.0.1", port: h.port, path: "/template", headers: { host: "evil.test" } }, (res) => { res.resume(); resolve(res.statusCode ?? 0); });
      r.on("error", reject);
      r.end();
    });
    expect(status).toBe(403);
  });

  it("refuses a foreign Origin on the fetch route without calling upstream", async () => {
    const up = await upstream();
    const { get } = await project(def({ dataSourcePreview: { label: "F", request: { url: `${up.base}/q`, headers: {} }, map: {} } }));
    const res = await get("/data-source/fetch", { method: "POST", headers: { ...JSON_HDR, origin: "http://evil.test" }, body: "{}" });
    expect(res.status).toBe(403);
    expect(up.seen).toEqual([]);
  });

  it("requires a JSON content type on the fetch route", async () => {
    const up = await upstream();
    const { get } = await project(def({ dataSourcePreview: { label: "F", request: { url: `${up.base}/q`, headers: {} }, map: {} } }));
    const res = await get("/data-source/fetch", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
    expect(res.status).toBe(415);
    expect(up.seen).toEqual([]);
  });

  it("reload reports ok:false and broadcasts nothing for an invalid definition", async () => {
    const { h } = await project({ type: "quote" });
    const res = await fetch(`${h.url}events`);
    const reader = res.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain("event: ready");
    expect(h.reload()).toEqual({
      ok: false,
      clients: 1,
      consumed: false,
      mode: "custom-block",
      error: "The custom block definition is missing or invalid. Run `templatical custom-block validate` on it.",
    });
    const raced = await Promise.race([reader.read().then(() => "frame"), new Promise((r) => setTimeout(() => r("quiet"), 300))]);
    expect(raced).toBe("quiet");
    await reader.cancel();
  });

  it("answers 422 on /template for an invalid --host template", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "tt-badhost-"));
    mkdirSync(join(cwd, ".templatical/custom-blocks"), { recursive: true });
    writeFileSync(join(cwd, ".templatical/custom-blocks/quote.json"), JSON.stringify(def()));
    writeFileSync(join(cwd, ".templatical/welcome.json"), JSON.stringify({ blocks: "nope" }));
    const h = await startBridge({ cwd, customBlock: ".templatical/custom-blocks/quote.json", host: ".templatical/welcome.json" });
    open.push(h);
    const res = await fetch(`${h.url}template`);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("--host");
  });

  it("appends the specimen to a valid --host template", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "tt-host-"));
    mkdirSync(join(cwd, ".templatical/custom-blocks"), { recursive: true });
    writeFileSync(join(cwd, ".templatical/custom-blocks/quote.json"), JSON.stringify(def()));
    writeFileSync(join(cwd, ".templatical/welcome.json"), JSON.stringify({ blocks: [], settings: { width: 600, backgroundColor: "#ffffff", textColor: "#111111", fontFamily: "Arial, sans-serif", linkUnderline: true, locale: "en" } }));
    const h = await startBridge({ cwd, customBlock: ".templatical/custom-blocks/quote.json", host: ".templatical/welcome.json" });
    open.push(h);
    const t = await (await fetch(`${h.url}template`)).json();
    expect(t.settings.width).toBe(600);
    expect(t.blocks[0].type).toBe("paragraph");
  });
});

describe("bridge custom-block edge paths", () => {
  it("serves a definition given as an absolute path", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "tt-abs-"));
    const abs = join(cwd, "quote.json");
    writeFileSync(abs, JSON.stringify(def()));
    const h = await startBridge({ cwd: mkdtempSync(join(tmpdir(), "tt-other-")), customBlock: abs });
    open.push(h);
    expect(h.workingPath).toBe(abs);
    expect((await (await fetch(`${h.url}custom-block`)).json()).definition.type).toBe("quote");
  });

  it("clears annotations on a consuming reload of a valid block, and keeps them for an invalid one", async () => {
    const { h, get } = await project(def());
    const note = { blockId: "b1", text: "tighten this" };
    await get("/annotations", { method: "POST", headers: JSON_HDR, body: JSON.stringify(note) });
    expect((await (await get("/content")).json()).annotations).toHaveLength(1);
    expect(h.reload({ consumeAnnotations: true })).toMatchObject({ ok: true, consumed: true });
    expect((await (await get("/content")).json()).annotations).toEqual([]);

    const bad = await project({ type: "quote" });
    await bad.get("/annotations", { method: "POST", headers: JSON_HDR, body: JSON.stringify(note) });
    expect(bad.h.reload({ consumeAnnotations: true })).toMatchObject({ ok: false, consumed: false });
    expect((await (await bad.get("/content")).json()).annotations).toHaveLength(1);
  });

  it("answers 422 on the fetch route for an invalid definition, before reading the body", async () => {
    const { get } = await project({ type: "quote" });
    const res = await get("/data-source/fetch", { method: "POST", headers: JSON_HDR, body: "{}" });
    expect(res.status).toBe(422);
    expect(typeof (await res.json()).error).toBe("string");
  });

  it("answers 415 when the fetch request carries no content type at all", async () => {
    const up = await upstream();
    const { get } = await project(def({ dataSourcePreview: { label: "F", request: { url: `${up.base}/q`, headers: {} }, map: {} } }));
    const res = await get("/data-source/fetch", { method: "POST" });
    expect(res.status).toBe(415);
    expect(up.seen).toEqual([]);
  });

  it("refuses a request with no Host header", async () => {
    const { h } = await project(def());
    const port = Number(new URL(h.url).port);
    const reply = await new Promise<string>((resolve) => {
      let data = "";
      const sock = connect(port, "127.0.0.1", () => sock.write("GET /custom-block HTTP/1.0\r\n\r\n"));
      sock.on("data", (c) => (data += c));
      sock.on("close", () => resolve(data));
    });
    expect(reply).toContain("403");
    expect(reply).toContain("Forbidden host.");
  });
});

