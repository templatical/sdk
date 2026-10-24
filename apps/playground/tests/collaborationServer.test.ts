import { beforeEach, describe, expect, it } from "vitest";
import type { TemplateContent } from "@templatical/types";
import {
  BROADCAST_MAX_BYTES,
  LOCK_TTL_MS,
  LOG_LIMIT,
  MEMBER_TTL_MS,
  RefusedError,
  SharedCollaborationServer,
  colorFor,
  crc32,
  type ServerEvent,
  type SessionIdentity,
} from "../src/host/collaboration/server";

const SEED = {
  blocks: [
    { id: "t1", type: "title", content: "Hi" },
    {
      id: "s1",
      type: "section",
      columns: "2",
      children: [[{ id: "p1", type: "paragraph", content: "Left" }], []],
    },
  ],
  settings: { width: 600 },
} as unknown as TemplateContent;

const ADA: SessionIdentity = {
  sessionId: "s-ada",
  user: { id: "u-1", name: "Ada" },
};
const GRACE: SessionIdentity = {
  sessionId: "s-grace",
  user: { id: "u-2", name: "Grace" },
};
const GUEST: SessionIdentity = { sessionId: "s-guest", user: null };

function refusalOf(run: () => unknown) {
  try {
    run();
  } catch (error) {
    if (error instanceof RefusedError) return error.refusal;
    throw error;
  }
  throw new Error("Expected a refusal.");
}

describe("SharedCollaborationServer", () => {
  let now: number;
  let events: { sessionId: string; event: ServerEvent }[];
  let server: SharedCollaborationServer;

  beforeEach(() => {
    now = Date.parse("2026-10-19T12:00:00Z");
    events = [];
    server = new SharedCollaborationServer(
      (sessionId, event) => events.push({ sessionId, event }),
      () => now,
    );
    server.load("tpl", SEED);
    server.join("tpl", ADA);
    server.join("tpl", GRACE);
    events = [];
  });

  it("derives colours from the identity with PHP's crc32", () => {
    expect(crc32("The quick brown fox jumps over the lazy dog")).toBe(
      0x414fa339,
    );
    expect(colorFor("u-1")).toBe(colorFor("u-1"));
    expect(colorFor("u-1")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("applies a batch, bumps the revision and sends it to the others", () => {
    const result = server.submit("tpl", ADA, {
      batchId: "b-1",
      baseRevision: 0,
      ops: [{ op: "updateBlock", blockId: "t1", set: { content: "Hello" } }],
    });

    expect(result).toEqual({ revision: 1 });
    expect(server.load("tpl", SEED).content.blocks[0]).toMatchObject({
      content: "Hello",
    });
    expect(events).toEqual([
      {
        sessionId: "s-grace",
        event: {
          type: "batch",
          batch: {
            revision: 1,
            batchId: "b-1",
            actor: { type: "user", id: "u-1", name: "Ada", sessionId: "s-ada" },
            ops: [
              { op: "updateBlock", blockId: "t1", set: { content: "Hello" } },
            ],
            createdAt: "2026-10-19T12:00:00.000Z",
          },
        },
      },
    ]);
  });

  it("names a batch an AI turn made, and its re-sync, with the ai actor (BY9)", () => {
    server.submit("tpl", ADA, {
      batchId: "b-ai",
      baseRevision: 0,
      ops: [{ op: "updateBlock", blockId: "t1", set: { content: "Hello" } }],
      origin: "ai",
    });
    server.submit("tpl", ADA, {
      batchId: "b-ai-2",
      baseRevision: 1,
      ops: [
        {
          op: "setContent",
          content: { blocks: [], settings: { width: 600 } } as never,
        },
      ],
      origin: "ai",
    });

    const aiActor = { type: "ai", id: "u-1", name: "Ada", sessionId: "s-ada" };
    expect(events.map(({ event }) => event)).toEqual([
      {
        type: "batch",
        batch: expect.objectContaining({ batchId: "b-ai", actor: aiActor }),
      },
      { type: "resync", revision: 2, actor: aiActor },
    ]);
    expect(server.operationsAfter("tpl", 0)).toMatchObject({
      batches: [{ actor: aiActor }, { actor: aiActor }],
    });
  });

  it("answers a repeated batch id with its revision, applying it once", () => {
    const batch = {
      batchId: "b-1",
      baseRevision: 0,
      ops: [{ op: "deleteBlock" as const, blockId: "t1" }],
    };

    server.submit("tpl", ADA, batch);

    expect(server.submit("tpl", ADA, batch)).toEqual({ revision: 1 });
    expect(server.operationsAfter("tpl", 0)).toMatchObject({ revision: 1 });
  });

  it("refuses an edit to a block another session holds, naming the holder", () => {
    server.acquireLock("tpl", GRACE, "p1");

    const refusal = refusalOf(() =>
      server.submit("tpl", ADA, {
        batchId: "b-1",
        baseRevision: 0,
        ops: [{ op: "updateBlock", blockId: "p1", set: { content: "Mine" } }],
      }),
    );

    expect(refusal).toMatchObject({
      status: 409,
      code: "lock_held",
      opIndex: 0,
      holder: { sessionId: "s-grace", type: "user", id: "u-2", name: "Grace" },
    });
  });

  it("owns a lock by session and identity together", () => {
    server.acquireLock("tpl", GRACE, "p1");
    const borrowed: SessionIdentity = {
      sessionId: "s-grace",
      user: { id: "u-1", name: "Ada" },
    };

    expect(
      refusalOf(() =>
        server.submit("tpl", borrowed, {
          batchId: "b-1",
          baseRevision: 0,
          ops: [{ op: "deleteBlock", blockId: "p1" }],
        }),
      ).code,
    ).toBe("lock_held");
    expect(refusalOf(() => server.renewLock("tpl", borrowed, "p1")).code).toBe(
      "lock_lost",
    );
  });

  it("refuses a whole-template replace while others hold locks, naming them", () => {
    server.acquireLock("tpl", GRACE, "p1");

    const refusal = refusalOf(() =>
      server.submit("tpl", ADA, {
        batchId: "b-1",
        baseRevision: 0,
        ops: [
          {
            op: "setContent",
            content: { blocks: [], settings: { width: 600 } } as never,
          },
        ],
      }),
    );

    expect(refusal.code).toBe("locked_by_others");
    expect(refusal.holders?.map((holder) => holder.name)).toEqual(["Grace"]);
  });

  it("sends a re-sync instead of a replace, and of a batch too large to broadcast", () => {
    server.submit("tpl", ADA, {
      batchId: "b-1",
      baseRevision: 0,
      ops: [
        {
          op: "setContent",
          content: { blocks: [], settings: { width: 600 } } as never,
        },
      ],
    });
    server.submit("tpl", ADA, {
      batchId: "b-2",
      baseRevision: 1,
      ops: [
        {
          op: "updateSettings",
          set: { backgroundColor: "x".repeat(BROADCAST_MAX_BYTES) },
        },
      ],
    });

    expect(events.map(({ event }) => event)).toEqual([
      {
        type: "resync",
        revision: 1,
        actor: { type: "user", id: "u-1", name: "Ada", sessionId: "s-ada" },
      },
      {
        type: "resync",
        revision: 2,
        actor: { type: "user", id: "u-1", name: "Ada", sessionId: "s-ada" },
      },
    ]);
  });

  it("answers operationsAfter with the batches, or a re-sync past the log", () => {
    for (let index = 1; index <= LOG_LIMIT + 1; index++) {
      server.submit("tpl", ADA, {
        batchId: `b-${index}`,
        baseRevision: index - 1,
        ops: [{ op: "updateSettings", set: { width: 600 + index } }],
      });
    }

    const recent = server.operationsAfter("tpl", LOG_LIMIT - 1);
    expect(recent).toMatchObject({ revision: LOG_LIMIT + 1 });
    expect(
      "batches" in recent && recent.batches.map((batch) => batch.revision),
    ).toEqual([LOG_LIMIT, LOG_LIMIT + 1]);
    expect(server.operationsAfter("tpl", 0)).toEqual({
      revision: LOG_LIMIT + 1,
      resync: true,
    });
    expect(server.operationsAfter("tpl", LOG_LIMIT + 1)).toEqual({
      revision: LOG_LIMIT + 1,
      batches: [],
    });
  });

  it("gives a session one lock: taking a block lets go of the last one", () => {
    server.acquireLock("tpl", ADA, "t1");
    server.acquireLock("tpl", ADA, "p1");

    expect(events.map(({ event }) => event.type)).toEqual([
      "lock",
      "unlock",
      "lock",
    ]);
    expect(server.load("tpl", SEED).locks?.map((lock) => lock.blockId)).toEqual(
      ["p1"],
    );
  });

  it("refuses a lock someone else holds, and a block that isn't there", () => {
    server.acquireLock("tpl", GRACE, "p1");

    expect(
      refusalOf(() => server.acquireLock("tpl", GUEST, "p1")),
    ).toMatchObject({
      code: "lock_held",
      holder: { name: "Grace" },
    });
    expect(
      refusalOf(() => server.acquireLock("tpl", GUEST, "zz")),
    ).toMatchObject({
      status: 409,
      code: "block_missing",
      message: "That block isn't in the template.",
    });
  });

  it("lets a lock lapse after 30 seconds without a renewal", () => {
    server.acquireLock("tpl", GRACE, "p1");
    now += LOCK_TTL_MS;

    expect(server.acquireLock("tpl", ADA, "p1").holder.name).toBe("Ada");
  });

  it("joins guests as Guest, and drops a silent session with its locks", () => {
    server.join("tpl", GUEST);
    expect(
      server.join("tpl", ADA).members.map((member) => member.name),
    ).toEqual(["Ada", "Grace", "Guest"]);
    server.acquireLock("tpl", GUEST, "t1");
    events = [];

    now += MEMBER_TTL_MS + 1;
    server.heartbeat("tpl", "s-ada");
    server.heartbeat("tpl", "s-grace");
    server.sweep();

    expect(events.map(({ event }) => event.type)).toEqual([
      "unlock",
      "unlock",
      "members",
      "members",
    ]);
    expect(server.load("tpl", SEED).locks).toEqual([]);
  });

  it("renames on save and leaves content to the operations", () => {
    expect(server.rename("tpl", "Spring sale")).toMatchObject({
      id: "tpl",
      name: "Spring sale",
      revision: 0,
    });
  });
});
