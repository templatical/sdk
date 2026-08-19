import { describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { useComments, useCommentListener } from "../src/comments";
import type {
  Comment,
  CommentAuthor,
  CommentChange,
  CommentEvent,
  CommentsProvider,
} from "@templatical/types";

/**
 * Reactive state over a `CommentsProvider`.
 *
 * Two things carry the weight here. First, **the four mutations are `false`-able**
 * and a refused one must *reject* rather than resolve — a resolved promise reads
 * as "saved" to whoever awaited it. Second, **no `user` means nothing is written**:
 * an unattributable comment is worse than no comment feature, so every mutation
 * refuses rather than falling back to an anonymous author.
 */

const USER: CommentAuthor = { id: "u-1", name: "Ada" };
const OTHER: CommentAuthor = { id: "u-2", name: "Grace" };

function comment(id: string, overrides: Partial<Comment> = {}): Comment {
  return {
    id,
    body: `body ${id}`,
    author: USER,
    createdAt: "2026-08-17T10:00:00Z",
    blockId: null,
    parentId: null,
    resolvedAt: null,
    ...overrides,
  };
}

function setup(
  overrides: Partial<CommentsProvider> = {},
  options: {
    templateId?: string | null;
    user?: CommentAuthor | null;
    onError?: (e: Error) => void;
    onComment?: (e: CommentEvent) => void;
  } = {},
) {
  const provider: CommentsProvider = {
    list: vi.fn(async () => ({ comments: [] as Comment[] })),
    create: vi.fn(async () => comment("c-new")),
    update: vi.fn(async (_t: string, id: string) =>
      comment(id, { body: "edited", updatedAt: "2026-08-17T11:00:00Z" }),
    ),
    delete: vi.fn(async () => {}),
    setResolved: vi.fn(async (_t: string, id: string, resolved: boolean) =>
      comment(id, { resolvedAt: resolved ? "2026-08-17T12:00:00Z" : null }),
    ),
    ...overrides,
  };
  const comments = useComments({
    provider,
    getTemplateId: () =>
      options.templateId === undefined ? "tpl-1" : options.templateId,
    getUser: () => (options.user === undefined ? USER : options.user),
    onComment: options.onComment,
    onError: options.onError,
  });
  return { provider, comments };
}

describe("useComments", () => {
  describe("list", () => {
    it("surfaces the provider's nextCursor, and forwards params back", async () => {
      const list = vi.fn(async () => ({
        comments: [comment("c-1")],
        nextCursor: "page-2",
      }));
      const { comments, provider } = setup({ list });

      await comments.load({ limit: 1 });

      expect(comments.nextCursor.value).toBe("page-2");
      expect(provider.list).toHaveBeenCalledWith("tpl-1", { limit: 1 });

      list.mockResolvedValueOnce({ comments: [comment("c-2")] } as never);
      await comments.load({ cursor: "page-2" });
      expect(comments.nextCursor.value).toBeUndefined();
    });

    it("stores what the provider returned, in the provider's order", async () => {
      const threads = [comment("c-2"), comment("c-1")];
      const { comments, provider } = setup({ list: vi.fn(async () => ({ comments: threads })) });

      await comments.load();

      expect(comments.comments.value.map((c) => c.id)).toEqual(["c-2", "c-1"]);
      expect(provider.list).toHaveBeenCalledWith("tpl-1", undefined);
    });

    it("forwards params for a headless caller", async () => {
      const { comments, provider } = setup();
      await comments.load({});
      expect(provider.list).toHaveBeenCalledWith("tpl-1", {});
    });

    it("clears isLoading and reports through onError on failure", async () => {
      const onError = vi.fn();
      const { comments } = setup(
        { list: vi.fn(async () => Promise.reject(new Error("boom"))) },
        { onError },
      );

      await expect(comments.load()).rejects.toThrow("boom");
      expect(comments.isLoading.value).toBe(false);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(comments.comments.value).toEqual([]);
    });

    it("refuses without a template rather than listing nothing", async () => {
      const { comments, provider } = setup({}, { templateId: null });
      await expect(comments.load()).rejects.toThrow(/needs a template/);
      expect(provider.list).not.toHaveBeenCalled();
    });
  });

  describe("derived counts", () => {
    it("counts roots plus replies, and unresolved roots separately", async () => {
      const threads = [
        comment("a", { replies: [comment("a1"), comment("a2")] }),
        comment("b", { resolvedAt: "2026-08-17T09:00:00Z" }),
      ];
      const { comments } = setup({ list: vi.fn(async () => ({ comments: threads })) });
      await comments.load();

      expect(comments.totalCount.value).toBe(4);
      expect(comments.unresolvedCount.value).toBe(1);
    });

    it("groups by anchored block, counting a thread's replies with it", async () => {
      const threads = [
        comment("a", { blockId: "blk-1", replies: [comment("a1")] }),
        comment("b", { blockId: "blk-1" }),
        comment("c", { blockId: null }),
      ];
      const { comments } = setup({ list: vi.fn(async () => ({ comments: threads })) });
      await comments.load();

      expect(comments.commentCountByBlock.value.get("blk-1")).toBe(3);
      expect(comments.commentCountByBlock.value.has("blk-2")).toBe(false);
    });
  });

  describe("create", () => {
    it("appends a root and fires a created event", async () => {
      const onComment = vi.fn();
      const created = comment("c-9");
      const { comments, provider } = setup(
        { create: vi.fn(async () => created) },
        { onComment },
      );

      const result = await comments.create({ body: "hello" });

      expect(result).toBe(created);
      expect(provider.create).toHaveBeenCalledWith("tpl-1", { body: "hello" });
      expect(comments.comments.value.map((c) => c.id)).toEqual(["c-9"]);
      expect(onComment).toHaveBeenCalledWith({
        type: "created",
        comment: created,
      });
    });

    it("nests a reply under its parent rather than appending a root", async () => {
      const reply = comment("r-1", { parentId: "c-1" });
      const { comments } = setup({
        list: vi.fn(async () => ({ comments: [comment("c-1")] })),
        create: vi.fn(async () => reply),
      });
      await comments.load();

      await comments.create({ body: "re", parentId: "c-1" });

      expect(comments.comments.value).toHaveLength(1);
      expect(comments.comments.value[0].replies?.map((r) => r.id)).toEqual([
        "r-1",
      ]);
    });

    it("clears isSubmitting and leaves the list untouched on failure", async () => {
      const onError = vi.fn();
      const { comments } = setup(
        { create: vi.fn(async () => Promise.reject(new Error("nope"))) },
        { onError },
      );

      await expect(comments.create({ body: "x" })).rejects.toThrow("nope");
      expect(comments.isSubmitting.value).toBe(false);
      expect(comments.comments.value).toEqual([]);
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  describe("update", () => {
    it("replaces the comment in place and keeps its replies", async () => {
      const { comments } = setup({
        list: vi.fn(async () => ({ comments: [comment("c-1", { replies: [comment("r-1")] })] })),
      });
      await comments.load();

      await comments.update("c-1", { body: "edited" });

      expect(comments.comments.value[0].body).toBe("edited");
      // The update payload carries no replies; dropping them would empty the
      // thread the user is looking at.
      expect(comments.comments.value[0].replies?.map((r) => r.id)).toEqual([
        "r-1",
      ]);
    });

    it("replaces a reply without touching its siblings", async () => {
      const { comments } = setup({
        list: vi.fn(async () => ({ comments: [
          comment("c-1", { replies: [comment("r-1"), comment("r-2")] }),
        ] })),
        update: vi.fn(async () =>
          comment("r-2", { parentId: "c-1", body: "edited" }),
        ),
      });
      await comments.load();

      await comments.update("r-2", { body: "edited" });

      const replies = comments.comments.value[0].replies ?? [];
      expect(replies.map((r) => r.body)).toEqual(["body r-1", "edited"]);
    });
  });

  describe("delete", () => {
    it("removes a root and fires a deleted event carrying what was removed", async () => {
      const onComment = vi.fn();
      const { comments, provider } = setup(
        { list: vi.fn(async () => ({ comments: [comment("c-1"), comment("c-2")] })) },
        { onComment },
      );
      await comments.load();
      onComment.mockClear();

      await comments.remove("c-1");

      expect(provider.delete).toHaveBeenCalledWith("tpl-1", "c-1");
      expect(comments.comments.value.map((c) => c.id)).toEqual(["c-2"]);
      expect(onComment).toHaveBeenCalledWith({
        type: "deleted",
        comment: expect.objectContaining({ id: "c-1" }),
      });
    });

    it("removes a reply from its parent, leaving the thread standing", async () => {
      const { comments } = setup({
        list: vi.fn(async () => ({ comments: [
          comment("c-1", {
            replies: [
              comment("r-1", { parentId: "c-1" }),
              comment("r-2", { parentId: "c-1" }),
            ],
          }),
        ] })),
      });
      await comments.load();

      await comments.remove("r-1");

      expect(comments.comments.value).toHaveLength(1);
      expect(comments.comments.value[0].replies?.map((r) => r.id)).toEqual([
        "r-2",
      ]);
    });
  });

  describe("setResolved", () => {
    it("sends the target state, not a toggle", async () => {
      const { comments, provider } = setup({
        list: vi.fn(async () => ({ comments: [comment("c-1")] })),
      });
      await comments.load();

      await comments.setResolved("c-1", true);

      expect(provider.setResolved).toHaveBeenCalledWith("tpl-1", "c-1", true);
      expect(comments.comments.value[0].resolvedAt).toBe(
        "2026-08-17T12:00:00Z",
      );
    });

    it("fires the event the stored result implies, not the one requested", async () => {
      const onComment = vi.fn();
      // A store that refuses to reopen: asked for `false`, answers "still resolved".
      const { comments } = setup(
        {
          setResolved: vi.fn(async () =>
            comment("c-1", { resolvedAt: "2026-08-17T12:00:00Z" }),
          ),
        },
        { onComment },
      );

      await comments.setResolved("c-1", false);

      expect(onComment).toHaveBeenCalledWith({
        type: "resolved",
        comment: expect.objectContaining({ resolvedAt: "2026-08-17T12:00:00Z" }),
      });
    });
  });

  describe("permissions — a mutation the provider withheld", () => {
    it("reports each capability off the provider's shape", () => {
      const { comments } = setup({
        create: false,
        update: false,
        delete: false,
        setResolved: false,
      });
      expect(comments.canCreate.value).toBe(false);
      expect(comments.canUpdate.value).toBe(false);
      expect(comments.canDelete.value).toBe(false);
      expect(comments.canResolve.value).toBe(false);
    });

    it("reports each capability true when supplied", () => {
      const { comments } = setup();
      expect(comments.canCreate.value).toBe(true);
      expect(comments.canUpdate.value).toBe(true);
      expect(comments.canDelete.value).toBe(true);
      expect(comments.canResolve.value).toBe(true);
    });

    it("rejects rather than no-ops, so a caller can't read success", async () => {
      const { comments } = setup({
        create: false,
        update: false,
        delete: false,
        setResolved: false,
      });

      await expect(comments.create({ body: "x" })).rejects.toThrow(
        /create is disabled by the provider/,
      );
      await expect(comments.update("c-1", { body: "x" })).rejects.toThrow(
        /update is disabled by the provider/,
      );
      await expect(comments.remove("c-1")).rejects.toThrow(
        /delete is disabled by the provider/,
      );
      await expect(comments.setResolved("c-1", true)).rejects.toThrow(
        /setResolved is disabled by the provider/,
      );
    });

    it("still lists — the read-only review", async () => {
      const { comments } = setup({
        list: vi.fn(async () => ({ comments: [comment("c-1")] })),
        create: false,
        update: false,
        delete: false,
        setResolved: false,
      });

      await comments.load();
      expect(comments.comments.value.map((c) => c.id)).toEqual(["c-1"]);
    });
  });

  describe("no user — degrades to unwritable, never anonymous", () => {
    it("refuses every mutation with an actionable message", async () => {
      const { comments, provider } = setup({}, { user: null });

      for (const call of [
        () => comments.create({ body: "x" }),
        () => comments.update("c-1", { body: "x" }),
        () => comments.remove("c-1"),
        () => comments.setResolved("c-1", true),
      ]) {
        await expect(call()).rejects.toThrow(/who is commenting/);
      }

      expect(provider.create).not.toHaveBeenCalled();
      expect(provider.update).not.toHaveBeenCalled();
      expect(provider.delete).not.toHaveBeenCalled();
      expect(provider.setResolved).not.toHaveBeenCalled();
    });

    it("still reads, so existing threads stay visible", async () => {
      const { comments } = setup(
        { list: vi.fn(async () => ({ comments: [comment("c-1")] })) },
        { user: null },
      );
      await comments.load();
      expect(comments.comments.value.map((c) => c.id)).toEqual(["c-1"]);
    });

    it("owns nothing, so no edit or delete affordance can appear", async () => {
      const { comments } = setup({}, { user: null });
      expect(comments.isOwn(comment("c-1", { author: USER }))).toBe(false);
    });

    it("reads the user through a getter, so one arriving late works", async () => {
      // Cloud fills `user` from the JWT and a consumer may swap it; a snapshot at
      // setup would pin the answer forever — the `allowedRecipients` lesson.
      const user = ref<CommentAuthor | null>(null);
      const provider: CommentsProvider = {
        list: vi.fn(async () => ({ comments: [] })),
        create: vi.fn(async () => comment("c-1")),
        update: false,
        delete: false,
        setResolved: false,
      };
      const comments = useComments({
        provider,
        getTemplateId: () => "tpl-1",
        getUser: () => user.value,
      });

      await expect(comments.create({ body: "x" })).rejects.toThrow(
        /who is commenting/,
      );

      user.value = USER;
      await expect(comments.create({ body: "x" })).resolves.toMatchObject({
        id: "c-1",
      });
    });
  });

  describe("isOwn", () => {
    it("is true only for the current user's own comment", () => {
      const { comments } = setup();
      expect(comments.isOwn(comment("a", { author: USER }))).toBe(true);
      expect(comments.isOwn(comment("b", { author: OTHER }))).toBe(false);
    });
  });

  describe("find", () => {
    it("locates roots and replies, and answers null for neither", async () => {
      const { comments } = setup({
        list: vi.fn(async () => ({ comments: [comment("c-1", { replies: [comment("r-1")] })] })),
      });
      await comments.load();

      expect(comments.find("c-1")?.id).toBe("c-1");
      expect(comments.find("r-1")?.id).toBe("r-1");
      expect(comments.find("nope")).toBe(null);
    });
  });

  describe("applyRemote* — what a subscribe feeds", () => {
    it("adds a remote root and fires created", async () => {
      const onComment = vi.fn();
      const { comments } = setup({}, { onComment });

      comments.applyRemoteCreate(comment("c-9"));

      expect(comments.comments.value.map((c) => c.id)).toEqual(["c-9"]);
      expect(onComment).toHaveBeenCalledWith({
        type: "created",
        comment: expect.objectContaining({ id: "c-9" }),
      });
    });

    it("is echo-safe: a create for a comment already present replaces it", async () => {
      const { comments } = setup({
        list: vi.fn(async () => ({ comments: [comment("c-1", { body: "first" })] })),
      });
      await comments.load();

      comments.applyRemoteCreate(comment("c-1", { body: "first" }));

      expect(comments.comments.value).toHaveLength(1);
      expect(comments.comments.value[0].body).toBe("first");
    });

    it("replaces on update and reports resolved off resolvedAt", async () => {
      const onComment = vi.fn();
      const { comments } = setup(
        { list: vi.fn(async () => ({ comments: [comment("c-1")] })) },
        { onComment },
      );
      await comments.load();
      onComment.mockClear();

      comments.applyRemoteUpdate(
        comment("c-1", { resolvedAt: "2026-08-17T12:00:00Z" }),
      );

      expect(comments.comments.value[0].resolvedAt).toBe(
        "2026-08-17T12:00:00Z",
      );
      expect(onComment.mock.calls[0][0].type).toBe("resolved");
    });

    it("reports a plain body change as updated", async () => {
      const onComment = vi.fn();
      const { comments } = setup(
        { list: vi.fn(async () => ({ comments: [comment("c-1")] })) },
        { onComment },
      );
      await comments.load();
      onComment.mockClear();

      comments.applyRemoteUpdate(comment("c-1", { body: "changed" }));

      expect(onComment.mock.calls[0][0].type).toBe("updated");
    });

    it("removes a remote delete using the parent the transport supplied", async () => {
      const { comments } = setup({
        list: vi.fn(async () => ({ comments: [
          comment("c-1", { replies: [comment("r-1", { parentId: "c-1" })] }),
        ] })),
      });
      await comments.load();

      comments.applyRemoteDelete("r-1", "c-1");

      expect(comments.comments.value[0].replies).toEqual([]);
    });

    it("fires no event for a delete of something never loaded", () => {
      const onComment = vi.fn();
      const { comments } = setup({}, { onComment });

      comments.applyRemoteDelete("never-seen", null);

      expect(onComment).not.toHaveBeenCalled();
      expect(comments.comments.value).toEqual([]);
    });
  });
});

describe("useCommentListener", () => {
  function listen(
    subscribe: CommentsProvider["subscribe"],
    templateId = ref<string | null>("tpl-1"),
  ) {
    const provider: CommentsProvider = {
      list: vi.fn(async () => ({ comments: [] })),
      create: false,
      update: false,
      delete: false,
      setResolved: false,
      ...(subscribe ? { subscribe } : {}),
    };
    const comments = useComments({
      provider,
      getTemplateId: () => templateId.value,
      getUser: () => USER,
    });
    const scope = effectScope();
    scope.run(() => {
      useCommentListener({
        comments,
        provider,
        getTemplateId: () => templateId.value,
      });
    });
    return { comments, provider, scope, templateId };
  }

  it("does nothing at all when the provider has no subscribe", () => {
    // Realtime is separable: comments without it work identically.
    const { comments } = listen(undefined);
    expect(comments.comments.value).toEqual([]);
  });

  it("subscribes to the template that is open", () => {
    const subscribe = vi.fn(() => () => {});
    listen(subscribe);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe.mock.calls[0][0]).toBe("tpl-1");
  });

  it("does not subscribe before a template exists", () => {
    const subscribe = vi.fn(() => () => {});
    listen(subscribe, ref<string | null>(null));
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("feeds all three change kinds into the matching apply path", () => {
    let emit: ((change: CommentChange) => void) | null = null;
    const { comments } = listen((_t, onChange) => {
      emit = onChange;
      return () => {};
    });

    emit!({ type: "created", comment: comment("c-9") });
    expect(comments.comments.value.map((c) => c.id)).toEqual(["c-9"]);

    emit!({ type: "updated", comment: comment("c-9", { body: "remote" }) });
    expect(comments.comments.value[0].body).toBe("remote");

    emit!({ type: "deleted", commentId: "c-9" });
    expect(comments.comments.value).toEqual([]);
  });

  it("uses the parentId a deleted change carries, without loading the thread", () => {
    let emit: ((change: CommentChange) => void) | null = null;
    const { comments } = listen((_t, onChange) => {
      emit = onChange;
      return () => {};
    });

    emit!({ type: "created", comment: comment("c-1") });
    emit!({
      type: "created",
      comment: comment("r-1", { parentId: "c-1" }),
    });
    expect(comments.comments.value[0].replies?.map((r) => r.id)).toEqual([
      "r-1",
    ]);

    emit!({ type: "deleted", commentId: "r-1", parentId: "c-1" });
    expect(comments.comments.value[0].replies).toEqual([]);
    expect(comments.comments.value).toHaveLength(1);
  });

  it("resubscribes to the new template and drops the old subscription", async () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(() => unsubscribe);
    const templateId = ref<string | null>("tpl-1");
    listen(subscribe, templateId);

    templateId.value = "tpl-2";
    await nextTick();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(subscribe.mock.calls[1][0]).toBe("tpl-2");
  });

  it("unsubscribes when the scope is disposed", () => {
    const unsubscribe = vi.fn();
    const { scope } = listen(() => unsubscribe);

    expect(unsubscribe).not.toHaveBeenCalled();
    scope.stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
