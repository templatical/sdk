import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  DEFAULT_PORT,
  deepEqual,
  listWorkingFiles,
  readWorkingFile,
  startBridge,
  startBridgePreferring,
  type BridgeHandle,
} from "../src/live/index";

const TEMPLATE = {
  blocks: [
    {
      id: "title_1",
      type: "title",
      content: "Hello",
      level: 1,
      textAlign: "left",
      styles: { padding: { top: 8, right: 8, bottom: 8, left: 8 } },
    },
  ],
  settings: {
    width: 600,
    backgroundColor: "#ffffff",
    textColor: "#111111",
    fontFamily: "Arial, sans-serif",
    linkUnderline: true,
    locale: "en",
  },
};

const open: BridgeHandle[] = [];
const dirs: string[] = [];

// `null` means "create the project with no working file" — an explicit sentinel
// rather than `undefined`, which would silently fall back to the default.
function project(withTemplate: unknown = TEMPLATE) {
  const dir = mkdtempSync(join(tmpdir(), "tpl-live-"));
  dirs.push(dir);
  mkdirSync(join(dir, ".templatical"), { recursive: true });
  if (withTemplate !== null) {
    writeFileSync(
      join(dir, ".templatical", "template.json"),
      JSON.stringify(withTemplate),
      "utf8",
    );
  }
  return dir;
}

async function bridge(cwd: string) {
  const handle = await startBridge({ cwd, port: 0 });
  open.push(handle);
  return handle;
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((h) => h.close()));
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
});

describe("deepEqual", () => {
  it("treats key order as insignificant but value differences as significant", () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("distinguishes arrays from objects and respects array order", () => {
    expect(deepEqual([1, 2], [1, 2])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual([], {})).toBe(false);
  });

  it("does not treat a missing key as equal to an extra key", () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
  });
});

describe("readWorkingFile", () => {
  it("returns the parsed template when the file exists", () => {
    const dir = project();
    const got = readWorkingFile(
      resolve(dir, ".templatical", "template.json"),
    ) as typeof TEMPLATE;
    expect(got.blocks[0].id).toBe("title_1");
  });

  it("returns null for an absent file and for unparseable JSON", () => {
    const dir = project(null);
    expect(readWorkingFile(resolve(dir, ".templatical", "nope.json"))).toBe(
      null,
    );
    const bad = resolve(dir, ".templatical", "bad.json");
    writeFileSync(bad, "{ not json", "utf8");
    expect(readWorkingFile(bad)).toBe(null);
  });
});

describe("listWorkingFiles", () => {
  it("lists .json working files sorted, ignoring other files", () => {
    const dir = project();
    writeFileSync(join(dir, ".templatical", "alpha.json"), "{}", "utf8");
    writeFileSync(join(dir, ".templatical", "live-server.pid"), "{}", "utf8");
    expect(listWorkingFiles(dir)).toEqual(["alpha.json", "template.json"]);
  });

  it("returns an empty array when there is no .templatical folder", () => {
    const dir = mkdtempSync(join(tmpdir(), "tpl-empty-"));
    dirs.push(dir);
    expect(listWorkingFiles(dir)).toEqual([]);
  });
});

describe("bridge HTTP surface", () => {
  it("serves the harness with the CDN version substituted", async () => {
    const h = await bridge(project());
    const res = await fetch(h.url);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).not.toContain("{{EDITOR_VERSION}}");
    expect(html).toContain("@templatical/editor@");
  });

  it("GET /template returns the working file, and 204 when there is none", async () => {
    const withFile = await bridge(project());
    const res = await fetch(`${withFile.url}template`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(TEMPLATE);

    const without = await bridge(project(null));
    expect((await fetch(`${without.url}template`)).status).toBe(204);
  });

  it("returns 404 for an unknown path", async () => {
    const h = await bridge(project());
    expect((await fetch(`${h.url}nope`)).status).toBe(404);
  });
});

describe("divergence state machine", () => {
  async function post(h: BridgeHandle, body: unknown) {
    return fetch(`${h.url}content`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("starts undivergent with no content", async () => {
    const h = await bridge(project());
    expect(h.getEditorState()).toEqual({
      divergent: false,
      content: null,
      annotations: [],
    });
  });

  it("a baseline post records content without flagging divergence", async () => {
    const h = await bridge(project());
    await post(h, { content: TEMPLATE, baseline: true });
    expect(h.getEditorState()).toEqual({
      divergent: false,
      content: TEMPLATE,
      annotations: [],
    });
  });

  it("an identical non-baseline post is not divergence (editor normalization)", async () => {
    const h = await bridge(project());
    await post(h, { content: TEMPLATE, baseline: true });
    await post(h, { content: structuredClone(TEMPLATE) });
    expect(h.getEditorState().divergent).toBe(false);
  });

  it("a differing non-baseline post flags divergence and exposes the edit", async () => {
    const h = await bridge(project());
    await post(h, { content: TEMPLATE, baseline: true });
    const edited = structuredClone(TEMPLATE);
    edited.blocks[0].content = "Edited in the browser";
    await post(h, { content: edited });

    const state = h.getEditorState();
    expect(state.divergent).toBe(true);
    expect((state.content as typeof TEMPLATE).blocks[0].content).toBe(
      "Edited in the browser",
    );
  });

  it("does not flag divergence before any baseline exists", async () => {
    const h = await bridge(project());
    await post(h, { content: TEMPLATE });
    expect(h.getEditorState().divergent).toBe(false);
  });

  it("GET /content mirrors getEditorState exactly", async () => {
    const h = await bridge(project());
    await post(h, { content: TEMPLATE, baseline: true });
    const edited = structuredClone(TEMPLATE);
    edited.blocks[0].content = "Changed";
    await post(h, { content: edited });

    const viaHttp = await (await fetch(`${h.url}content`)).json();
    expect(viaHttp).toEqual(h.getEditorState());
    expect(viaHttp.divergent).toBe(true);
  });
});

describe("in-process reload (the path a future MCP server would call directly)", () => {
  it("re-reads the working file and clears divergence without an HTTP call", async () => {
    const dir = project();
    const h = await bridge(dir);
    await fetch(`${h.url}content`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: TEMPLATE, baseline: true }),
    });
    const edited = structuredClone(TEMPLATE);
    edited.blocks[0].content = "Hand edit";
    await fetch(`${h.url}content`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: edited }),
    });
    expect(h.getEditorState().divergent).toBe(true);

    const next = structuredClone(TEMPLATE);
    next.blocks[0].content = "Agent update";
    writeFileSync(
      join(dir, ".templatical", "template.json"),
      JSON.stringify(next),
      "utf8",
    );

    const result = h.reload();
    expect(result).toEqual({ ok: true, clients: 0 });
    expect(h.getEditorState()).toEqual({
      divergent: false,
      content: null,
      annotations: [],
    });
    expect((readWorkingFile(h.workingPath) as typeof TEMPLATE).blocks[0].content).toBe(
      "Agent update",
    );
  });

  it("reports the number of connected pages it pushed to", async () => {
    const h = await bridge(project());
    const controller = new AbortController();
    const streamed = await fetch(`${h.url}events`, {
      signal: controller.signal,
    });
    // Read the ready frame so the connection is fully established server-side.
    const reader = streamed.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain("event: ready");

    expect(h.reload().clients).toBe(1);

    controller.abort();
    await reader.cancel().catch(() => {});
  });

  it("exposes the resolved working path", async () => {
    const dir = project();
    const h = await bridge(dir);
    expect(h.workingPath).toBe(resolve(dir, ".templatical", "template.json"));
  });
});

describe("startBridgePreferring", () => {
  it("uses the preferred port when it is free", async () => {
    const h = await startBridgePreferring({ cwd: project(), preferredPort: 0 });
    open.push(h);
    expect(h.fellBack).toBe(false);
  });

  it("falls back to a free port when the preferred one is busy", async () => {
    const first = await bridge(project());
    const second = await startBridgePreferring({
      cwd: project(),
      preferredPort: first.port,
    });
    open.push(second);

    expect(second.fellBack).toBe(true);
    expect(second.preferredPort).toBe(first.port);
    expect(second.port).not.toBe(first.port);
  });

  it("defaults the preferred port to 4747", () => {
    expect(DEFAULT_PORT).toBe(4747);
  });
});
