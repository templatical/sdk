import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBridge, type BridgeHandle } from "../src/live/index";

let dir: string;
let bridge: BridgeHandle;

const TEMPLATE = { blocks: [], settings: { width: 600 } };

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`http://localhost:${bridge.port}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function getContent(): Promise<{
  divergent: boolean;
  content: unknown;
  annotations: Array<{ id: string; blockId: string | null; text: string }>;
}> {
  const res = await fetch(`http://localhost:${bridge.port}/content`);
  return res.json();
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "tt-annot-"));
  mkdirSync(join(dir, ".templatical"), { recursive: true });
  writeFileSync(
    join(dir, ".templatical", "t.json"),
    JSON.stringify(TEMPLATE),
    "utf8",
  );
  bridge = await startBridge({ cwd: dir, port: 0, file: ".templatical/t.json" });
});

afterEach(async () => {
  await bridge.close();
});

describe("annotation channel", () => {
  it("starts with no annotations", async () => {
    expect((await getContent()).annotations).toEqual([]);
  });

  it("accepts a note against a block and returns it from GET /content", async () => {
    const res = await post("/annotations", {
      blockId: "button_2",
      text: "make this punchier",
    });
    expect(res.status).toBe(201);
    const { annotations } = await getContent();
    expect(annotations).toHaveLength(1);
    expect(annotations[0]).toMatchObject({
      blockId: "button_2",
      text: "make this punchier",
    });
    expect(typeof annotations[0].id).toBe("string");
  });

  it("accepts a template-level note with no blockId", async () => {
    await post("/annotations", { text: "too long overall" });
    const { annotations } = await getContent();
    expect(annotations[0].blockId).toBeNull();
  });

  it("keeps notes in the order they were written", async () => {
    await post("/annotations", { text: "first" });
    await post("/annotations", { text: "second" });
    expect((await getContent()).annotations.map((a) => a.text)).toEqual([
      "first",
      "second",
    ]);
  });

  it("rejects a note with no text", async () => {
    expect((await post("/annotations", { blockId: "b" })).status).toBe(400);
    expect((await getContent()).annotations).toEqual([]);
  });

  it("clears annotations on reload, alongside the divergence flag", async () => {
    // The agent has necessarily read them by the time it writes and reloads,
    // so reload is the resolve step - there is no separate protocol.
    await post("/content", { content: TEMPLATE, baseline: true });
    await post("/content", { content: { blocks: [{ id: "x" }], settings: {} } });
    await post("/annotations", { text: "note" });
    expect((await getContent()).divergent).toBe(true);

    bridge.reload();

    const after = await getContent();
    expect(after.annotations).toEqual([]);
    expect(after.divergent).toBe(false);
  });

  it("exposes annotations to an in-process caller via getEditorState", async () => {
    await post("/annotations", { text: "in process" });
    expect(bridge.getEditorState().annotations.map((a) => a.text)).toEqual([
      "in process",
    ]);
  });
});
