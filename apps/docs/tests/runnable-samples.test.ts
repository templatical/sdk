import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import * as types from "../../../packages/types/src";
import { renderToMjml } from "../../../packages/renderer/src";

const root = join(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

/**
 * Run a docs snippet as shown: each value import is bound to the real export,
 * and the names the snippet doesn't declare come from `globals`. The editor
 * mounts into a browser, so `init` is recorded instead; its export is checked
 * against the editor's source.
 */
async function runSnippet(
  name: string,
  results: string,
  init: (config: any) => Promise<unknown>,
  globals: Record<string, unknown>,
) {
  const source = read(`apps/docs/snippets/${name}`);
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
  const modules: Record<string, Record<string, unknown>> = {
    "@templatical/types": types as Record<string, unknown>,
    "@templatical/renderer": { renderToMjml },
    "@templatical/editor": { init },
  };
  const bindings: Record<string, unknown> = {};
  for (const node of file.statements) {
    if (!ts.isImportDeclaration(node)) continue;
    const moduleName = (node.moduleSpecifier as ts.StringLiteral).text;
    const imports = node.importClause?.namedBindings;
    if (!node.importClause) {
      expect(moduleName, `${name} imports ${moduleName}`).toBe(
        "@templatical/editor/style.css",
      );
      continue;
    }
    if (!imports || !ts.isNamedImports(imports)) continue;
    expect(modules, `${name} imports ${moduleName}`).toHaveProperty(moduleName);
    for (const entry of imports.elements) {
      if (entry.isTypeOnly || node.importClause.isTypeOnly) continue;
      const exported = (entry.propertyName ?? entry.name).text;
      expect(
        modules[moduleName],
        `${moduleName} exports ${exported}`,
      ).toHaveProperty(exported);
      bindings[entry.name.text] = modules[moduleName][exported];
    }
  }
  const body = file.statements
    .filter((node) => !ts.isImportDeclaration(node))
    .map((node) => node.getText(file))
    .join("\n");
  const js = ts.transpileModule(body, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  const run = new Function(
    ...Object.keys(bindings),
    ...Object.keys(globals),
    `return (async () => { ${js}\nreturn { ${results} }; })();`,
  );
  return run(...Object.values(bindings), ...Object.values(globals));
}

describe("docs pages include the runnable samples", () => {
  it.each([
    ["guide/layout.md", "layout-headless.ts"],
    ["backend/collaboration.md", "collaboration-client.ts"],
  ])("%s includes %s in English and German", (page, snippet) => {
    for (const path of [`apps/docs/${page}`, `apps/docs/de/${page}`])
      expect(read(path)).toContain(`<<< @/snippets/${snippet}`);
  });

  it.each(["", "de/"])(
    "%sbackend/collaboration.md says the sample's paths, events and header are its own transport",
    (language) => {
      const page = read(`apps/docs/${language}backend/collaboration.md`);
      const sentence = page.indexOf("`X-Session-Id`");
      expect(sentence).toBeGreaterThan(-1);
      expect(sentence).toBeLessThan(
        page.indexOf("<<< @/snippets/collaboration-client.ts"),
      );
    },
  );

  it.each(["", "de/"])(
    "%sguide/layout.md and backend/collaboration.md no longer carry the inline samples",
    (language) => {
      const layout = read(`apps/docs/${language}guide/layout.md`);
      expect(layout).not.toContain(
        "const mjml = await renderToMjml(content, { layout });",
      );
      const collaboration = read(
        `apps/docs/${language}backend/collaboration.md`,
      );
      for (const name of ["myRealtime", "myTemplatesProvider"])
        expect(collaboration).not.toContain(name);
    },
  );
});

it("the editor exports the init and stylesheet the collaboration sample imports", () => {
  expect(read("packages/editor/src/index.ts")).toContain(
    "export async function init(",
  );
  expect(
    JSON.parse(read("packages/editor/package.json")).exports,
  ).toHaveProperty("./style.css");
});

describe("the headless layout sample", () => {
  it("composes and renders the default and the German version", async () => {
    const log = vi.fn();
    const result = await runSnippet(
      "layout-headless.ts",
      "content, layout, mjml, composed, germanMjml, german",
      async () => ({}),
      { console: { log } },
    );
    expect(result.content.blocks[0].content).toBe("Welcome");
    expect(result.mjml).toContain("Welcome");
    expect(result.mjml).toContain("Legal notice");
    expect(result.mjml).not.toContain("Impressum");
    expect(result.germanMjml).toContain("Willkommen");
    expect(result.germanMjml).toContain("Impressum");
    expect(result.germanMjml).not.toContain("Welcome");
    expect(result.germanMjml).not.toContain("Legal notice");
    expect(result.german.settings.locale).toBe("de");
    expect(
      result.german.blocks.map((block: { type: string }) => block.type),
    ).not.toContain("slot");
    expect(result.composed.blocks).toHaveLength(2);
    expect(log).toHaveBeenCalledWith(true, true, 2, "de");
  });
});

class FakeEventSource {
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];
  readyState = 1;
  closed = false;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, ((event: { data: string }) => void)[]>();
  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(name: string, listener: (event: { data: string }) => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }
  emit(name: string, data: unknown) {
    for (const listener of this.listeners.get(name) ?? [])
      listener({ data: JSON.stringify(data) });
  }
  close() {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }
}

describe("the collaboration client sample", () => {
  async function mount(
    respond: (
      url: string,
      options: RequestInit,
    ) => { status: number; body: unknown },
  ) {
    FakeEventSource.instances = [];
    const requests: { url: string; options: RequestInit }[] = [];
    const fetch = async (url: string, options: RequestInit = {}) => {
      requests.push({ url, options });
      const { status, body } = respond(url, options);
      return { ok: status < 400, status, json: async () => body };
    };
    const load = vi.fn(async () => {});
    let config: any;
    await runSnippet(
      "collaboration-client.ts",
      "editor",
      async (given) => {
        config = given;
        return { load };
      },
      { fetch, EventSource: FakeEventSource },
    );
    return { config, collaboration: config.collaboration, requests, load };
  }
  const ok = () => ({ status: 200, body: { revision: 4 } });
  const handlers = () => ({
    onBatch: vi.fn(),
    onResync: vi.fn(),
    onLock: vi.fn(),
    onUnlock: vi.fn(),
    onMembers: vi.fn(),
    onConnectionChange: vi.fn(),
  });

  it("mounts the editor with the provider and loads the template", async () => {
    const { config, load, requests } = await mount(() => ({
      status: 200,
      body: { id: "tpl_123", revision: 3, content: {} },
    }));
    expect(config.container).toBe("#editor");
    expect(config.user).toEqual({ id: "u_7", name: "Ada Lovelace" });
    expect(Object.keys(config.collaboration).sort()).toEqual([
      "acquireLock",
      "join",
      "operationsAfter",
      "releaseLock",
      "renewLock",
      "submit",
    ]);
    expect(config.templates.create).toBe(false);
    expect(config.templates.save).toBe(false);
    expect(load).toHaveBeenCalledWith("tpl_123");
    expect(await config.templates.load("tpl_123")).toEqual({
      id: "tpl_123",
      revision: 3,
      content: {},
    });
    expect(requests.map((request) => request.url)).toEqual([
      "/api/templates/tpl_123",
    ]);
  });

  it("joins by subscribing first, forwards every event and leaves", async () => {
    const { collaboration, requests } = await mount(() => ({
      status: 200,
      body: { revision: 4, locks: [], members: [] },
    }));
    const given = handlers();
    const join = await collaboration.join(
      "tpl_123",
      { sessionId: "s1" },
      given,
    );
    const [events] = FakeEventSource.instances;
    expect(events.url).toBe("/api/templates/tpl_123/events?sessionId=s1");
    expect(requests).toEqual([
      {
        url: "/api/templates/tpl_123/join",
        options: { method: "POST", headers: { "X-Session-Id": "s1" } },
      },
    ]);
    expect(join).toMatchObject({ revision: 4, locks: [], members: [] });
    events.emit("batch", { revision: 5 });
    events.emit("resync", { revision: 6, actor: { type: "mcp" } });
    events.emit("lock", { blockId: "b1" });
    events.emit("unlock", { blockId: "b1", sessionId: "s2", locale: "de" });
    events.emit("members", [{ sessionId: "s2" }]);
    expect(given.onBatch).toHaveBeenCalledWith({ revision: 5 });
    expect(given.onResync).toHaveBeenCalledWith(6, { type: "mcp" });
    expect(given.onLock).toHaveBeenCalledWith({ blockId: "b1" });
    expect(given.onUnlock).toHaveBeenCalledWith("b1", "s2", "de");
    expect(given.onMembers).toHaveBeenCalledWith([{ sessionId: "s2" }]);
    events.onopen!();
    events.readyState = 0;
    events.onerror!();
    events.readyState = FakeEventSource.CLOSED;
    events.onerror!();
    expect(given.onConnectionChange.mock.calls).toEqual([
      ["connected"],
      ["reconnecting"],
      ["offline"],
    ]);
    join.leave();
    expect(events.closed).toBe(true);
  });

  it("replaces the subscription when the editor joins the same template again", async () => {
    const { collaboration } = await mount(() => ({
      status: 200,
      body: { revision: 4, locks: [], members: [] },
    }));
    await collaboration.join("tpl_123", { sessionId: "s1" }, handlers());
    await collaboration.join("tpl_123", { sessionId: "s1" }, handlers());
    expect(FakeEventSource.instances.map((events) => events.closed)).toEqual([
      true,
      false,
    ]);
  });

  it("sends the session id with every request and the locale with locks", async () => {
    const { collaboration, requests } = await mount(() => ok());
    await collaboration.join("tpl_123", { sessionId: "s1" }, handlers());
    requests.length = 0;
    const batch = { batchId: "b", baseRevision: 4, ops: [] };
    await collaboration.submit("tpl_123", batch);
    await collaboration.operationsAfter("tpl_123", 4);
    await collaboration.acquireLock("tpl_123", "b1", "de");
    await collaboration.acquireLock("tpl_123", "b1");
    await collaboration.renewLock("tpl_123", "b1", "de");
    await collaboration.renewLock("tpl_123", "b1");
    await collaboration.releaseLock("tpl_123", "b1", "de");
    expect(
      requests.map(({ url, options }) => [
        options.method ?? "GET",
        url,
        (options.headers as Record<string, string>)["X-Session-Id"],
        options.body,
      ]),
    ).toEqual([
      [
        "POST",
        "/api/templates/tpl_123/operations",
        "s1",
        JSON.stringify(batch),
      ],
      ["GET", "/api/templates/tpl_123/operations?after=4", "s1", undefined],
      [
        "POST",
        "/api/templates/tpl_123/locks",
        "s1",
        '{"blockId":"b1","locale":"de"}',
      ],
      [
        "POST",
        "/api/templates/tpl_123/locks",
        "s1",
        '{"blockId":"b1","locale":null}',
      ],
      ["PUT", "/api/templates/tpl_123/locks/b1?locale=de", "s1", undefined],
      ["PUT", "/api/templates/tpl_123/locks/b1", "s1", undefined],
      ["DELETE", "/api/templates/tpl_123/locks/b1?locale=de", "s1", undefined],
    ]);
    expect(requests.at(-1)!.options.keepalive).toBe(true);
  });

  it("rejects a refused request with its status, code and holder", async () => {
    const holder = { sessionId: "s2", name: "Grace" };
    const { collaboration } = await mount((url) =>
      url.endsWith("/locks")
        ? { status: 409, body: { code: "lock_held", holder, message: "Held" } }
        : { status: 502, body: {} },
    );
    await expect(
      collaboration.acquireLock("tpl_123", "b1", null),
    ).rejects.toMatchObject({
      message: "Held",
      statusCode: 409,
      code: "lock_held",
      holder,
    });
    const failure = await collaboration
      .submit("tpl_123", { batchId: "b", baseRevision: 0, ops: [] })
      .catch((error: Error) => error);
    expect(failure).toMatchObject({ message: "HTTP 502", statusCode: 502 });
  });
});
