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

async function putNote(id: string, body: unknown): Promise<Response> {
  return fetch(`http://localhost:${bridge.port}/annotations/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function deleteNote(id: string): Promise<Response> {
  return fetch(`http://localhost:${bridge.port}/annotations/${id}`, {
    method: "DELETE",
  });
}

async function getContent(): Promise<{
  divergent: boolean;
  content: unknown;
  annotations: Array<{
    id: string;
    blockId: string | null;
    parentBlockId: string | null;
    blockType: string | null;
    label: string;
    text: string;
    createdAt: number;
  }>;
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

  it("clears divergence on reload and leaves annotations in place", async () => {
    await post("/content", { content: TEMPLATE, baseline: true });
    await post("/content", { content: { blocks: [{ id: "x" }], settings: {} } });
    await post("/annotations", { text: "note" });
    expect((await getContent()).divergent).toBe(true);

    const result = bridge.reload();

    const after = await getContent();
    expect(result).toEqual({ ok: true, clients: 0, consumed: false });
    expect(after.annotations.map((a) => a.text)).toEqual(["note"]);
    expect(after.divergent).toBe(false);
  });

  it("consumes annotations on reload only when the working file was read", async () => {
    await post("/annotations", { text: "note" });
    const result = bridge.reload({ consumeAnnotations: true });
    expect(result.consumed).toBe(true);
    expect((await getContent()).annotations).toEqual([]);
  });

  it("does not consume annotations when the working file is missing", async () => {
    const missing = await startBridge({
      cwd: dir,
      port: 0,
      file: ".templatical/missing.json",
    });
    try {
      await fetch(`http://localhost:${missing.port}/annotations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "keep" }),
      });
      const result = missing.reload({ consumeAnnotations: true });
      expect(result).toEqual({ ok: true, clients: 0, consumed: false });
      expect(missing.getEditorState().annotations.map((a) => a.text)).toEqual([
        "keep",
      ]);
    } finally {
      await missing.close();
    }
  });

  it("consumes through POST /reload only when the body says so", async () => {
    await post("/annotations", { text: "note" });
    const plain = await post("/reload", {});
    expect(plain.status).toBe(200);
    expect(await plain.json()).toMatchObject({ ok: true, consumed: false });
    expect((await getContent()).annotations).toHaveLength(1);

    const consumed = await post("/reload", { consumeAnnotations: true });
    expect(await consumed.json()).toMatchObject({ ok: true, consumed: true });
    expect((await getContent()).annotations).toEqual([]);
  });

  it("exposes annotations to an in-process caller via getEditorState", async () => {
    await post("/annotations", { text: "in process" });
    expect(bridge.getEditorState().annotations.map((a) => a.text)).toEqual([
      "in process",
    ]);
  });

  it("stores parent, type, and label alongside the block id", async () => {
    const res = await post("/annotations", {
      blockId: "button_2",
      parentBlockId: "section_1",
      blockType: "button",
      label: "  Shop   now  ",
      text: "make this punchier",
    });
    expect(res.status).toBe(201);
    const note = (await getContent()).annotations[0];
    expect(note).toMatchObject({
      blockId: "button_2",
      parentBlockId: "section_1",
      blockType: "button",
      label: "Shop now",
      text: "make this punchier",
    });
    expect(note.label).toBe("Shop now");
  });

  it("stores a template-level note with null target fields and an empty label", async () => {
    await post("/annotations", { text: "too long overall" });
    expect((await getContent()).annotations[0]).toMatchObject({
      blockId: null,
      parentBlockId: null,
      blockType: null,
      label: "",
    });
  });

  it("drops a parent id that repeats the block id", async () => {
    await post("/annotations", {
      text: "here",
      blockId: "button_2",
      parentBlockId: "button_2",
    });
    expect((await getContent()).annotations[0].parentBlockId).toBeNull();
  });

  it("truncates a long label to 80 characters and a long block type to 40", async () => {
    await post("/annotations", {
      text: "here",
      blockId: "b",
      blockType: "x".repeat(50),
      label: "y".repeat(100),
    });
    const note = (await getContent()).annotations[0];
    expect(note.blockType).toHaveLength(40);
    expect(note.label).toHaveLength(80);
  });

  it("rejects text longer than 2000 characters and leaves the queue empty", async () => {
    const res = await post("/annotations", { text: "a".repeat(2001) });
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("A note can be at most 2000 characters.");
    expect((await getContent()).annotations).toEqual([]);
  });

  it("rejects the 41st note and keeps the first 40 in order", async () => {
    for (let i = 1; i <= 40; i++) {
      expect((await post("/annotations", { text: `n${i}` })).status).toBe(201);
    }
    const res = await post("/annotations", { text: "overflow" });
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("The note queue is full (40).");
    expect((await getContent()).annotations.map((a) => a.text)).toEqual(
      Array.from({ length: 40 }, (_, i) => `n${i + 1}`),
    );
  });

  it("gives two notes different ids", async () => {
    const first = await (await post("/annotations", { text: "first" })).json();
    const second = await (await post("/annotations", { text: "second" })).json();
    expect(second.id).not.toBe(first.id);
  });

  it("replaces the text of one note and leaves its place and createdAt", async () => {
    const created = await (
      await post("/annotations", {
        blockId: "button_2",
        parentBlockId: "section_1",
        blockType: "button",
        label: "Shop now",
        text: "first",
      })
    ).json();
    await post("/annotations", { text: "second" });

    const res = await putNote(created.id, { text: "  rewritten  " });
    expect(res.status).toBe(200);
    const notes = (await getContent()).annotations;
    expect(notes.map((a) => a.text)).toEqual(["rewritten", "second"]);
    expect(notes[0]).toMatchObject({
      id: created.id,
      blockId: "button_2",
      parentBlockId: "section_1",
      blockType: "button",
      label: "Shop now",
      createdAt: created.createdAt,
    });
  });

  it("rejects an empty edit and an unknown id", async () => {
    const created = await (await post("/annotations", { text: "keep" })).json();
    expect((await putNote(created.id, { text: "  " })).status).toBe(400);
    expect((await getContent()).annotations[0].text).toBe("keep");
    expect((await putNote("missing", { text: "x" })).status).toBe(404);
  });

  it("deletes one note and keeps the other", async () => {
    const first = await (await post("/annotations", { text: "first" })).json();
    await post("/annotations", { text: "second" });
    expect((await deleteNote(first.id)).status).toBe(204);
    expect((await getContent()).annotations.map((a) => a.text)).toEqual([
      "second",
    ]);
  });

  it("404s a delete of an unknown id and a second delete of the same id", async () => {
    const created = await (await post("/annotations", { text: "only" })).json();
    expect((await deleteNote(created.id)).status).toBe(204);
    expect((await deleteNote(created.id)).status).toBe(404);
    expect((await getContent()).annotations).toEqual([]);
  });

  it("mints a different id after a delete", async () => {
    const first = await (await post("/annotations", { text: "first" })).json();
    expect((await deleteNote(first.id)).status).toBe(204);
    const second = await (await post("/annotations", { text: "second" })).json();
    expect(second.id).not.toBe(first.id);
  });
});
