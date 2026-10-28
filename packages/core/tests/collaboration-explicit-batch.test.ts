import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CollaborationConflict,
  safeClone,
  type Operation,
} from "@templatical/types";
import {
  BASE,
  openClient,
  settle,
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
  async function open(name: string) {
    const client = await openClient(server, name);
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
