import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "@vue/reactivity";
import type { BlockLock } from "@templatical/types";
import {
  CollaborationConflict,
  safeClone,
  createMenuBlock,
  sourceHash,
} from "@templatical/types";
import { useEditor } from "../src/editor";
import {
  COLLABORATION_LOCK_RENEW_MS,
  COLLABORATION_TYPING_DEBOUNCE_MS,
} from "../src/collaboration";
import {
  BASE,
  gate,
  openClient,
  settle,
  AGENT,
  type Client,
} from "./helpers/collaboration-harness";
import { FakeCollaborationServer } from "./helpers/fake-collaboration-server";

describe("collaboration locale locks", () => {
  let server: FakeCollaborationServer;
  const clients: Client[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    const content = safeClone(BASE);
    content.settings.locale = "en";
    content.settings.locales = ["de", "fr"];
    server = new FakeCollaborationServer(content);
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

  it("restores pruned translations through collaboration deletion and language-removal inverses", async () => {
    const content = safeClone(BASE);
    content.settings.locale = "en";
    content.settings.locales = ["de", "fr"];
    content.blocks = [
      createMenuBlock({
        id: "menu",
        items: [{ id: "home", text: "Home", url: "/" }],
        l10n: {
          de: {
            text: {
              "items.home.text": { value: "Start", source: sourceHash("Home") },
            },
          },
          fr: { hidden: true },
        },
      }),
    ];
    server = new FakeCollaborationServer(content);
    const a = await open("Ada");
    const before = safeClone(a.editor.content.value);
    a.editor.updateBlock("menu", { items: [] });
    await vi.advanceTimersByTimeAsync(COLLABORATION_TYPING_DEBOUNCE_MS);
    await settle();
    const after = safeClone(a.editor.content.value);
    expect(after.blocks[0].l10n).toEqual({ fr: { hidden: true } });
    expect(server.content).toEqual(after);
    a.editor.removeLocale("de");
    await settle();
    a.collaboration.undo();
    await settle();
    expect(a.editor.content.value).toEqual(after);
    expect(server.content).toEqual(after);
    a.collaboration.undo();
    await settle();
    expect(a.editor.content.value).toEqual(before);
    expect(server.content).toEqual(before);
    expect(a.errors).toEqual([]);
    expect(a.notices).toEqual([]);
  });

  it("lets two sessions select the same block in different languages and re-requests on switch", async () => {
    const a = await open("Ada");
    const b = await open("Grace");
    a.collaboration.setLockLocale("de");
    b.collaboration.setLockLocale("fr");
    a.editor.selectBlock("t1");
    await settle();
    server.deliverAll();
    await settle();
    b.editor.selectBlock("t1");
    await settle();
    server.deliverAll();
    expect(a.editor.state.selectedBlockId).toBe("t1");
    expect(b.editor.state.selectedBlockId).toBe("t1");
    expect([...server.locks.values()].map((lock) => lock.locale)).toEqual([
      "de",
      "fr",
    ]);
    expect(a.collaboration.locksOf("t1").map((lock) => lock.locale)).toEqual([
      "fr",
    ]);
    expect(a.collaboration.locks.value.has("t1\u0000fr")).toBe(true);
    a.collaboration.setLockLocale("fr");
    await settle();
    expect(a.editor.state.selectedBlockId).toBe(null);
    expect([...server.locks.values()].map((lock) => lock.locale)).toEqual([
      "fr",
    ]);
  });

  it("releases, reacquires, renews and releases the selected locale", async () => {
    const a = await open("Ada");
    const acquire = vi.spyOn(a.provider, "acquireLock");
    const release = vi.spyOn(a.provider, "releaseLock");
    const renew = vi.spyOn(a.provider, "renewLock");
    a.editor.selectBlock("t1");
    await settle();
    a.collaboration.setLockLocale("de");
    await settle();
    expect(release).toHaveBeenCalledWith(server.templateId, "t1", null);
    expect(acquire).toHaveBeenLastCalledWith(server.templateId, "t1", "de");
    await vi.advanceTimersByTimeAsync(COLLABORATION_LOCK_RENEW_MS);
    expect(renew).toHaveBeenLastCalledWith(server.templateId, "t1", "de");
    a.editor.selectBlock(null);
    await settle();
    expect(release).toHaveBeenLastCalledWith(server.templateId, "t1", "de");
    expect(server.locks.size).toBe(0);
  });

  it("coalesces German edits and commits locale operations through a French lock", async () => {
    const a = await open("Ada");
    const b = await open("Grace");
    b.collaboration.setLockLocale("fr");
    b.editor.selectBlock("t1");
    await settle();
    server.deliverAll();
    a.collaboration.setLockLocale("de");
    const write = (value: string) => {
      a.editor.content.value.blocks[0].l10n = {
        de: { text: { content: { value, source: "12345678" } } },
      };
    };
    write("Hal");
    await settle();
    expect(server.submits).toBe(0);
    await vi.advanceTimersByTimeAsync(200);
    write("Hallo");
    await settle();
    await vi.advanceTimersByTimeAsync(COLLABORATION_TYPING_DEBOUNCE_MS);
    expect(server.submitted.map((batch) => batch.ops)).toEqual([
      [
        {
          op: "updateBlockLocale",
          blockId: "t1",
          locale: "de",
          text: { content: { value: "Hallo", source: "12345678" } },
        },
      ],
    ]);
    expect(a.errors).toEqual([]);
    server.deliverAll();
    expect(b.remote[0].locale).toBe("de");
  });

  it("keeps coexisting locks through replacement and ignores an unlock for another locale", async () => {
    const a = await open("Ada");
    const holder = (sessionId: string) => ({
      sessionId,
      type: "user" as const,
      id: sessionId,
      name: sessionId,
      color: "#000",
    });
    a.handlers().onLock({
      blockId: "t1",
      locale: "de",
      holder: holder("de"),
      expiresAt: "",
    });
    a.handlers().onLock({
      blockId: "t1",
      locale: "fr",
      holder: holder("fr"),
      expiresAt: "",
    });
    expect(a.collaboration.locksOf("t1")).toHaveLength(2);
    a.handlers().onUnlock("t1", "de", "fr");
    expect(a.collaboration.locksOf("t1")).toHaveLength(2);
    a.handlers().onLock({
      blockId: "t1",
      locale: "fr",
      holder: holder("de"),
      expiresAt: "",
    });
    a.handlers().onUnlock("t1", "de", "de");
    expect(a.collaboration.locksOf("t1")).toEqual([
      { blockId: "t1", locale: "fr", holder: holder("de"), expiresAt: "" },
    ]);
  });

  it("keeps a live locale lock when a stale join lists its previous holder", async () => {
    const provider = server.provider("Ada");
    const answer = gate();
    const join = provider.join.bind(provider);
    const holder = (sessionId: string) => ({
      sessionId,
      type: "user" as const,
      id: sessionId,
      name: sessionId,
      color: "#000",
    });
    vi.spyOn(provider, "join").mockImplementationOnce(async (...args) => {
      const joined = await join(...args);
      await answer.wait;
      return {
        ...joined,
        locks: [
          { blockId: "t1", locale: "de", holder: holder("old"), expiresAt: "" },
        ],
      };
    });
    const a = await openClient(server, "Ada", { provider });
    clients.push(a);
    a.handlers().onLock({
      blockId: "t1",
      locale: "de",
      holder: holder("new"),
      expiresAt: "",
    });
    a.handlers().onLock({
      blockId: "t1",
      locale: "fr",
      holder: holder("fr"),
      expiresAt: "",
    });
    answer.open();
    await settle();
    expect(
      a.collaboration
        .locksOf("t1")
        .map((lock) => [lock.locale, lock.holder.name]),
    ).toEqual([
      ["de", "new"],
      ["fr", "fr"],
    ]);
  });

  it("replaces a provisional default-view refusal with the German join lock before its unlock", async () => {
    const provider = server.provider("Ada");
    const answer = gate();
    const join = provider.join.bind(provider);
    const german: BlockLock = {
      blockId: "t1",
      locale: "de",
      holder: {
        sessionId: "grace",
        type: "user",
        id: "grace",
        name: "Grace",
        color: "#000",
      },
      expiresAt: "2026-10-25T12:00:30.000Z",
    };
    vi.spyOn(provider, "join").mockImplementationOnce(async (...args) => {
      const joined = await join(...args);
      await answer.wait;
      return { ...joined, locks: [german] };
    });
    vi.spyOn(provider, "acquireLock").mockRejectedValueOnce(
      new CollaborationConflict("Held", {
        code: "lock_held",
        holder: german.holder,
      }),
    );
    const a = await openClient(server, "Ada", { provider });
    clients.push(a);
    a.editor.selectBlock("t1");
    await settle();
    const provisional = a.collaboration.locksOf("t1");
    expect(a.editor.state.selectedBlockId).toBe(null);
    answer.open();
    await settle();
    const joined = a.collaboration.locksOf("t1");
    a.handlers().onUnlock("t1", "grace", "de");
    expect(a.collaboration.locksOf("t1")).toEqual([]);
    expect(a.editor.isBlockLocked("t1")).toBe(false);
    expect(joined).toEqual([german]);
    expect(provisional).toEqual([
      { blockId: "t1", holder: german.holder, expiresAt: "" },
    ]);
  });

  it("replaces a provisional language-view refusal with authoritative onLock data", async () => {
    const a = await open("Ada");
    const german: BlockLock = {
      blockId: "t1",
      locale: "de",
      holder: {
        sessionId: "grace",
        type: "user",
        id: "grace",
        name: "Grace",
        color: "#000",
      },
      expiresAt: "2026-10-25T12:00:30.000Z",
    };
    vi.spyOn(a.provider, "acquireLock").mockRejectedValueOnce(
      new CollaborationConflict("Held", {
        code: "lock_held",
        holder: german.holder,
      }),
    );
    a.collaboration.setLockLocale("fr");
    a.editor.selectBlock("t1");
    await settle();
    const provisional = a.collaboration.locksOf("t1");
    a.handlers().onLock(german);
    expect(a.collaboration.locksOf("t1")).toEqual([german]);
    a.handlers().onUnlock("t1", "grace", "de");
    expect(a.collaboration.locksOf("t1")).toEqual([]);
    expect(provisional).toEqual([
      { blockId: "t1", holder: german.holder, expiresAt: "" },
    ]);
  });

  it("retains German holder A's provisional refusal through French holder B's lock and unlock", async () => {
    const local = await open("Local");
    const german = cachedLock("de", "A");
    const french = cachedLock("fr", "B");
    vi.spyOn(local.provider, "acquireLock").mockRejectedValueOnce(
      new CollaborationConflict("Held", {
        code: "lock_held",
        holder: german.holder,
      }),
    );
    local.collaboration.setLockLocale("de");
    local.editor.selectBlock("t1");
    await settle();
    expect(local.editor.isBlockLocked("t1")).toBe(true);

    local.handlers().onLock(french);
    local.handlers().onUnlock("t1", "B", "fr");

    expect(local.editor.isBlockLocked("t1")).toBe(true);
    expect(
      local.collaboration.locksOf("t1").map((lock) => lock.holder.sessionId),
    ).toEqual(["A"]);
    local.editor.updateBlock("t1", { content: "Refused" } as never);
    expect(local.editor.content.value.blocks[0]).toMatchObject({
      content: "Hi",
    });

    local.handlers().onUnlock("t1", "A", "de");
    expect(local.collaboration.locksOf("t1")).toEqual([]);
    expect(local.editor.isBlockLocked("t1")).toBe(false);
    local.editor.updateBlock("t1", { content: "Allowed" } as never);
    expect(local.editor.content.value.blocks[0]).toMatchObject({
      content: "Allowed",
    });
  });

  it("clears provisional refusals on matching block/session unlocks regardless of locale", async () => {
    for (const locale of [null, "de", "fr"]) {
      const a = await open("Ada");
      const holder = {
        sessionId: "grace",
        type: "user" as const,
        id: "grace",
        name: "Grace",
        color: "#000",
      };
      vi.spyOn(a.provider, "acquireLock").mockRejectedValueOnce(
        new CollaborationConflict("Held", { code: "lock_held", holder }),
      );
      a.editor.selectBlock("t1");
      await settle();
      a.handlers().onUnlock("d1", "grace", locale);
      a.handlers().onUnlock("t1", "someone-else", locale);
      expect(a.collaboration.locksOf("t1")).toHaveLength(1);
      a.handlers().onUnlock("t1", "grace", locale);
      expect(a.collaboration.locksOf("t1")).toEqual([]);
      expect(a.editor.isBlockLocked("t1")).toBe(false);
    }
  });

  it.each(["initial", "reconnect"] as const)(
    "ignores conflicting snapshot locks after a delayed %s join",
    async (mode) => {
      for (const [snapshotLocale, liveLocale, expectedLocales] of [
        [null, "de", ["de"]],
        ["de", null, [null]],
        ["fr", null, [null]],
        ["fr", "de", ["de", "fr"]],
      ] as const) {
        const provider = server.provider("Ada");
        const answer = gate();
        const join = provider.join.bind(provider);
        const snapshot = cachedLock(snapshotLocale, "snapshot");
        const unrelated = cachedLock(null, "unrelated", "d1");
        const delayJoin = async (...args: Parameters<typeof join>) => {
          const joined = await join(...args);
          await answer.wait;
          return { ...joined, locks: [snapshot, unrelated] };
        };
        if (mode === "initial")
          vi.spyOn(provider, "join").mockImplementationOnce(delayJoin);
        const a = await openClient(server, "Ada", { provider });
        clients.push(a);
        if (mode === "reconnect") {
          vi.spyOn(provider, "join").mockImplementationOnce(delayJoin);
          a.handlers().onConnectionChange("reconnecting");
          a.handlers().onConnectionChange("connected");
          await settle();
        }
        const live = cachedLock(liveLocale, "live");
        a.handlers().onLock(live);
        answer.open();
        await settle();
        expect(
          a.collaboration.locksOf("t1").map((lock) => lock.locale),
        ).toEqual(expectedLocales);
        expect(a.collaboration.locksOf("t1")).toContainEqual(live);
        expect(a.collaboration.locksOf("d1")).toEqual([unrelated]);
      }
    },
  );

  function cachedLock(
    locale: string | null,
    name: string,
    blockId = "t1",
  ): BlockLock {
    return {
      blockId,
      locale,
      holder: { sessionId: name, type: "user", id: name, name, color: "#000" },
      expiresAt: "2026-10-25T12:00:30.000Z",
    };
  }

  async function delayedAcquisition(
    requested: string | null,
    granted: string | null,
    snapshotLocales: (string | null)[],
  ) {
    const provider = server.provider("Ada");
    const joined = gate();
    const join = provider.join.bind(provider);
    const snapshots = snapshotLocales.map((locale, index) =>
      cachedLock(locale, "snapshot-" + index),
    );
    const unrelated = cachedLock(null, "unrelated", "d1");
    vi.spyOn(provider, "join").mockImplementationOnce(async (...args) => {
      const answer = await join(...args);
      await joined.wait;
      return { ...answer, locks: [...snapshots, unrelated] };
    });
    const grantedAnswer = gate();
    const acquire = provider.acquireLock!.bind(provider);
    vi.spyOn(provider, "acquireLock").mockImplementationOnce(
      async (templateId, blockId) => {
        const lock = await acquire(templateId, blockId, granted);
        await grantedAnswer.wait;
        return lock;
      },
    );
    const a = await openClient(server, "Ada", { provider });
    clients.push(a);
    a.collaboration.setLockLocale(requested);
    a.editor.selectBlock("t1");
    await settle();
    joined.open();
    await settle();
    expect(a.collaboration.locksOf("t1")).toEqual(snapshots);
    grantedAnswer.open();
    await settle();
    expect(a.collaboration.locksOf("d1")).toEqual([unrelated]);
    expect(a.errors).toEqual([]);
    return a;
  }

  it("clears every cached language lock after a delayed default acquisition", async () => {
    const a = await delayedAcquisition(null, null, ["de", "fr"]);
    expect(a.collaboration.locksOf("t1")).toEqual([]);
    expect(a.editor.isBlockLocked("t1")).toBe(false);
    expect(a.editor.state.selectedBlockId).toBe("t1");
  });

  it("clears default and matching cached locks after delayed German acquisitions while keeping French", async () => {
    for (const [snapshotLocales, expectedLocales] of [
      [[null], []],
      [["de", "fr"], ["fr"]],
    ] as [Array<string | null>, Array<string | null>][]) {
      const a = await delayedAcquisition("de", "de", snapshotLocales);
      expect(a.collaboration.locksOf("t1").map((lock) => lock.locale)).toEqual(
        expectedLocales,
      );
      expect(a.editor.isBlockLocked("t1")).toBe(false);
      a.editor.selectBlock(null);
      await settle();
    }
  });

  it("clears conflicts using the granted default locale when German was requested", async () => {
    const a = await delayedAcquisition("de", null, ["de", "fr"]);
    expect(a.collaboration.locksOf("t1")).toEqual([]);
    expect(a.editor.isBlockLocked("t1")).toBe(false);
  });

  it("reports the first locale operation of a remote batch, including settings operations", async () => {
    const a = await open("Ada");
    server.pushAs(AGENT, [
      { op: "updateSettings", set: { width: 640 } },
      { op: "updateSettingsLocale", locale: "fr", set: { direction: "rtl" } },
      { op: "updateBlockLocale", blockId: "t1", locale: "de", hidden: true },
    ]);
    server.deliverAll();
    expect(a.remote[0].locale).toBe("fr");
  });

  it("checks editor property edits per view and structure edits against every language, ignoring own and unrelated locks", () => {
    const lock = (
      blockId: string,
      locale: string | null,
      sessionId = "other",
    ): BlockLock => ({
      blockId,
      locale,
      holder: {
        sessionId,
        type: "user",
        id: sessionId,
        name: sessionId,
        color: "#000",
      },
      expiresAt: "",
    });
    const lockedBlocks = ref(
      new Map<string, BlockLock>([["t1\u0000fr", lock("t1", "fr")]]),
    );
    const lockLocale = ref<string | null>("de");
    const editor = useEditor({
      content: safeClone(BASE),
      lockedBlocks,
      lockLocale,
      lockSessionId: "self",
    });
    editor.updateBlock("t1", { content: "German edit" } as never);
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "German edit",
    });
    editor.removeBlock("t1");
    expect(editor.content.value.blocks[0].id).toBe("t1");
    editor.moveBlock("t1", 2);
    expect(editor.content.value.blocks[0].id).toBe("t1");
    lockLocale.value = "fr";
    editor.updateBlock("t1", { content: "Refused" } as never);
    editor.selectBlock("t1");
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "German edit",
    });
    expect(editor.state.selectedBlockId).toBe(null);
    lockLocale.value = null;
    expect(editor.isBlockLocked("t1")).toBe(true);
    lockedBlocks.value = new Map([
      ["t1", lock("t1", null, "self")],
      ["d1\u0000fr", lock("d1", "fr")],
    ]);
    editor.removeBlock("t1");
    expect(editor.content.value.blocks.map((block) => block.id)).toEqual([
      "s1",
      "d1",
    ]);
    lockedBlocks.value = new Map([["s1\u0000fr", lock("s1", "fr")]]);
    lockLocale.value = "de";
    editor.addBlock({ id: "new", type: "divider" } as never, "s1", 0);
    expect(editor.content.value.blocks[0]).toMatchObject({
      children: [[{ id: "p1" }], [{ id: "b1" }]],
    });
    editor.moveBlock("d1", 0, "s1", 0);
    expect(editor.content.value.blocks.map((block) => block.id)).toEqual([
      "s1",
      "d1",
    ]);
  });
});
