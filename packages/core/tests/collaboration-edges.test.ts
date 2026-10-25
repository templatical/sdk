import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "@vue/reactivity";
import type {
  Block,
  BlockLock,
  BlockLockHolder,
  CollaborationProvider,
  Template,
  TemplateContent,
  TemplatesProvider,
} from "@templatical/types";
import { safeClone } from "@templatical/types";
import { useEditor } from "../src/editor";
import {
  COLLABORATION_GAP_TIMEOUT_MS,
  COLLABORATION_LOCK_RENEW_MS,
  COLLABORATION_TYPING_DEBOUNCE_MS,
  useCollaboration,
} from "../src/collaboration";
import {
  AGENT,
  BASE,
  gate,
  ids,
  openClient,
  settle,
  text,
} from "./helpers/collaboration-harness";
import { FakeCollaborationServer } from "./helpers/fake-collaboration-server";

/**
 * The controller's edges outside the main flows: locks and presence as
 * broadcasts arrive out of order, joins that answer late or fail, switching
 * templates while requests are out, no template open, catch-up, the
 * history's limits, teardown and the page going away.
 */

const SECOND = {
  blocks: [{ id: "x1", type: "paragraph", content: "Second" }],
  settings: { width: 600 },
} as unknown as TemplateContent;

const GRACE: BlockLockHolder = {
  sessionId: "s-grace",
  type: "user",
  id: "grace",
  name: "Grace",
  color: "#ef4444",
};
const LINUS: BlockLockHolder = {
  sessionId: "s-linus",
  type: "user",
  id: "linus",
  name: "Linus",
  color: "#10b981",
};

function lock(
  blockId: string,
  holder: BlockLockHolder,
  expiresAt = "2026-10-19T12:00:30.000Z",
): BlockLock {
  return { blockId, holder, expiresAt };
}

/**
 * One editor that moves between two templates, each on its own fake server,
 * the way a backend routes by template id.
 */
function twoTemplates(name: string) {
  const first = new FakeCollaborationServer(BASE, "tpl-1");
  const second = new FakeCollaborationServer(SECOND, "tpl-2");
  const servers: Record<string, FakeCollaborationServer> = {
    "tpl-1": first,
    "tpl-2": second,
  };
  const providers = {
    "tpl-1": first.provider(name),
    "tpl-2": second.provider(name),
  } as Record<string, CollaborationProvider>;
  const provider: CollaborationProvider = {
    join: (id, session, handlers) => providers[id].join(id, session, handlers),
    submit: (id, batch) => providers[id].submit(id, batch),
    operationsAfter: (id, after) => providers[id].operationsAfter(id, after),
  };
  const templates: TemplatesProvider = {
    load: async (id) => servers[id].template(),
    create: async (input) => ({
      ...second.template(),
      content: safeClone(input.content),
    }),
    save: false,
  };
  return { first, second, providers, provider, templates };
}

describe("useCollaboration at the edges", () => {
  let server: FakeCollaborationServer;

  beforeEach(() => {
    vi.useFakeTimers();
    server = new FakeCollaborationServer(BASE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("others' locks", () => {
    it("ignores its own lock when the backend sends it back", async () => {
      const a = await openClient(server, "Ada");

      a.handlers().onLock(
        lock("t1", { ...GRACE, sessionId: a.collaboration.sessionId }),
      );

      expect(a.collaboration.locks.value.size).toBe(0);
      a.editor.selectBlock("t1");
      expect(a.editor.state.selectedBlockId).toBe("t1");
    });

    it("moves a session's lock to the block it takes next, before the unlock arrives", async () => {
      const a = await openClient(server, "Ada");

      a.handlers().onLock(lock("p1", GRACE));
      a.handlers().onLock(lock("b1", GRACE));
      a.handlers().onLock(lock("d1", LINUS));

      expect([...a.collaboration.locks.value.keys()]).toEqual([
        "b1\u0000",
        "d1\u0000",
      ]);
      // The late unlock of the block Grace moved off changes nothing.
      a.handlers().onUnlock("p1", GRACE.sessionId);
      expect([...a.collaboration.locks.value.keys()]).toEqual([
        "b1\u0000",
        "d1\u0000",
      ]);
    });

    it("ignores an unlock from a session that doesn't hold the block", async () => {
      const a = await openClient(server, "Ada");
      a.handlers().onLock(lock("p1", GRACE));

      a.handlers().onUnlock("p1", LINUS.sessionId);

      expect(a.collaboration.locks.value.get("p1\u0000")?.holder).toEqual(
        GRACE,
      );
    });

    it("drops the locks of a session that vanishes without letting go", async () => {
      const a = await openClient(server, "Ada");
      const member = (holder: BlockLockHolder) => ({
        sessionId: holder.sessionId,
        userId: holder.id,
        name: holder.name,
        type: "user" as const,
        color: holder.color,
      });
      a.handlers().onMembers([member(GRACE), member(LINUS)]);
      a.handlers().onLock(lock("p1", GRACE));
      a.handlers().onLock(lock("b1", LINUS));

      a.handlers().onMembers([member(LINUS)]);

      expect([...a.collaboration.locks.value.keys()]).toEqual(["b1\u0000"]);
      expect(a.collaboration.members.value.map((m) => m.name)).toEqual([
        "Linus",
      ]);
    });

    it("keeps the locks that arrive before its join answers, adds the join's, and leaves its own out", async () => {
      const provider = server.provider("Ada");
      const answer = gate();
      const join = provider.join.bind(provider);
      const own = (sessionId: string) =>
        lock("t1", { ...LINUS, sessionId, name: "Ada" });
      vi.spyOn(provider, "join").mockImplementationOnce(
        async (templateId, session, handlers) => {
          const joined = await join(templateId, session, handlers);
          await answer.wait;
          return {
            ...joined,
            locks: [
              own(session.sessionId),
              lock("p1", GRACE, "2026-10-19T12:05:00.000Z"),
              lock("b1", LINUS),
            ],
          };
        },
      );
      const a = await openClient(server, "Ada", { provider });
      const live = lock("p1", GRACE, "2026-10-19T12:00:30.000Z");

      a.handlers().onLock(live);
      answer.open();
      await settle();

      expect(a.collaboration.locks.value).toEqual(
        new Map([
          ["p1\u0000", live],
          ["b1\u0000", lock("b1", LINUS)],
        ]),
      );
    });

    it("takes the join's locks as they are after a reconnect, leaving its own out", async () => {
      const a = await openClient(server, "Ada");
      a.handlers().onLock(lock("p1", GRACE));
      vi.spyOn(a.provider, "join").mockResolvedValueOnce({
        revision: 0,
        locks: [
          lock("t1", { ...GRACE, sessionId: a.collaboration.sessionId }),
          lock("b1", LINUS),
        ],
        members: [],
        leave: () => {},
      });
      const handlers = a.handlers();

      // Grace let go of p1 while this session was offline.
      handlers.onConnectionChange("reconnecting");
      handlers.onConnectionChange("connected");
      await settle();

      expect(a.collaboration.locks.value).toEqual(
        new Map([["b1\u0000", lock("b1", LINUS)]]),
      );
    });
  });

  describe("its own lock", () => {
    it("lets go of the block it held when the next one is refused", async () => {
      const a = await openClient(server, "Ada");
      const c = await openClient(server, "Linus");
      const release = vi.spyOn(a.provider, "releaseLock");
      a.editor.selectBlock("p1");
      await settle();
      c.editor.selectBlock("b1"); // a hasn't heard about this lock
      await settle();

      a.editor.selectBlock("b1");
      await settle();

      expect(release).toHaveBeenCalledWith(server.templateId, "p1", null);
      expect([...server.locks.keys()]).toEqual(["b1"]);
      expect(a.editor.state.selectedBlockId).toBe(null);
      expect(a.notices).toEqual([
        {
          type: "selectionRefused",
          blockId: "b1",
          holder: expect.objectContaining({ name: "Linus" }),
        },
      ]);
    });

    it("says nothing when the selection moved on before a refusal arrived", async () => {
      const a = await openClient(server, "Ada");
      const c = await openClient(server, "Linus");
      c.editor.selectBlock("b1"); // a hasn't heard about this lock
      await settle();
      const answer = gate();
      const acquire = a.provider.acquireLock!.bind(a.provider);
      vi.spyOn(a.provider, "acquireLock").mockImplementationOnce(
        async (templateId, blockId) => {
          await answer.wait;
          return acquire(templateId, blockId);
        },
      );

      a.editor.selectBlock("b1");
      await settle();
      a.editor.selectBlock("t1");
      answer.open();
      await settle();

      expect(a.notices).toEqual([]);
      expect(a.editor.state.selectedBlockId).toBe("t1");
      expect(server.locks.get("t1")?.holder.name).toBe("Ada");
      expect(server.locks.get("b1")?.holder.name).toBe("Linus");
    });

    it("forgets a listed lock on a block the backend then grants it", async () => {
      const provider = server.provider("Ada");
      const joined = gate();
      const join = provider.join.bind(provider);
      vi.spyOn(provider, "join").mockImplementationOnce(
        async (templateId, session, handlers) => {
          const answer = await join(templateId, session, handlers);
          await joined.wait;
          // Grace's lock lapsed between the list and the acquire.
          return { ...answer, locks: [lock("p1", GRACE)] };
        },
      );
      const granted = gate();
      const acquire = provider.acquireLock!.bind(provider);
      vi.spyOn(provider, "acquireLock").mockImplementationOnce(
        async (templateId, blockId) => {
          await granted.wait;
          return acquire(templateId, blockId);
        },
      );
      const a = await openClient(server, "Ada", { provider });

      a.editor.selectBlock("p1");
      await settle();
      joined.open();
      await settle();
      expect(a.collaboration.locks.value.get("p1\u0000")?.holder.name).toBe(
        "Grace",
      );

      granted.open();
      await settle();

      expect(a.collaboration.locks.value.has("p1\u0000")).toBe(false);
      expect(a.editor.state.selectedBlockId).toBe("p1");
      expect(server.locks.get("p1")?.holder.name).toBe("Ada");
    });

    it("keeps the selection and tries again when taking a lock fails in transit", async () => {
      const a = await openClient(server, "Ada");
      const offline = new TypeError("Failed to fetch");
      const acquire = vi
        .spyOn(a.provider, "acquireLock")
        .mockRejectedValueOnce(offline);

      a.editor.selectBlock("p1");
      await settle();
      expect(a.errors).toEqual([offline]);
      expect(a.editor.state.selectedBlockId).toBe("p1");
      expect(server.locks.has("p1")).toBe(false);

      await vi.advanceTimersByTimeAsync(1000);
      await settle();

      expect(acquire).toHaveBeenCalledTimes(2);
      expect(server.locks.get("p1")?.holder.name).toBe("Ada");
      expect(a.notices).toEqual([]);
    });

    it("doesn't try again for a block deselected before the retry", async () => {
      const a = await openClient(server, "Ada");
      const acquire = vi
        .spyOn(a.provider, "acquireLock")
        .mockRejectedValueOnce(new TypeError("Failed to fetch"));

      a.editor.selectBlock("p1");
      await settle();
      a.editor.selectBlock(null);
      await vi.advanceTimersByTimeAsync(1000);
      await settle();

      expect(acquire).toHaveBeenCalledTimes(1);
      expect(server.locks.size).toBe(0);
    });

    it("takes a lapsed lock again", async () => {
      const a = await openClient(server, "Ada");
      const acquire = vi.spyOn(a.provider, "acquireLock");
      a.editor.selectBlock("p1");
      await settle();

      server.locks.delete("p1"); // lapsed on the backend
      await vi.advanceTimersByTimeAsync(COLLABORATION_LOCK_RENEW_MS);
      await settle();

      expect(acquire).toHaveBeenCalledTimes(2);
      expect(server.locks.get("p1")?.holder.name).toBe("Ada");
      expect(a.editor.state.selectedBlockId).toBe("p1");
      expect(a.errors).toEqual([]);
    });

    it("loses a lapsed lock to whoever took the block, naming them", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      a.editor.selectBlock("p1");
      await settle();

      server.locks.delete("p1"); // lapsed on the backend
      b.editor.selectBlock("p1");
      await settle();
      await vi.advanceTimersByTimeAsync(COLLABORATION_LOCK_RENEW_MS);
      await settle();

      expect(a.editor.state.selectedBlockId).toBe(null);
      expect(a.notices).toEqual([
        {
          type: "selectionRefused",
          blockId: "p1",
          holder: expect.objectContaining({ name: "Grace" }),
        },
      ]);
      expect(a.collaboration.locks.value.get("p1\u0000")?.holder.name).toBe(
        "Grace",
      );
    });

    it("reports a renewal that fails in transit and keeps renewing", async () => {
      const a = await openClient(server, "Ada");
      const offline = new TypeError("Failed to fetch");
      const renew = vi
        .spyOn(a.provider, "renewLock")
        .mockRejectedValueOnce(offline);
      a.editor.selectBlock("p1");
      await settle();

      await vi.advanceTimersByTimeAsync(COLLABORATION_LOCK_RENEW_MS);
      await settle();
      expect(a.errors).toEqual([offline]);

      await vi.advanceTimersByTimeAsync(COLLABORATION_LOCK_RENEW_MS);
      await settle();
      expect(renew).toHaveBeenCalledTimes(2);
      expect(server.locks.get("p1")?.holder.name).toBe("Ada");
      expect(a.errors).toEqual([offline]);
    });

    it("doesn't renew a lock it is letting go of", async () => {
      const a = await openClient(server, "Ada");
      const renew = vi.spyOn(a.provider, "renewLock");
      a.editor.selectBlock("p1");
      await settle();
      await vi.advanceTimersByTimeAsync(COLLABORATION_LOCK_RENEW_MS - 1);

      // The renewal falls due in the same tick as the deselect.
      a.editor.selectBlock(null);
      vi.advanceTimersByTime(1);
      await settle();
      await vi.advanceTimersByTimeAsync(COLLABORATION_LOCK_RENEW_MS);

      expect(renew).not.toHaveBeenCalled();
      expect(server.locks.size).toBe(0);
      expect(a.errors).toEqual([]);
    });

    it("lets go of the lock on a block an undo takes away", async () => {
      const a = await openClient(server, "Ada");
      a.editor.addBlock({ id: "n1", type: "spacer" } as unknown as Block);
      await settle();
      a.editor.selectBlock("n1");
      await settle();
      expect(server.locks.get("n1")?.holder.name).toBe("Ada");

      a.collaboration.undo();
      await settle();

      expect(ids(a.editor.content.value)).toEqual(["t1", "s1", "d1"]);
      expect(a.editor.state.selectedBlockId).toBe(null);
      expect(server.locks.size).toBe(0);
      expect(ids(server.content)).toEqual(["t1", "s1", "d1"]);
    });

    it("takes the lock on a block already selected when it attaches", async () => {
      const provider = server.provider("Ada");
      const scope = effectScope();
      const { editor, collaboration } = scope.run(() => {
        const collaboration = useCollaboration({
          provider,
          loadTemplate: async () => server.template(),
        });
        const editor = useEditor({
          content: safeClone(BASE),
          templates: server.templatesProvider(),
          lockedBlocks: collaboration.locks,
        });
        return { editor, collaboration };
      })!;
      await editor.load(server.templateId);
      editor.selectBlock("p1");

      scope.run(() => collaboration.attach(editor));
      await settle();

      expect(server.locks.get("p1")?.holder.name).toBe("Ada");
      expect(server.locks.get("p1")?.holder.sessionId).toBe(
        collaboration.sessionId,
      );
    });
  });

  describe("joining", () => {
    it("leaves a join that answers after the editor is gone", async () => {
      const provider = server.provider("Ada");
      const answer = gate();
      const join = provider.join.bind(provider);
      vi.spyOn(provider, "join").mockImplementation(async (...args) => {
        const joined = await join(...args);
        await answer.wait;
        return joined;
      });
      const a = await openClient(server, "Ada", { provider });
      expect(server.clients.size).toBe(1);

      a.scope.stop();
      answer.open();
      await settle();

      expect(server.clients.size).toBe(0);
      expect(a.collaboration.members.value).toEqual([]);
    });

    it("catches up when the join says the backend is ahead of the loaded template", async () => {
      const stale = server.template();
      server.pushAs(AGENT, [{ op: "deleteBlock", blockId: "d1" }]);

      const a = await openClient(server, "Ada", {
        templates: { load: async () => stale, create: false, save: false },
      });

      expect(a.collaboration.revision.value).toBe(1);
      expect(ids(a.editor.content.value)).toEqual(["t1", "s1"]);
      expect(a.remote).toEqual([
        {
          actor: AGENT,
          locale: null,
          ops: [{ op: "deleteBlock", blockId: "d1" }],
        },
      ]);
    });

    it("catches up from the start when the loaded template carries no revision", async () => {
      server.pushAs(AGENT, [{ op: "deleteBlock", blockId: "d1" }]);

      const a = await openClient(server, "Ada", {
        templates: {
          load: async (id) => ({ id, content: safeClone(BASE) }),
          create: false,
          save: false,
        },
      });

      expect(a.collaboration.revision.value).toBe(1);
      expect(ids(a.editor.content.value)).toEqual(["t1", "s1"]);
      expect(a.remote).toHaveLength(1);
    });

    it("reports a join that fails, and still sends edits", async () => {
      const provider = server.provider("Ada");
      const refused = new Error("Realtime is unavailable.");
      vi.spyOn(provider, "join").mockRejectedValueOnce(refused);

      const a = await openClient(server, "Ada", { provider });
      a.editor.removeBlock("d1");
      await settle();

      expect(a.errors).toEqual([refused]);
      expect(a.collaboration.connection.value).toBe(null);
      expect(a.collaboration.members.value).toEqual([]);
      expect(ids(server.content)).toEqual(["t1", "s1"]);
      expect(a.collaboration.revision.value).toBe(1);
    });
  });

  describe("switching templates", () => {
    it("keeps the session when the open template is saved", async () => {
      const a = await openClient(server, "Ada");
      a.editor.removeBlock("d1");
      await settle();
      const join = vi.spyOn(a.provider, "join");

      await a.editor.save();
      await settle();

      expect(join).not.toHaveBeenCalled();
      expect(a.collaboration.canUndo.value).toBe(true);
      expect(a.collaboration.revision.value).toBe(1);
      expect(server.clients.size).toBe(1);
    });

    it("sends nothing to the open template while create() fills the canvas", async () => {
      const t = twoTemplates("Ada");
      const created = gate();
      const create = t.templates.create as (input: {
        content: TemplateContent;
      }) => Promise<Template>;
      t.templates.create = async (input) => {
        await created.wait;
        return create(input);
      };
      const a = await openClient(t.first, "Ada", {
        provider: t.provider,
        templates: t.templates,
      });

      const creating = a.editor.create({ content: safeClone(SECOND) });
      await settle();
      expect(ids(a.editor.content.value)).toEqual(["x1"]);
      created.open();
      await creating;
      await settle();
      await vi.advanceTimersByTimeAsync(COLLABORATION_TYPING_DEBOUNCE_MS);

      expect(t.first.submits).toBe(0);
      expect(t.second.submits).toBe(0);
      expect(ids(t.first.content)).toEqual(["t1", "s1", "d1"]);
      expect(t.second.clients.has(a.collaboration.sessionId)).toBe(true);
      expect(t.first.clients.has(a.collaboration.sessionId)).toBe(false);
    });

    it("ignores a catch-up that answers after the template was switched", async () => {
      const t = twoTemplates("Ada");
      const a = await openClient(t.first, "Ada", {
        provider: t.provider,
        templates: t.templates,
      });
      t.first.pushAs(AGENT, [{ op: "deleteBlock", blockId: "d1" }]);
      t.first.queueFor(a.collaboration.sessionId).splice(0);
      const answer = gate();
      const operationsAfter = t.providers["tpl-1"].operationsAfter.bind(
        t.providers["tpl-1"],
      );
      vi.spyOn(t.providers["tpl-1"], "operationsAfter").mockImplementation(
        async (id, after) => {
          await answer.wait;
          return operationsAfter(id, after);
        },
      );
      a.handlers().onResync(1);
      await a.editor.load("tpl-2");
      answer.open();
      await settle();

      expect(ids(a.editor.content.value)).toEqual(["x1"]);
      expect(a.collaboration.revision.value).toBe(0);
      expect(a.remote).toEqual([]);
      expect(a.errors).toEqual([]);
    });

    it("ignores a reload that answers after the template was switched", async () => {
      const t = twoTemplates("Ada");
      const answer = gate();
      const loadTemplate = vi.fn(async (id: string) => {
        await answer.wait;
        return { ...t.first.template(), id, content: safeClone(BASE) };
      });
      const a = await openClient(t.first, "Ada", {
        provider: t.provider,
        templates: t.templates,
        loadTemplate,
      });
      vi.spyOn(t.providers["tpl-1"], "operationsAfter").mockResolvedValue({
        revision: 3,
        resync: true,
      });

      a.handlers().onResync(3);
      await settle();
      await a.editor.load("tpl-2");
      answer.open();
      await settle();

      expect(loadTemplate).toHaveBeenCalledWith("tpl-1");
      expect(ids(a.editor.content.value)).toEqual(["x1"]);
      expect(a.collaboration.revision.value).toBe(0);
      expect(a.errors).toEqual([]);
    });

    it("ignores events for a template it has left", async () => {
      const t = twoTemplates("Ada");
      const a = await openClient(t.first, "Ada", {
        provider: t.provider,
        templates: t.templates,
      });
      const left = a.handlers();
      const operationsAfter = vi.spyOn(t.providers["tpl-1"], "operationsAfter");
      await a.editor.load("tpl-2");
      await settle();
      const members = a.collaboration.members.value;

      left.onBatch({
        revision: 1,
        batchId: "late",
        actor: AGENT,
        ops: [{ op: "deleteBlock", blockId: "x1" }],
      });
      left.onResync(5, AGENT);
      left.onLock(lock("x1", GRACE));
      left.onUnlock("x1", GRACE.sessionId);
      left.onMembers([]);
      left.onConnectionChange("reconnecting");
      await vi.advanceTimersByTimeAsync(COLLABORATION_GAP_TIMEOUT_MS);

      expect(ids(a.editor.content.value)).toEqual(["x1"]);
      expect(a.collaboration.revision.value).toBe(0);
      expect(a.collaboration.locks.value.size).toBe(0);
      expect(a.collaboration.members.value).toBe(members);
      expect(a.collaboration.connection.value).toBe("connected");
      expect(operationsAfter).not.toHaveBeenCalled();
      expect(a.remote).toEqual([]);
      expect(a.errors).toEqual([]);
    });

    it("reports nothing from a template it switched away from", async () => {
      const t = twoTemplates("Ada");
      const a = await openClient(t.first, "Ada", {
        provider: t.provider,
        templates: t.templates,
      });
      const b = await openClient(t.first, "Grace");
      const answer = gate();
      const submit = t.providers["tpl-1"].submit.bind(t.providers["tpl-1"]);
      vi.spyOn(t.providers["tpl-1"], "submit").mockImplementationOnce(
        async (id, batch) => {
          const confirmed = await submit(id, batch);
          await answer.wait;
          return confirmed;
        },
      );

      a.editor.removeBlock("d1"); // revision 1; its answer is held
      await settle();
      b.editor.removeBlock("t1"); // revision 2, waits behind a's own
      await settle();
      t.first.deliver(a.collaboration.sessionId);
      await settle();
      expect(a.collaboration.revision.value).toBe(0);

      await a.editor.load("tpl-2");
      answer.open();
      await settle();

      expect(a.remote).toEqual([]);
      expect(ids(a.editor.content.value)).toEqual(["x1"]);
      expect(a.collaboration.revision.value).toBe(0);
    });
  });

  describe("before a template is open", () => {
    it("takes no lock and sends nothing", async () => {
      const a = await openClient(server, "Ada", { load: false });
      const acquire = vi.spyOn(a.provider, "acquireLock");

      a.editor.selectBlock("t1");
      a.editor.removeBlock("d1");
      await settle();
      a.collaboration.flush();

      expect(a.editor.state.selectedBlockId).toBe("t1");
      expect(acquire).not.toHaveBeenCalled();
      expect(server.submits).toBe(0);
      expect(server.clients.size).toBe(0);
    });

    it("suspends, resumes, outlives the page hiding and is destroyed without one", async () => {
      vi.stubGlobal("window", new EventTarget());
      const a = await openClient(server, "Ada", { load: false });
      const release = vi.spyOn(a.provider, "releaseLock");

      a.collaboration.suspend();
      a.collaboration.resume();
      window.dispatchEvent(new Event("pagehide"));
      a.collaboration.destroy();
      await settle();

      expect(a.editor.content.value).toEqual(BASE);
      expect(release).not.toHaveBeenCalled();
      expect(a.errors).toEqual([]);
      expect(server.clients.size).toBe(0);
    });

    it("has no history, settles at once, and catches up on nothing", async () => {
      const a = await openClient(server, "Ada", { load: false });
      const operationsAfter = vi.spyOn(a.provider, "operationsAfter");

      a.collaboration.undo();
      a.collaboration.redo();
      a.collaboration.clearHistory();
      await expect(a.collaboration.settle()).resolves.toBeUndefined();
      await expect(a.collaboration.catchUp()).resolves.toBeUndefined();

      expect(a.collaboration.canUndo.value).toBe(false);
      expect(a.collaboration.canRedo.value).toBe(false);
      expect(a.collaboration.hasConfirmedBlock("t1")).toBe(false);
      expect(operationsAfter).not.toHaveBeenCalled();
      expect(a.notices).toEqual([]);
    });
  });

  describe("catching up", () => {
    it("shares one request between catch-ups asked for at once", async () => {
      const a = await openClient(server, "Ada");
      server.pushAs(AGENT, [{ op: "deleteBlock", blockId: "d1" }]);
      server.queueFor(a.collaboration.sessionId).splice(0);
      const operationsAfter = vi.spyOn(a.provider, "operationsAfter");

      const first = a.collaboration.catchUp();
      const second = a.collaboration.catchUp();
      expect(second).toBe(first);
      await first;

      expect(operationsAfter).toHaveBeenCalledTimes(1);
      expect(a.collaboration.revision.value).toBe(1);
      expect(ids(a.editor.content.value)).toEqual(["t1", "s1"]);
    });

    it("fetches once for several batches waiting on one gap", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      server.deliverAll();
      await settle();
      const operationsAfter = vi.spyOn(a.provider, "operationsAfter");
      b.editor.removeBlock("d1");
      await settle();
      b.editor.removeBlock("t1");
      await settle();
      b.editor.updateBlock("p1", { content: "Right" } as Partial<Block>);
      b.collaboration.flush();
      await settle();

      const [, second, third] = server
        .queueFor(a.collaboration.sessionId)
        .splice(0);
      third();
      second(); // revision 1 never arrives
      await settle();
      await vi.advanceTimersByTimeAsync(COLLABORATION_GAP_TIMEOUT_MS);
      await settle();

      expect(operationsAfter).toHaveBeenCalledTimes(1);
      expect(operationsAfter).toHaveBeenCalledWith(server.templateId, 0);
      expect(a.collaboration.revision.value).toBe(3);
      expect(a.editor.content.value).toEqual(server.content);
    });
  });

  describe("history", () => {
    it("neither undoes nor redoes while suspended", async () => {
      const a = await openClient(server, "Ada");
      a.editor.removeBlock("d1");
      await settle();

      a.collaboration.suspend();
      a.collaboration.undo();
      await settle();
      expect(server.submits).toBe(1);
      expect(a.collaboration.canUndo.value).toBe(true);

      a.collaboration.resume();
      a.collaboration.undo();
      await settle();
      expect(server.submits).toBe(2);
      expect(ids(server.content)).toEqual(["t1", "s1", "d1"]);
    });

    it("sends nothing for an undo or redo with nothing to step to", async () => {
      const a = await openClient(server, "Ada");

      a.collaboration.undo();
      a.collaboration.redo();
      await settle();

      expect(server.submits).toBe(0);
      expect(a.notices).toEqual([]);
      expect(a.editor.content.value).toEqual(BASE);
    });

    it("keeps at most maxUndo steps", async () => {
      const a = await openClient(server, "Ada", { maxUndo: 2 });
      for (const id of ["d1", "t1", "s1"]) {
        a.editor.removeBlock(id);
        await settle();
      }

      a.collaboration.undo();
      a.collaboration.undo();
      await settle();
      expect(a.collaboration.canUndo.value).toBe(false);
      a.collaboration.undo();
      await settle();

      expect(ids(server.content)).toEqual(["t1", "s1"]);
      expect(server.submits).toBe(5);
    });

    it("clears both stacks", async () => {
      const a = await openClient(server, "Ada");
      a.editor.removeBlock("d1");
      await settle();
      a.editor.removeBlock("t1");
      await settle();
      a.collaboration.undo();
      await settle();
      expect(a.collaboration.canUndo.value).toBe(true);
      expect(a.collaboration.canRedo.value).toBe(true);

      a.collaboration.clearHistory();

      expect(a.collaboration.canUndo.value).toBe(false);
      expect(a.collaboration.canRedo.value).toBe(false);
      a.collaboration.undo();
      await settle();
      expect(ids(server.content)).toEqual(["t1", "s1"]);
    });

    it("waits for a pause in settings changes, as it does for typing", async () => {
      const a = await openClient(server, "Ada");

      a.editor.updateSettings({ width: 620 });
      await settle();
      a.editor.updateSettings({ width: 640 });
      await settle();
      expect(server.submits).toBe(0);

      await vi.advanceTimersByTimeAsync(COLLABORATION_TYPING_DEBOUNCE_MS);
      await settle();

      expect(server.submits).toBe(1);
      expect(server.content.settings.width).toBe(640);
    });
  });

  describe("teardown", () => {
    it("attached outside an effect scope, lives until destroyed", async () => {
      const collaboration = useCollaboration({
        provider: server.provider("Ada"),
        loadTemplate: async () => server.template(),
      });
      const editor = useEditor({
        content: safeClone(BASE),
        templates: server.templatesProvider(),
        lockedBlocks: collaboration.locks,
      });
      collaboration.attach(editor);
      await editor.load(server.templateId);
      editor.selectBlock("p1");
      await settle();
      expect(server.clients.size).toBe(1);
      expect(server.locks.get("p1")?.holder.name).toBe("Ada");

      collaboration.destroy();
      await settle();

      expect(server.clients.size).toBe(0);
      expect(server.locks.size).toBe(0);
    });

    // guard: destroy() stops what attach() watches, with or without a scope.
    it("stays torn down after destroy(), even when the editor loads a template", async () => {
      const a = await openClient(server, "Ada");

      a.collaboration.destroy();
      await a.editor.load(server.templateId);
      await settle();
      a.editor.removeBlock("d1");
      await settle();

      expect(server.clients.size).toBe(0);
      expect(server.submits).toBe(0);
    });
  });

  describe("the page", () => {
    function stubWindow() {
      const target = new EventTarget();
      const add = vi.spyOn(target, "addEventListener");
      const remove = vi.spyOn(target, "removeEventListener");
      vi.stubGlobal("window", target);
      return { target, add, remove };
    }

    it("sends what is typed, lets go of its lock and leaves when the page hides", async () => {
      const page = stubWindow();
      const a = await openClient(server, "Ada");
      a.editor.selectBlock("t1");
      await settle();
      a.editor.updateBlock("t1", { content: "Bye" } as Partial<Block>);
      await settle();
      expect(server.submits).toBe(0);

      page.target.dispatchEvent(new Event("pagehide"));
      await settle();

      expect(text(server.content)).toBe("Bye");
      expect(server.locks.size).toBe(0);
      expect(server.clients.has(a.collaboration.sessionId)).toBe(false);
    });

    it("sends what is typed when the window loses focus", async () => {
      const page = stubWindow();
      const a = await openClient(server, "Ada");
      a.editor.updateBlock("t1", { content: "Typed" } as Partial<Block>);
      await settle();

      page.target.dispatchEvent(new Event("blur"));
      await settle();

      expect(text(server.content)).toBe("Typed");
      expect(server.clients.has(a.collaboration.sessionId)).toBe(true);
    });

    it("stops listening to the page once destroyed, and a second destroy does nothing", async () => {
      const page = stubWindow();
      const a = await openClient(server, "Ada");
      const release = vi.spyOn(a.provider, "releaseLock");
      a.editor.selectBlock("t1");
      await settle();
      const ownTypes = (type: string) => type === "pagehide" || type === "blur";
      const listeners = new Map(
        page.add.mock.calls
          .filter(([type]) => ownTypes(type))
          .map(([type, listener]) => [type, listener]),
      );
      expect([...listeners.keys()]).toEqual(["pagehide", "blur"]);

      a.scope.stop();
      a.collaboration.destroy();
      await settle();

      expect(page.remove.mock.calls.filter(([type]) => ownTypes(type))).toEqual(
        [
          ["pagehide", listeners.get("pagehide")],
          ["blur", listeners.get("blur")],
        ],
      );
      expect(release).toHaveBeenCalledTimes(1);
      expect(server.locks.size).toBe(0);
    });
  });
});
