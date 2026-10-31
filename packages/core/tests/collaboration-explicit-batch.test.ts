import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CollaborationConflict,
  safeClone,
  type Operation,
} from "@templatical/types";
import {
  AGENT,
  BASE,
  gateSubmit,
  openClient,
  settle,
  text,
  type Client,
} from "./helpers/collaboration-harness";
import { FakeCollaborationServer } from "./helpers/fake-collaboration-server";

describe("explicit own-edit batches", () => {
  let server: FakeCollaborationServer;
  const clients: Client[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    const seed = safeClone(BASE);
    seed.settings.locale = "en";
    seed.settings.locales = ["de", "fr"];
    server = new FakeCollaborationServer(seed);
  });
  afterEach(() => {
    clients.splice(0).forEach((client) => client.scope.stop());
    vi.useRealTimers();
  });
  async function open(
    name: string,
    extra: Parameters<typeof openClient>[2] = {},
  ) {
    const client = await openClient(server, name, extra);
    clients.push(client);
    return client;
  }
  const op = { op: "setDefaultLocale", locale: "de" } as Operation;
  it("sends the explicit operation without origin, records an undo step and reports a template-level remote change", async () => {
    const a = await open("Ada");
    const b = await open("Grace");
    expect(a.collaboration.applyOperations([op], {}).applied).toBe(true);
    await settle();
    expect(server.submitted.at(-1)?.ops).toEqual([op]);
    expect(server.submitted.at(-1)).not.toHaveProperty("origin");
    server.deliverAll();
    expect(b.remote.at(-1)?.locale).toBe(null);
    expect(b.editor.content.value.settings.locale).toBe("de");
    a.collaboration.undo();
    await settle();
    expect(a.editor.content.value.settings.locale).toBe("en");
    expect(a.collaboration.canUndo.value).toBe(false);
  });
  it("gives consecutive own-edit batches separate undo steps", async () => {
    const a = await open("Ada");
    expect(a.collaboration.applyOperations([op], {}).applied).toBe(true);
    await settle();
    expect(
      a.collaboration.applyOperations(
        [{ op: "setDefaultLocale", locale: "fr" } as Operation],
        {},
      ).applied,
    ).toBe(true);
    await settle();
    a.collaboration.undo();
    await settle();
    expect(a.editor.content.value.settings.locale).toBe("de");
    expect(a.collaboration.canUndo.value).toBe(true);
    a.collaboration.undo();
    await settle();
    expect(a.editor.content.value.settings.locale).toBe("en");
  });
  it("leaves history including existing redo untouched on a local lock refusal", async () => {
    const a = await open("Ada");
    const b = await open("Grace");
    a.collaboration.applyOperations(
      [{ op: "updateSettings", set: { width: 640 } }],
      {},
    );
    await settle();
    a.collaboration.undo();
    await settle();
    b.collaboration.setLockLocale("fr");
    b.editor.selectBlock("t1");
    await settle();
    server.deliverAll();
    const before = safeClone(a.editor.content.value);
    const sent = server.submits;
    expect(a.collaboration.applyOperations([op], {})).toMatchObject({
      applied: false,
      error: { code: "locked_by_others" },
    });
    expect(a.editor.content.value).toEqual(before);
    expect(a.collaboration.canRedo.value).toBe(true);
    expect(a.collaboration.canUndo.value).toBe(false);
    expect(server.submits).toBe(sent);
    a.collaboration.redo();
    await settle();
    expect(a.editor.content.value.settings.width).toBe(640);
  });
  it("does not flush pending typing when an explicit batch is refused locally", async () => {
    const a = await open("Ada");
    a.editor.updateBlock("t1", { content: "Typing" } as never);
    await settle();
    const before = safeClone(a.editor.content.value);
    expect(a.collaboration.canUndo.value).toBe(false);
    expect(
      a.collaboration.applyOperations(
        [{ op: "setDefaultLocale", locale: "es" } as Operation],
        {},
      ).applied,
    ).toBe(false);
    expect(a.collaboration.canUndo.value).toBe(false);
    expect(server.submits).toBe(0);
    expect(a.editor.content.value).toEqual(before);
  });
  it("classifies a backend rejection as a refused edit and removes its undo step", async () => {
    const a = await open("Ada");
    server.failNextSubmit = new CollaborationConflict(
      "Other sessions hold locks on this template.",
      { code: "locked_by_others" },
    );
    expect(a.collaboration.applyOperations([op], {}).applied).toBe(true);
    await settle();
    expect(a.editor.content.value.settings.locale).toBe("en");
    expect(a.collaboration.canUndo.value).toBe(false);
    expect(a.notices).toContainEqual(
      expect.objectContaining({
        type: "editRefused",
        code: "locked_by_others",
      }),
    );
    expect(a.errors).toEqual([]);
  });
  /** Submit, confirm and deliver everything queued. */
  async function sync() {
    await settle();
    server.deliverAll();
    await settle();
  }
  const bob: Operation = {
    op: "updateBlock",
    blockId: "t1",
    set: { content: "Bob" },
  };
  it("reports the new language to a default-view session when another session makes it the default", async () => {
    const onLocaleChange = vi.fn();
    const a = await open("Ada", { onLocaleChange });
    server.pushAs(AGENT, [op]);
    await sync();
    expect(a.editor.content.value.settings.locale).toBe("de");
    expect(onLocaleChange.mock.calls).toEqual([["de"]]);
  });
  it("refuses Undo of Make default once another session's batch landed, keeping that edit", async () => {
    const a = await open("Ada");
    expect(a.collaboration.applyOperations([op], {}).applied).toBe(true);
    await sync();
    server.pushAs(AGENT, [bob]);
    await sync();
    const submits = server.submits;
    a.collaboration.undo();
    await sync();
    expect(a.notices).toContainEqual({
      type: "undoSkipped",
      code: "precondition_failed",
    });
    expect(server.submits).toBe(submits);
    for (const content of [a.editor.content.value, server.content]) {
      expect(content.settings.locale).toBe("de");
      expect(text(content)).toBe("Bob");
    }
    expect(a.collaboration.canUndo.value).toBe(false);
  });
  it("restores exactly on Undo and Redo when no other batch landed, also after an own edit and its undo", async () => {
    const a = await open("Ada");
    const before = safeClone(a.editor.content.value);
    a.collaboration.applyOperations([op], {});
    await sync();
    const promoted = safeClone(a.editor.content.value);
    a.collaboration.applyOperations(
      [{ op: "updateSettings", set: { width: 640 } }],
      {},
    );
    await sync();
    a.collaboration.undo();
    await sync();
    a.collaboration.undo();
    await sync();
    expect(a.editor.content.value).toEqual(before);
    expect(server.content).toEqual(before);
    a.collaboration.redo();
    await sync();
    expect(a.editor.content.value).toEqual(promoted);
    expect(server.content).toEqual(promoted);
    expect(a.notices).toEqual([]);
  });
  it("guards Redo of Make default the same way", async () => {
    const a = await open("Ada");
    a.collaboration.applyOperations([op], {});
    await sync();
    a.collaboration.undo();
    await sync();
    expect(a.editor.content.value.settings.locale).toBe("en");
    server.pushAs(AGENT, [bob]);
    await sync();
    const submits = server.submits;
    a.collaboration.redo();
    await sync();
    expect(a.notices).toContainEqual({
      type: "undoSkipped",
      code: "precondition_failed",
    });
    expect(server.submits).toBe(submits);
    for (const content of [a.editor.content.value, server.content]) {
      expect(content.settings.locale).toBe("en");
      expect(text(content)).toBe("Bob");
    }
  });
  it("refuses Undo of an own setContent once another session's batch landed", async () => {
    const a = await open("Ada");
    const replacement = safeClone(a.editor.content.value);
    replacement.settings.width = 700;
    a.collaboration.applyOperations(
      [{ op: "setContent", content: replacement }],
      {},
    );
    await sync();
    server.pushAs(AGENT, [bob]);
    await sync();
    a.collaboration.undo();
    await sync();
    expect(a.notices).toContainEqual({
      type: "undoSkipped",
      code: "precondition_failed",
    });
    for (const content of [a.editor.content.value, server.content]) {
      expect(content.settings.width).toBe(700);
      expect(text(content)).toBe("Bob");
    }
  });
  it("keeps an AI turn's snapshot undo exact across the turn's later batches", async () => {
    const a = await open("Ada");
    const before = safeClone(a.editor.content.value);
    const options = { origin: "ai", turn: "turn-1" } as const;
    const replacement = safeClone(before);
    replacement.settings.width = 700;
    a.collaboration.applyOperations(
      [{ op: "setContent", content: replacement }],
      options,
    );
    await sync();
    a.collaboration.applyOperations(
      [{ op: "updateSettings", set: { width: 720 } }],
      options,
    );
    await sync();
    a.collaboration.undo();
    await sync();
    expect(a.editor.content.value).toEqual(before);
    expect(server.content).toEqual(before);
    expect(a.notices).toEqual([]);
  });
  it("refuses Undo of an AI turn whose snapshot another session overtook before the turn's next batch", async () => {
    const a = await open("Ada");
    const options = { origin: "ai", turn: "t" } as const;
    const replacement = safeClone(a.editor.content.value);
    replacement.settings.width = 700;
    a.collaboration.applyOperations(
      [{ op: "setContent", content: replacement }],
      options,
    );
    await sync();
    server.pushAs(AGENT, [bob]);
    await sync();
    a.collaboration.applyOperations(
      [{ op: "updateSettings", set: { width: 720 } }],
      options,
    );
    await sync();
    const submits = server.submits;
    a.collaboration.undo();
    await sync();
    expect(a.notices).toContainEqual({
      type: "undoSkipped",
      code: "precondition_failed",
    });
    expect(server.submits).toBe(submits);
    for (const content of [a.editor.content.value, server.content]) {
      expect(content.settings.width).toBe(720);
      expect(text(content)).toBe("Bob");
    }
  });
  it("has the backend refuse Undo of Make default over a batch it committed but hadn't delivered", async () => {
    const a = await open("Ada");
    a.collaboration.applyOperations([op], {});
    await sync();
    server.pushAs(AGENT, [bob]);
    a.collaboration.undo();
    await sync();
    await sync();
    expect(server.submitted.at(-1)?.ops[0].op).toBe("setContent");
    expect(a.notices).toContainEqual({
      type: "undoSkipped",
      code: "precondition_failed",
    });
    expect(a.errors).toEqual([]);
    for (const content of [a.editor.content.value, server.content]) {
      expect(content.settings.locale).toBe("de");
      expect(text(content)).toBe("Bob");
    }
    expect(a.collaboration.canRedo.value).toBe(false);
  });
  it("keeps another session's edit on screen while a sent snapshot undo waits for the backend", async () => {
    const a = await open("Ada");
    a.collaboration.applyOperations([op], {});
    await sync();
    const { release } = gateSubmit(a.provider);
    a.collaboration.undo();
    await settle();
    expect(a.editor.content.value.settings.locale).toBe("en");
    server.pushAs(AGENT, [bob]);
    await sync();
    expect(a.editor.content.value.settings.locale).toBe("de");
    expect(text(a.editor.content.value)).toBe("Bob");
    release();
    await sync();
    await sync();
    expect(a.notices).toContainEqual({
      type: "undoSkipped",
      code: "precondition_failed",
    });
    for (const content of [a.editor.content.value, server.content]) {
      expect(content.settings.locale).toBe("de");
      expect(text(content)).toBe("Bob");
    }
  });
  it("resends a failed snapshot undo with its first baseRevision, so the backend refuses it after another batch landed", async () => {
    const a = await open("Ada");
    a.collaboration.applyOperations([op], {});
    await sync();
    server.failNextSubmit = new Error("offline");
    a.collaboration.undo();
    await settle();
    server.pushAs(AGENT, [bob]);
    await sync();
    await vi.advanceTimersByTimeAsync(1000);
    await sync();
    await sync();
    const attempts = server.submitted.filter((batch) =>
      batch.ops.some((sent) => sent.op === "setContent"),
    );
    expect(attempts).toHaveLength(2);
    expect(attempts[1].batchId).toBe(attempts[0].batchId);
    expect(attempts[1].baseRevision).toBe(attempts[0].baseRevision);
    expect(a.notices).toContainEqual({
      type: "undoSkipped",
      code: "precondition_failed",
    });
    for (const content of [a.editor.content.value, server.content]) {
      expect(content.settings.locale).toBe("de");
      expect(text(content)).toBe("Bob");
    }
  });
  it("drops a queued snapshot batch, unsent, when another session's batch arrives first", async () => {
    const a = await open("Ada");
    const { release } = gateSubmit(a.provider);
    a.collaboration.applyOperations(
      [{ op: "updateSettings", set: { width: 640 } }],
      {},
    );
    await settle();
    const replacement = safeClone(a.editor.content.value);
    replacement.settings.backgroundColor = "#000000";
    a.collaboration.applyOperations(
      [{ op: "setContent", content: replacement }],
      {},
    );
    await settle();
    server.pushAs(AGENT, [bob]);
    await sync();
    expect(a.notices).toContainEqual({
      type: "editRefused",
      code: "precondition_failed",
    });
    expect(text(a.editor.content.value)).toBe("Bob");
    expect(a.editor.content.value.settings.backgroundColor).not.toBe("#000000");
    release();
    await sync();
    expect(
      server.submitted.some((batch) =>
        batch.ops.some((sent) => sent.op === "setContent"),
      ),
    ).toBe(false);
    for (const content of [a.editor.content.value, server.content]) {
      expect(content.settings.width).toBe(640);
      expect(text(content)).toBe("Bob");
    }
    expect(a.collaboration.canUndo.value).toBe(true);
  });
  it("keeps defined AI turns coalesced after an explicit default-language edit", async () => {
    const a = await open("Ada");
    a.collaboration.applyOperations([op], {});
    await settle();
    const options = { origin: "ai", turn: "turn-1" } as const;
    a.collaboration.applyOperations(
      [{ op: "updateSettings", set: { width: 640 } }],
      options,
    );
    await settle();
    a.collaboration.applyOperations(
      [{ op: "updateSettings", set: { width: 660 } }],
      options,
    );
    await settle();
    a.collaboration.undo();
    await settle();
    expect(a.editor.content.value.settings).toMatchObject({
      locale: "de",
      width: 600,
    });
    expect(a.collaboration.canUndo.value).toBe(true);
    expect(
      server.submitted.filter((batch) => batch.origin === "ai"),
    ).toHaveLength(2);
  });
});

// The optional turn identifies AI work only; it cannot turn an own edit into AI history.
it("does not merge an own edit carrying a turn with the next AI batch", async () => {
  const server = new FakeCollaborationServer(safeClone(BASE));
  const a = await openClient(server, "Ada");
  try {
    a.collaboration.applyOperations(
      [{ op: "updateSettings", set: { width: 640 } }],
      { turn: "turn-1" },
    );
    await settle();
    a.collaboration.applyOperations(
      [{ op: "updateSettings", set: { width: 660 } }],
      { origin: "ai", turn: "turn-1" },
    );
    await settle();
    a.collaboration.undo();
    await settle();
    expect(a.editor.content.value.settings.width).toBe(640);
    expect(a.collaboration.canUndo.value).toBe(true);
  } finally {
    a.scope.stop();
  }
});
