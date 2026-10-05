import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { parseArgs } from "../src/cli/args";
import { setJsonMode } from "../src/cli/output";
import { InvalidTemplateError, UsageError } from "../src/cli/io";
import { runCustomBlock } from "../src/cli/commands/custom-block";

let dir: string;
let stdout: string[];
const good = {
  type: "quote", name: "Quote",
  fields: [{ key: "text", label: "Text", type: "textarea", default: "Hi" }, { key: "on", label: "On", type: "boolean", default: true }],
  template: '<table role="presentation"><tr><td>{% if on %}{{ text }}{% endif %}</td></tr></table>',
};
const file = (content: unknown) => { const p = join(dir, "q.json"); writeFileSync(p, JSON.stringify(content)); return p; };
const run = (argv: string[]) => runCustomBlock(parseArgs(["custom-block", ...argv]));
const json = () => JSON.parse(stdout.join(""));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tt-cb-"));
  stdout = [];
  vi.spyOn(process.stdout, "write").mockImplementation((c) => { stdout.push(String(c)); return true; });
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});
afterEach(() => { setJsonMode(false); vi.restoreAllMocks(); });

describe("custom-block validate", () => {
  it("exits 0 with no issues for a clean definition", async () => {
    setJsonMode(true);
    expect(await run(["validate", file(good), "--json"])).toBe(0);
    expect(json()).toEqual({ valid: true, issues: [] });
  });
  it("exits 1 and lists the error for an undefined variable", async () => {
    setJsonMode(true);
    expect(await run(["validate", file({ ...good, template: "{{ nope }}{{ text }}{{ on }}" }), "--json"])).toBe(1);
    expect(json().issues.map((i: { ruleId: string }) => i.ruleId)).toEqual(["liquid.undefined-variable"]);
  });
});

describe("custom-block render", () => {
  it("renders one state as MJML to a file", async () => {
    const out = join(dir, "o.mjml");
    expect(await run(["render", file(good), "--state", "flipped", "-o", out])).toBe(0);
    const mjml = readFileSync(out, "utf8");
    expect(mjml).toContain("Specimen:</strong> flipped");
    expect(mjml).not.toContain("Specimen:</strong> defaults");
  });
  it("rejects an unknown state", async () => {
    await expect(run(["render", file(good), "--state", "weird"])).rejects.toThrow(UsageError);
  });
});

describe("custom-block fetch", () => {
  let server: Server; let base: string;
  beforeEach(async () => {
    server = createServer((_q, r) => { r.writeHead(200, { "content-type": "application/json" }); r.end('{"t":"Fetched"}'); });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterEach(() => new Promise<void>((r) => server.close(() => r())));

  it("runs the recipe with --values merged over defaults", async () => {
    setJsonMode(true);
    const f = file({ ...good, dataSourcePreview: { label: "F", request: { url: `${base}/q/{{ text }}` }, map: { text: "t" } } });
    expect(await run(["fetch", f, "--values", '{"text":"x"}', "--json"])).toBe(0);
    expect(json()).toEqual({ ok: true, status: 200, values: { text: "Fetched" }, unmapped: [] });
  });
  it("rejects --values that is not a JSON object", async () => {
    const f = file({ ...good, dataSourcePreview: { label: "F", request: { url: `${base}/q` }, map: {} } });
    await expect(run(["fetch", f, "--values", "[1]"])).rejects.toThrow("--values must be a JSON object.");
    await expect(run(["fetch", f, "--values", "null"])).rejects.toThrow(UsageError);
  });
  it("refuses a recipe that fails checkRecipe, before any request", async () => {
    let hits = 0;
    server.removeAllListeners("request");
    server.on("request", (_q, r) => { hits++; r.end("{}"); });
    const f = file({ ...good, dataSourcePreview: { label: "F", request: { url: "http://{{ text }}/q" }, map: { text: "t" } } });
    const host = base.replace("http://", "");
    const err = await run(["fetch", f, "--values", JSON.stringify({ text: [host] })]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InvalidTemplateError);
    expect((err as InvalidTemplateError).message).toBe(`${f} has a dataSourcePreview the bridge would refuse to run.`);
    expect((err as InvalidTemplateError).errors.join("\n")).toContain("recipe.url-host-template");
    expect(hits).toBe(0);
  });
  it("is a usage error without a dataSourcePreview", async () => {
    await expect(run(["fetch", file(good)])).rejects.toThrow(UsageError);
  });
});

it("rejects an unknown subcommand and a missing file", async () => {
  await expect(run(["frob", "x.json"])).rejects.toThrow(UsageError);
  await expect(run(["validate"])).rejects.toThrow(UsageError);
});
