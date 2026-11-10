import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CollaborationProvider,
  TemplatesProvider,
} from "@templatical/types";
import { safeClone } from "@templatical/types";
import {
  AGENT,
  BASE,
  gateSubmit,
  ids,
  openClient,
  settle,
} from "./helpers/collaboration-harness";
import { FakeCollaborationServer } from "./helpers/fake-collaboration-server";

describe("collaboration history across a loaded or created document", () => {
  let server: FakeCollaborationServer;

  beforeEach(() => {
    server = new FakeCollaborationServer(BASE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adopts a same-id load without submitting it or disturbing presence and held locks", async () => {
    const provider = server.provider("Ada");
    const originalJoin = provider.join.bind(provider);
    const join = vi.spyOn(provider, "join");
    const submit = vi.spyOn(provider, "submit");
    const leave = vi.fn();
    join.mockImplementation(async (...args) => {
      const joined = await originalJoin(...args);
      return {
        ...joined,
        leave: () => {
          leave();
          joined.leave();
        },
      };
    });
    const a = await openClient(server, "Ada", { provider });
    const b = await openClient(server, "Grace");
    server.deliver(a.collaboration.sessionId);
    a.editor.selectBlock("t1");
    b.editor.selectBlock("d1");
    await settle();
    server.deliver(a.collaboration.sessionId);
    expect(server.locks.get("t1")?.holder.sessionId).toBe(
      a.collaboration.sessionId,
    );
    expect(a.collaboration.locksOf("d1")[0]?.holder.sessionId).toBe(
      b.collaboration.sessionId,
    );
    const members = a.collaboration.members.value;
    expect(members.map((member) => member.sessionId)).toEqual([
      a.collaboration.sessionId,
      b.collaboration.sessionId,
    ]);
    const locks = [...a.collaboration.locks.value];

    a.editor.updateBlock("t1", { content: "Local" });
    a.collaboration.flush();
    await settle();
    expect(a.collaboration.canUndo.value).toBe(true);
    server.pushAs(AGENT, [{ op: "updateSettings", set: { width: 640 } }]);
    const submittedBeforeLoad = submit.mock.calls.length;

    await a.editor.load(server.templateId);
    await settle();

    expect(a.collaboration.revision.value).toBe(2);
    expect(a.editor.content.value.settings.width).toBe(640);
    expect(a.collaboration.canUndo.value).toBe(false);
    expect(a.collaboration.canRedo.value).toBe(false);
    expect(submit).toHaveBeenCalledTimes(submittedBeforeLoad);
    expect(join).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledTimes(0);
    expect(a.collaboration.members.value).toEqual(members);
    expect([...a.collaboration.locks.value]).toEqual(locks);
    expect(server.locks.get("t1")?.holder.sessionId).toBe(
      a.collaboration.sessionId,
    );
    a.scope.stop();
    b.scope.stop();
  });

  it("keeps an in-flight acknowledgement in the same session after a same-id load", async () => {
    const provider = server.provider("Ada");
    const join = vi.spyOn(provider, "join");
    const a = await openClient(server, "Ada", { provider });
    const { release, spy } = gateSubmit(provider, { answerLate: true });

    a.editor.removeBlock("d1");
    await settle();
    expect(server.revision).toBe(1);
    expect(a.collaboration.revision.value).toBe(0);

    await a.editor.load(server.templateId);
    await settle();
    expect(a.collaboration.revision.value).toBe(1);
    expect(join).toHaveBeenCalledTimes(1);

    release();
    await settle();
    a.editor.removeBlock("t1");
    await settle();

    expect(spy.mock.calls).toHaveLength(2);
    expect(spy.mock.calls[1][0]).toBe(server.templateId);
    expect(spy.mock.calls[1][1].baseRevision).toBe(1);
    expect(a.collaboration.revision.value).toBe(2);
    expect(ids(server.content)).toEqual(["s1"]);
    a.scope.stop();
  });

  it("replays valid queued batches over a same-id load before sending them", async () => {
    const a = await openClient(server, "Ada");
    const { release, spy } = gateSubmit(a.provider);
    a.editor.removeBlock("d1");
    await settle();
    a.editor.removeBlock("t1");
    await settle();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(ids(server.content)).toEqual(["t1", "s1", "d1"]);

    await a.editor.load(server.templateId);
    await settle();

    expect(ids(a.editor.content.value)).toEqual(["s1"]);
    expect(a.collaboration.canUndo.value).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    release();
    await settle();
    await expect(a.collaboration.settle()).resolves.toBeUndefined();
    expect(spy.mock.calls).toHaveLength(2);
    expect(
      spy.mock.calls.map(([id, batch]) => [id, batch.baseRevision]),
    ).toEqual([
      [server.templateId, 0],
      [server.templateId, 1],
    ]);
    expect(ids(server.content)).toEqual(["s1"]);
    expect(a.editor.content.value).toEqual(server.content);
    a.scope.stop();
  });

  function createClient() {
    const first = new FakeCollaborationServer(BASE, "old");
    const second = new FakeCollaborationServer(BASE, "new");
    const providers = {
      old: first.provider("Ada"),
      new: second.provider("Ada"),
    };
    const provider: CollaborationProvider = {
      join: (id, session, handlers) =>
        providers[id as "old" | "new"].join(id, session, handlers),
      submit: (id, batch) => providers[id as "old" | "new"].submit(id, batch),
      operationsAfter: (id, after) =>
        providers[id as "old" | "new"].operationsAfter(id, after),
    };
    const submit = vi.spyOn(provider, "submit");
    const templates: TemplatesProvider = {
      load: async () => first.template(),
      create: async (input) => {
        second.content = safeClone(input.content);
        return { ...second.template(), name: input.name ?? "Copy" };
      },
      save: false,
    };
    return { first, second, provider, submit, templates };
  }

  it.each([
    ["create()", undefined],
    ["create({ name })", { name: "Named copy" }],
  ] as const)(
    "%s carries undo into the new template session",
    async (_label, input) => {
      const setup = createClient();
      const a = await openClient(setup.first, "Ada", {
        provider: setup.provider,
        templates: setup.templates,
      });
      a.editor.removeBlock("d1");
      await settle();
      expect(a.collaboration.canUndo.value).toBe(true);

      const created = await a.editor.create(input);
      await settle();
      expect(created.id).toBe("new");
      expect(created.name).toBe(input?.name ?? "Copy");
      expect(a.collaboration.canUndo.value).toBe(true);
      a.collaboration.undo();
      await settle();

      expect(ids(a.editor.content.value)).toEqual(["t1", "s1", "d1"]);
      expect(ids(setup.second.content)).toEqual(["t1", "s1", "d1"]);
      expect(setup.submit.mock.calls.at(-1)?.[0]).toBe("new");
      expect(setup.second.submitted[0].baseRevision).toBe(0);
      expect(setup.first.submits).toBe(1);
      a.scope.stop();
    },
  );

  it("carries redo into a new template session after create without content", async () => {
    const setup = createClient();
    const a = await openClient(setup.first, "Ada", {
      provider: setup.provider,
      templates: setup.templates,
    });
    a.editor.removeBlock("d1");
    await settle();
    a.collaboration.undo();
    await settle();
    expect(a.collaboration.canRedo.value).toBe(true);

    await a.editor.create();
    await settle();
    expect(a.collaboration.canRedo.value).toBe(true);
    a.collaboration.redo();
    await settle();

    expect(ids(a.editor.content.value)).toEqual(["t1", "s1"]);
    expect(ids(setup.second.content)).toEqual(["t1", "s1"]);
    expect(setup.submit.mock.calls.at(-1)?.[0]).toBe("new");
    a.scope.stop();
  });
});
