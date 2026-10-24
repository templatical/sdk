import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Block, TemplateContent } from "@templatical/types";
import {
  CollaborationConflict,
  OperationError,
  SdkError,
  safeClone,
} from "@templatical/types";
import {
  COLLABORATION_GAP_TIMEOUT_MS,
  COLLABORATION_TYPING_DEBOUNCE_MS,
} from "../src/collaboration";
import {
  AGENT,
  BASE,
  gateSubmit,
  ids,
  openClient,
  settle,
  text,
} from "./helpers/collaboration-harness";
import { FakeCollaborationServer } from "./helpers/fake-collaboration-server";

/**
 * What the controller does when something goes wrong: a submit that fails in
 * transit or is refused, a local change the engine can't take, another
 * session's batch that overtakes this one's, a catch-up or reload that fails,
 * and content from the backend the canvas can't be patched to.
 */

/** A whole-content change the diff can't express: `p1` in its column and again at the top level. */
function withDuplicateParagraph(content: TemplateContent): TemplateContent {
  return {
    ...content,
    blocks: [
      ...content.blocks,
      { id: "p1", type: "paragraph", content: "Copy" } as unknown as Block,
    ],
  };
}

describe("useCollaboration when things go wrong", () => {
  let server: FakeCollaborationServer;

  beforeEach(() => {
    vi.useFakeTimers();
    server = new FakeCollaborationServer(BASE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("an AI batch that cannot be applied", () => {
    it("refuses a turn before a template is open without changing content or history", async () => {
      const a = await openClient(server, "Ada", { load: false });

      const result = a.collaboration.applyOperations(
        [{ op: "deleteBlock", blockId: "d1" }],
        { origin: "ai", turn: "turn-1" },
      );

      expect(result).toEqual({
        applied: false,
        error: new OperationError(
          "invalid_operation",
          0,
          "No template is open for editing.",
        ),
      });
      if (!result.applied) {
        expect({
          code: result.error.code,
          opIndex: result.error.opIndex,
          message: result.error.message,
        }).toEqual({
          code: "invalid_operation",
          opIndex: 0,
          message: "No template is open for editing.",
        });
      }
      expect(a.editor.content.value).toEqual(BASE);
      expect(a.collaboration.canUndo.value).toBe(false);
      expect(server.revision).toBe(0);
      a.scope.stop();
    });

    it("rethrows an unexpected operation access error without recording or sending the turn", async () => {
      const a = await openClient(server, "Ada");
      const failure = new Error("The operation's block id could not be read.");

      expect(() =>
        a.collaboration.applyOperations(
          [
            {
              op: "deleteBlock",
              get blockId(): string {
                throw failure;
              },
            },
          ],
          { origin: "ai", turn: "turn-1" },
        ),
      ).toThrow(failure);

      expect(a.editor.content.value).toEqual(BASE);
      expect(a.collaboration.canUndo.value).toBe(false);
      expect(server.revision).toBe(0);
      expect(a.notices).toEqual([]);
      expect(a.errors).toEqual([]);
      a.scope.stop();
    });
  });

  describe("a submit that fails", () => {
    it.each([503, 408, 429])(
      "retries a %i under the same batch id, and rejects settle() meanwhile",
      async (status) => {
        const a = await openClient(server, "Ada");
        const submit = vi.spyOn(a.provider, "submit");
        const failure = new SdkError("Try again.", status);
        server.failNextSubmit = failure;

        a.editor.removeBlock("d1");
        const settled = a.collaboration.settle();
        await expect(settled).rejects.toBe(failure);
        expect(server.revision).toBe(0);

        await vi.advanceTimersByTimeAsync(1000);
        await settle();

        expect(server.revision).toBe(1);
        expect(ids(server.content)).toEqual(["t1", "s1"]);
        expect(submit).toHaveBeenCalledTimes(2);
        expect(submit.mock.calls[1][1].batchId).toBe(
          submit.mock.calls[0][1].batchId,
        );
        expect(a.errors).toEqual([]);
        expect(a.notices).toEqual([]);
      },
    );

    it("keeps retrying a batch that fails in transit, backing off to every 30 s", async () => {
      const a = await openClient(server, "Ada");
      const submit = a.provider.submit.bind(a.provider);
      const start = Date.now();
      const sentAt: number[] = [];
      let failures = 6;
      vi.spyOn(a.provider, "submit").mockImplementation(
        async (templateId, batch) => {
          sentAt.push(Date.now() - start);
          if (failures-- > 0) throw new TypeError("Failed to fetch");
          return submit(templateId, batch);
        },
      );

      a.editor.removeBlock("d1");
      await settle();
      for (const wait of [1000, 2000, 5000, 10_000, 30_000, 30_000]) {
        await vi.advanceTimersByTimeAsync(wait);
      }
      await settle();

      expect(sentAt).toEqual([0, 1000, 3000, 8000, 18_000, 48_000, 78_000]);
      expect(server.revision).toBe(1);
      expect(a.collaboration.revision.value).toBe(1);
      expect(a.errors).toEqual([]);
    });

    it("rejects settle() with an Error when the transport throws something else", async () => {
      const a = await openClient(server, "Ada");
      vi.spyOn(a.provider, "submit").mockRejectedValueOnce("socket closed");

      a.editor.removeBlock("d1");
      const settled = a.collaboration.settle();

      await expect(settled).rejects.toThrow(new Error("socket closed"));
      await vi.advanceTimersByTimeAsync(1000);
      await settle();
      expect(server.revision).toBe(1);
    });

    it("drops a batch refused with a status that isn't worth retrying, reports it and re-syncs", async () => {
      const a = await openClient(server, "Ada");
      const operationsAfter = vi.spyOn(a.provider, "operationsAfter");
      const forbidden = new SdkError("Read-only.", 403);
      server.failNextSubmit = forbidden;

      a.editor.removeBlock("d1");
      await settle();
      await vi.advanceTimersByTimeAsync(30_000);

      expect(a.errors).toEqual([forbidden]);
      expect(a.notices).toEqual([
        { type: "editRefused", code: "invalid_operation" },
      ]);
      expect(ids(a.editor.content.value)).toEqual(["t1", "s1", "d1"]);
      expect(server.submits).toBe(1);
      expect(operationsAfter).toHaveBeenCalledWith(server.templateId, 0);
    });

    it("says nothing about a refusal that arrives after the editor is gone", async () => {
      const a = await openClient(server, "Ada");
      const { release } = gateSubmit(a.provider);
      server.failNextSubmit = new CollaborationConflict("Too large.", {
        code: "content_too_large",
      });

      a.editor.removeBlock("d1");
      await settle();
      a.scope.stop();
      release();
      await settle();

      expect(a.notices).toEqual([]);
      expect(a.errors).toEqual([]);
    });

    it("stops retrying once the editor is gone", async () => {
      const a = await openClient(server, "Ada");
      server.failNextSubmit = new TypeError("Failed to fetch");

      a.editor.removeBlock("d1");
      await settle();
      a.scope.stop();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(server.submits).toBe(1);
      expect(server.revision).toBe(0);
    });
  });

  describe("an edit refused in a lock race", () => {
    /**
     * Ada selects d1; Grace deletes it before she hears about the lock, and the
     * backend refuses. Then Ada deletes d1 herself, which lets go of it.
     */
    async function deleteRefusedThenHolderDeletes() {
      const ada = await openClient(server, "Ada");
      const grace = await openClient(server, "Grace");
      ada.editor.selectBlock("d1");
      await settle(); // Grace hasn't heard about the lock

      grace.editor.removeBlock("d1");
      await settle();
      const refused = {
        notices: [...grace.notices],
        ids: ids(grace.editor.content.value),
      };

      ada.editor.removeBlock("d1");
      await settle();
      server.deliverAll();
      await settle();
      return { grace, refused };
    }

    /**
     * Ada selects t1; Grace sets it to "Bye" before she hears about the lock,
     * and the backend refuses. Then Ada sets it to "Bye" herself and moves on.
     */
    async function updateRefusedThenHolderMatches() {
      const ada = await openClient(server, "Ada");
      const grace = await openClient(server, "Grace");
      ada.editor.selectBlock("t1");
      await settle(); // Grace hasn't heard about the lock

      grace.editor.updateBlock("t1", { content: "Bye" } as Partial<Block>);
      grace.collaboration.flush();
      await settle();
      const refused = {
        notices: [...grace.notices],
        text: text(grace.editor.content.value),
      };

      ada.editor.updateBlock("t1", { content: "Bye" } as Partial<Block>);
      ada.editor.selectBlock(null); // sends it and lets go of t1
      await settle();
      server.deliverAll();
      await settle();
      return { grace, refused };
    }

    const refusedByAda = {
      type: "editRefused",
      code: "lock_held",
      holder: expect.objectContaining({ name: "Ada" }),
    };

    it("takes back a delete refused in a lock race, then shows the holder's own delete", async () => {
      const { grace, refused } = await deleteRefusedThenHolderDeletes();

      expect(refused).toEqual({
        notices: [refusedByAda],
        ids: ["t1", "s1", "d1"],
      });
      expect(ids(server.content)).toEqual(["t1", "s1"]);
      expect(grace.editor.content.value).toEqual(server.content);
      expect(server.locks.size).toBe(0);
    });

    // guard: a refused edit's undo step leaves the stack with it.
    it("doesn't bring back a block its holder deleted, when undoing the refused delete", async () => {
      const { grace } = await deleteRefusedThenHolderDeletes();

      grace.collaboration.undo();
      await settle();

      expect(ids(server.content)).toEqual(["t1", "s1"]);
    });

    it("takes back an update refused in a lock race, then shows the holder's own", async () => {
      const { grace, refused } = await updateRefusedThenHolderMatches();

      expect(refused).toEqual({ notices: [refusedByAda], text: "Hi" });
      expect(text(server.content)).toBe("Bye");
      expect(text(grace.editor.content.value)).toBe("Bye");
      expect(server.locks.size).toBe(0);
    });

    // guard: a refused edit's undo step leaves the stack with it.
    it("doesn't revert the holder's change, when undoing the refused update", async () => {
      const { grace } = await updateRefusedThenHolderMatches();

      grace.collaboration.undo();
      await settle();

      expect(text(server.content)).toBe("Bye");
    });
  });

  describe("a local change the engine can't take", () => {
    it("takes back a block without an id, says so and reports it", async () => {
      const a = await openClient(server, "Ada");

      a.editor.setContent({
        ...a.editor.content.value,
        blocks: [
          ...a.editor.content.value.blocks,
          { id: "", type: "spacer" } as unknown as Block,
        ],
      });
      await settle();

      expect(ids(a.editor.content.value)).toEqual(["t1", "s1", "d1"]);
      expect(a.notices).toEqual([
        { type: "editRefused", code: "invalid_operation" },
      ]);
      expect(a.errors).toHaveLength(1);
      expect(a.errors[0]).toBeInstanceOf(OperationError);
      expect((a.errors[0] as OperationError).code).toBe("invalid_operation");
      expect(server.submits).toBe(0);
      expect(a.collaboration.canUndo.value).toBe(false);
    });

    it("sends the whole content when a change can't be expressed as block operations", async () => {
      const a = await openClient(server, "Ada");
      const submit = vi.spyOn(a.provider, "submit");
      const changed = withDuplicateParagraph(safeClone(BASE));

      a.editor.setContent(safeClone(changed));
      await settle();

      expect(a.errors.map((error) => error.message)).toEqual([
        "[Templatical] Collaboration: a change couldn't be expressed as block operations, so the whole content was sent.",
      ]);
      expect(submit).toHaveBeenCalledTimes(1);
      expect(submit.mock.calls[0][1].ops).toEqual([
        { op: "setContent", content: changed },
      ]);
      expect(server.content).toEqual(changed);
      expect(a.editor.content.value).toEqual(changed);
      expect(a.collaboration.revision.value).toBe(1);
      expect(a.notices).toEqual([]);
    });

    it("takes back a whole-content change while others hold locks, saying so", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      b.editor.selectBlock("t1");
      await settle();
      server.deliverAll();
      await settle();
      expect(a.collaboration.locks.value.get("t1")?.holder.name).toBe("Grace");

      a.editor.setContent(withDuplicateParagraph(safeClone(BASE)));
      await settle();

      expect(a.editor.content.value).toEqual(BASE);
      expect(a.notices).toEqual([
        { type: "editRefused", code: "locked_by_others" },
      ]);
      expect(a.errors.map((error) => error.message)).toEqual([
        "[Templatical] Collaboration: a change couldn't be expressed as block operations, so the whole content was sent.",
      ]);
      expect(server.submits).toBe(0);
    });
  });

  describe("another session's batch overtaking this one's", () => {
    /**
     * Ada removes t1 (in flight), then edits p1 (queued behind it); Grace
     * removes the section p1 sits in, which Ada hears first. Ada's p1 edit is
     * dropped before it is sent, and then her t1 removal lands.
     */
    async function unsentEditOvertaken() {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      const { release } = gateSubmit(a.provider);

      a.editor.removeBlock("t1"); // in flight
      await settle();
      a.editor.updateBlock("p1", { content: "Mine" } as Partial<Block>);
      a.collaboration.flush(); // queued behind it
      b.editor.removeBlock("s1");
      await settle();
      server.deliver(a.collaboration.sessionId);
      await settle();
      const dropped = {
        notices: [...a.notices],
        ids: ids(a.editor.content.value),
      };

      release();
      await settle();
      return { a, dropped };
    }

    it("drops an edit not sent yet that the other batch made impossible, saying so", async () => {
      const { a, dropped } = await unsentEditOvertaken();

      expect(dropped).toEqual({
        notices: [{ type: "editRefused", code: "block_missing" }],
        ids: ["d1"],
      });
      expect(ids(server.content)).toEqual(["d1"]);
      expect(a.editor.content.value).toEqual(server.content);
      expect(a.collaboration.revision.value).toBe(2);
      expect(server.submits).toBe(2); // b's delete and a's; never a's p1 edit
    });

    // guard: an edit dropped before it was sent takes its undo step with it.
    it("undoes the step before an edit dropped unsent with one press", async () => {
      const { a } = await unsentEditOvertaken();

      a.collaboration.undo();
      await settle();

      expect(ids(server.content)).toEqual(["t1", "d1"]);
      expect(a.notices).toEqual([
        { type: "editRefused", code: "block_missing" },
      ]);
    });

    it("keeps an edit in flight that the other batch overtook, and lets the backend refuse it", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      const { release } = gateSubmit(a.provider);

      a.editor.updateBlock("p1", { content: "Mine" } as Partial<Block>);
      a.collaboration.flush();
      await settle();
      b.editor.removeBlock("s1");
      await settle();
      server.deliver(a.collaboration.sessionId);
      await settle();

      // The backend decides the batch in flight: nothing said yet.
      expect(a.notices).toEqual([]);
      expect(ids(a.editor.content.value)).toEqual(["t1", "d1"]);

      release();
      await settle();

      expect(a.notices).toEqual([
        { type: "editRefused", code: "block_missing" },
      ]);
      expect(a.editor.content.value).toEqual(server.content);
      expect(a.collaboration.revision.value).toBe(1);
    });

    it("drops an undo step not sent yet that the other batch made impossible", async () => {
      const a = await openClient(server, "Ada");
      const b = await openClient(server, "Grace");
      a.editor.removeBlock("d1");
      await settle();
      server.deliverAll();
      await settle();
      const { release } = gateSubmit(a.provider);

      a.editor.updateBlock("p1", { content: "Mine" } as Partial<Block>);
      a.collaboration.flush(); // in flight
      await settle();
      a.collaboration.undo(); // queued behind it
      expect(a.collaboration.canRedo.value).toBe(true);
      b.editor.removeBlock("s1");
      await settle();
      server.deliver(a.collaboration.sessionId);
      await settle();

      expect(a.notices).toEqual([
        { type: "undoSkipped", code: "block_missing" },
      ]);
      expect(a.collaboration.canRedo.value).toBe(false);

      release();
      await settle();

      expect(a.notices).toEqual([
        { type: "undoSkipped", code: "block_missing" },
        { type: "editRefused", code: "block_missing" },
      ]);
      expect(ids(server.content)).toEqual(["t1"]);
      expect(a.editor.content.value).toEqual(server.content);
    });
  });

  describe("its own batch, confirmed out of order", () => {
    it("confirms its own batch once when the broadcast beats the submit's answer", async () => {
      const a = await openClient(server, "Ada");
      const { release, spy } = gateSubmit(a.provider, { answerLate: true });

      a.editor.removeBlock("d1");
      await settle();
      a.handlers().onBatch(safeClone(server.log[0]));
      await settle();
      expect(a.collaboration.revision.value).toBe(1);

      release();
      await settle();
      a.editor.removeBlock("t1");
      await settle();

      expect(a.collaboration.revision.value).toBe(2);
      expect(spy.mock.calls[1][1].baseRevision).toBe(1);
      expect(ids(server.content)).toEqual(["s1"]);
      expect(a.remote).toEqual([]);
      expect(a.notices).toEqual([]);
    });

    it("drops its own batch when a reload already brought it in", async () => {
      const loadTemplate = vi.fn(async () => server.template());
      const a = await openClient(server, "Ada", { loadTemplate });
      const { release } = gateSubmit(a.provider, { answerLate: true });
      vi.spyOn(a.provider, "operationsAfter").mockResolvedValue({
        revision: 1,
        resync: true,
      });

      a.editor.removeBlock("d1");
      await settle();
      a.handlers().onResync(1);
      await settle();
      expect(loadTemplate).toHaveBeenCalledTimes(1);
      expect(a.collaboration.revision.value).toBe(1);

      release();
      await expect(a.collaboration.settle()).resolves.toBeUndefined();

      expect(ids(a.editor.content.value)).toEqual(["t1", "s1"]);
      expect(a.collaboration.revision.value).toBe(1);
      expect(a.notices).toEqual([]);
      expect(a.errors).toEqual([]);
    });

    it("drops confirmed batches a reload covers while it waits on a gap", async () => {
      const loadTemplate = vi.fn(async () => server.template());
      const a = await openClient(server, "Ada", { loadTemplate });
      const b = await openClient(server, "Grace");
      vi.spyOn(a.provider, "operationsAfter").mockResolvedValue({
        revision: 2,
        resync: true,
      });

      b.editor.removeBlock("d1"); // revision 1, never delivered to a
      await settle();
      server.queueFor(a.collaboration.sessionId).splice(0);
      a.editor.removeBlock("t1"); // revision 2, waits on 1
      await settle();
      expect(a.collaboration.revision.value).toBe(0);

      await vi.advanceTimersByTimeAsync(COLLABORATION_GAP_TIMEOUT_MS);
      await settle();

      expect(loadTemplate).toHaveBeenCalledTimes(1);
      expect(a.collaboration.revision.value).toBe(2);
      expect(ids(a.editor.content.value)).toEqual(["s1"]);
      await expect(a.collaboration.settle()).resolves.toBeUndefined();
      expect(server.submits).toBe(2);
    });

    it("keeps its own confirmed batch that a reload's older copy doesn't reach, and applies it on top", async () => {
      let snapshot = server.template();
      const loadTemplate = vi.fn(async () => snapshot);
      const a = await openClient(server, "Ada", { loadTemplate });
      const b = await openClient(server, "Grace");
      vi.spyOn(a.provider, "operationsAfter").mockResolvedValue({
        revision: 2,
        resync: true,
      });

      b.editor.removeBlock("d1"); // revision 1, never delivered to a
      await settle();
      server.queueFor(a.collaboration.sessionId).splice(0);
      snapshot = server.template(); // the copy a reload will get: revision 1
      a.editor.removeBlock("t1"); // revision 2, waits on 1
      await settle();

      await vi.advanceTimersByTimeAsync(COLLABORATION_GAP_TIMEOUT_MS);
      await settle();

      expect(loadTemplate).toHaveBeenCalledTimes(1);
      expect(a.collaboration.revision.value).toBe(2);
      expect(a.editor.content.value).toEqual(server.content);
      expect(ids(a.editor.content.value)).toEqual(["s1"]);
      await expect(a.collaboration.settle()).resolves.toBeUndefined();
    });
  });

  describe("catching up", () => {
    it("reports a catch-up that fails, and catches up at the next chance", async () => {
      const a = await openClient(server, "Ada");
      const timeout = new Error("The request timed out.");
      vi.spyOn(a.provider, "operationsAfter").mockRejectedValueOnce(timeout);
      server.pushAs(AGENT, [{ op: "deleteBlock", blockId: "d1" }]);
      server.queueFor(a.collaboration.sessionId).splice(0);

      a.handlers().onResync(1);
      await settle();
      expect(a.errors).toEqual([timeout]);
      expect(a.collaboration.revision.value).toBe(0);

      a.handlers().onResync(1);
      await settle();
      expect(a.collaboration.revision.value).toBe(1);
      expect(ids(a.editor.content.value)).toEqual(["t1", "s1"]);
    });

    it("reports a reload that fails, and keeps what it has", async () => {
      const unavailable = new Error("The template couldn't be loaded.");
      const a = await openClient(server, "Ada", {
        loadTemplate: async () => {
          throw unavailable;
        },
      });
      vi.spyOn(a.provider, "operationsAfter").mockResolvedValue({
        revision: 4,
        resync: true,
      });

      a.handlers().onResync(4);
      await settle();

      expect(a.errors).toEqual([unavailable]);
      expect(a.editor.content.value).toEqual(BASE);
      expect(a.collaboration.revision.value).toBe(0);
    });

    it("reports a failure that isn't an Error as one", async () => {
      const a = await openClient(server, "Ada");
      vi.spyOn(a.provider, "operationsAfter").mockRejectedValueOnce("offline");

      a.handlers().onResync(1);
      await settle();

      expect(a.errors).toHaveLength(1);
      expect(a.errors[0]).toBeInstanceOf(Error);
      expect(a.errors[0].message).toBe("offline");
    });

    it("keeps the revision it has when a reload's template carries none", async () => {
      const a = await openClient(server, "Ada", {
        loadTemplate: async () => {
          const { revision: _revision, ...template } = server.template();
          return template;
        },
      });
      server.pushAs(AGENT, [{ op: "deleteBlock", blockId: "d1" }]);
      server.deliverAll();
      await settle();
      vi.spyOn(a.provider, "operationsAfter").mockResolvedValue({
        revision: 1,
        resync: true,
      });
      server.content = {
        ...server.content,
        settings: { ...server.content.settings, width: 640 },
      };

      a.handlers().onResync(2);
      await settle();

      expect(a.collaboration.revision.value).toBe(1);
      expect(a.editor.content.value.settings.width).toBe(640);
      expect(a.errors).toEqual([]);
    });

    it("stops following, and says so, when even a fresh copy can't take the next batch", async () => {
      const loadTemplate = vi.fn(async () => server.template());
      const a = await openClient(server, "Ada", { loadTemplate });

      a.handlers().onBatch({
        revision: 1,
        batchId: "broken",
        actor: AGENT,
        ops: [{ op: "updateBlock", blockId: "x9", set: { content: "?" } }],
      });
      await settle();

      expect(loadTemplate).toHaveBeenCalledTimes(1);
      expect(a.errors.map((error) => error.message)).toEqual([
        "[Templatical] Collaboration: this editor can't follow the template's changes. Reload the page.",
      ]);
      expect(a.collaboration.revision.value).toBe(0);
      expect(a.editor.content.value).toEqual(BASE);
      expect(a.remote).toEqual([]);

      // The batch was let go: the gap timer doesn't bring it back.
      await vi.advanceTimersByTimeAsync(COLLABORATION_GAP_TIMEOUT_MS);
      expect(loadTemplate).toHaveBeenCalledTimes(1);
    });
  });

  describe("batches from elsewhere", () => {
    it("reports an onRemoteChange that throws, and still applies the batch", async () => {
      const broken = new Error("The listener broke.");
      const a = await openClient(server, "Ada", {
        onRemoteChange: () => {
          throw broken;
        },
      });

      server.pushAs(AGENT, [{ op: "deleteBlock", blockId: "d1" }]);
      server.deliverAll();
      await settle();

      expect(a.errors).toEqual([broken]);
      expect(ids(a.editor.content.value)).toEqual(["t1", "s1"]);
      expect(a.collaboration.revision.value).toBe(1);
    });

    it.each<[string, TemplateContent]>([
      [
        "a section with more columns than its layout",
        {
          ...safeClone(BASE),
          blocks: [
            {
              id: "s1",
              type: "section",
              columns: "2",
              children: [
                [{ id: "p1", type: "paragraph", content: "Left" }],
                [],
                [{ id: "x1", type: "paragraph", content: "Extra" }],
              ],
            },
          ],
        } as unknown as TemplateContent,
      ],
      ["a block id used twice", withDuplicateParagraph(safeClone(BASE))],
    ])(
      "puts a replacement it can't patch the canvas to on it whole: %s",
      async (_label, replacement) => {
        const a = await openClient(server, "Ada");

        server.pushAs(AGENT, [{ op: "setContent", content: replacement }]);
        server.deliverAll();
        await settle();
        await vi.advanceTimersByTimeAsync(COLLABORATION_TYPING_DEBOUNCE_MS);

        expect(a.editor.content.value).toEqual(replacement);
        expect(a.collaboration.revision.value).toBe(1);
        expect(a.errors).toEqual([]);
        // Nothing sent back: the canvas only caught up with the backend.
        expect(server.submits).toBe(0);
      },
    );
  });
});
