import { describe, expect, it, vi, beforeEach } from "vitest";
import { nextTick, ref } from "vue";
import {
  createCloudCommentsProvider,
  type RealtimeChannel,
} from "../../src/cloud/comments-provider";
import { ApiClient } from "../../src/cloud/api";
import type { AuthManager } from "../../src/cloud/auth";
import type { CommentChange, CommentResponse } from "@templatical/types";

vi.mock("../../src/cloud/api");

/**
 * Cloud's adapter for the same comments contract a consumer implements.
 *
 * Two things carry the weight. The **mapping**: snake_case to camelCase, and the
 * two flat `author_*` / `resolved_by_*` pairs into author objects — plus the
 * `updated_at === created_at` case, which Cloud stamps on creation and which would
 * otherwise mark every comment "(edited)". And **`subscribe`**, which is where
 * Pusher lives so that nothing above this file knows it exists.
 */

function createMockAuthManager(
  user: { id: string; name: string; signature: string } | null = {
    id: "u-1",
    name: "Ada",
    signature: "sig-1",
  },
): AuthManager {
  return {
    projectId: "proj-1",
    tenantSlug: "acme",
    userConfig: user,
    authenticatedFetch: vi.fn(),
  } as unknown as AuthManager;
}

function record(overrides: Partial<CommentResponse> = {}): CommentResponse {
  return {
    id: "c-1",
    template_id: "tmpl-1",
    block_id: null,
    parent_id: null,
    body: "Looks good",
    author_identifier: "u-1",
    author_name: "Ada",
    resolved_at: null,
    resolved_by_identifier: null,
    resolved_by_name: null,
    created_at: "2026-08-17T10:00:00Z",
    updated_at: "2026-08-17T10:00:00Z",
    replies: [],
    ...overrides,
  };
}

function createChannel() {
  const bound = new Map<string, (payload: unknown) => void>();
  return {
    bind: vi.fn((event: string, handler: (payload: unknown) => void) => {
      bound.set(event, handler);
    }),
    unbind: vi.fn(),
    emit(event: string, payload: unknown) {
      bound.get(event)?.(payload);
    },
  };
}

function setup(
  options: {
    user?: { id: string; name: string; signature: string } | null;
    socketId?: string | null;
    channel?: ReturnType<typeof ref<RealtimeChannel | null>>;
  } = {},
) {
  const channel =
    options.channel ?? ref<RealtimeChannel | null>(null);
  const provider = createCloudCommentsProvider({
    authManager: createMockAuthManager(
      options.user === undefined
        ? { id: "u-1", name: "Ada", signature: "sig-1" }
        : options.user,
    ),
    channel,
    getSocketId: () => options.socketId ?? null,
  });
  return { provider, channel };
}

describe("createCloudCommentsProvider", () => {
  beforeEach(() => {
    vi.mocked(ApiClient).mockClear();
    vi.mocked(ApiClient.prototype.getComments).mockClear();
    vi.mocked(ApiClient.prototype.createComment).mockClear();
    vi.mocked(ApiClient.prototype.updateComment).mockClear();
    vi.mocked(ApiClient.prototype.deleteComment).mockClear();
    vi.mocked(ApiClient.prototype.resolveComment).mockClear();
  });

  describe("permissions", () => {
    it("enables all four mutations — comment storage is what the plan pays for", () => {
      const { provider } = setup();
      expect(typeof provider.list).toBe("function");
      expect(typeof provider.create).toBe("function");
      expect(typeof provider.update).toBe("function");
      expect(typeof provider.delete).toBe("function");
      expect(typeof provider.setResolved).toBe("function");
    });

    it("implements subscribe, so Cloud sessions get realtime", () => {
      const { provider } = setup();
      expect(typeof provider.subscribe).toBe("function");
    });
  });

  describe("wire shape → contract shape", () => {
    it("maps the flat author pair into an author object", async () => {
      vi.mocked(ApiClient.prototype.getComments).mockResolvedValue([
        record({ author_identifier: "u-9", author_name: "Grace" }),
      ]);
      const { provider } = setup();

      const [comment] = await provider.list("tmpl-1");

      expect(comment.author).toEqual({ id: "u-9", name: "Grace" });
      expect(comment.createdAt).toBe("2026-08-17T10:00:00Z");
      expect(comment.blockId).toBe(null);
      expect(comment.parentId).toBe(null);
      expect(comment.resolvedAt).toBe(null);
    });

    it("omits updatedAt when the comment has never been edited", async () => {
      // Cloud stamps `updated_at` on creation. Forwarding it unconditionally would
      // mark every comment "(edited)" in the panel.
      vi.mocked(ApiClient.prototype.getComments).mockResolvedValue([
        record({
          created_at: "2026-08-17T10:00:00Z",
          updated_at: "2026-08-17T10:00:00Z",
        }),
      ]);
      const { provider } = setup();

      const [comment] = await provider.list("tmpl-1");

      expect("updatedAt" in comment).toBe(false);
    });

    it("carries updatedAt once it differs from createdAt", async () => {
      vi.mocked(ApiClient.prototype.getComments).mockResolvedValue([
        record({ updated_at: "2026-08-17T11:00:00Z" }),
      ]);
      const { provider } = setup();

      const [comment] = await provider.list("tmpl-1");

      expect(comment.updatedAt).toBe("2026-08-17T11:00:00Z");
    });

    it("maps the resolver pair, and omits it while unresolved", async () => {
      vi.mocked(ApiClient.prototype.getComments).mockResolvedValue([
        record({
          resolved_at: "2026-08-17T12:00:00Z",
          resolved_by_identifier: "u-2",
          resolved_by_name: "Grace",
        }),
        record({ id: "c-2" }),
      ]);
      const { provider } = setup();

      const [resolved, open] = await provider.list("tmpl-1");

      expect(resolved.resolvedBy).toEqual({ id: "u-2", name: "Grace" });
      expect("resolvedBy" in open).toBe(false);
    });

    it("maps replies recursively and omits an empty array", async () => {
      vi.mocked(ApiClient.prototype.getComments).mockResolvedValue([
        record({
          replies: [record({ id: "r-1", parent_id: "c-1", author_name: "Grace" })],
        }),
        record({ id: "c-2", replies: [] }),
      ]);
      const { provider } = setup();

      const [thread, bare] = await provider.list("tmpl-1");

      expect(thread.replies).toHaveLength(1);
      expect(thread.replies![0]).toMatchObject({
        id: "r-1",
        parentId: "c-1",
        author: { id: "u-1", name: "Grace" },
      });
      expect("replies" in bare).toBe(false);
    });
  });

  describe("write payloads", () => {
    it("signs create with the JWT's user, not with anything the caller passed", async () => {
      vi.mocked(ApiClient.prototype.createComment).mockResolvedValue(
        record({ id: "c-new" }),
      );
      const { provider } = setup({ socketId: "sock-7" });

      const created = await (provider.create as Exclude<
        typeof provider.create,
        false
      >)("tmpl-1", { body: "hi", blockId: "blk-1" });

      expect(created.id).toBe("c-new");
      expect(ApiClient.prototype.createComment).toHaveBeenCalledWith(
        "tmpl-1",
        {
          body: "hi",
          block_id: "blk-1",
          parent_id: undefined,
          user_id: "u-1",
          user_name: "Ada",
          user_signature: "sig-1",
        },
        { "X-Socket-ID": "sock-7" },
      );
    });

    it("omits the socket header before the socket connects", async () => {
      vi.mocked(ApiClient.prototype.createComment).mockResolvedValue(record());
      const { provider } = setup({ socketId: null });

      await (provider.create as Exclude<typeof provider.create, false>)(
        "tmpl-1",
        { body: "hi" },
      );

      expect(
        vi.mocked(ApiClient.prototype.createComment).mock.calls[0][2],
      ).toBe(undefined);
    });

    it("sends the patch's body on update", async () => {
      vi.mocked(ApiClient.prototype.updateComment).mockResolvedValue(
        record({ body: "edited", updated_at: "2026-08-17T11:00:00Z" }),
      );
      const { provider } = setup();

      const updated = await (provider.update as Exclude<
        typeof provider.update,
        false
      >)("tmpl-1", "c-1", { body: "edited" });

      expect(updated.body).toBe("edited");
      expect(ApiClient.prototype.updateComment).toHaveBeenCalledWith(
        "tmpl-1",
        "c-1",
        {
          body: "edited",
          user_id: "u-1",
          user_name: "Ada",
          user_signature: "sig-1",
        },
        undefined,
      );
    });

    it("refuses an empty patch rather than PUTting an undefined body", async () => {
      const { provider } = setup();

      await expect(
        (provider.update as Exclude<typeof provider.update, false>)(
          "tmpl-1",
          "c-1",
          {},
        ),
      ).rejects.toThrow(/needs a `body`/);
      expect(ApiClient.prototype.updateComment).not.toHaveBeenCalled();
    });

    it("resolves to nothing on delete", async () => {
      vi.mocked(ApiClient.prototype.deleteComment).mockResolvedValue(undefined);
      const { provider } = setup();

      await expect(
        (provider.delete as Exclude<typeof provider.delete, false>)(
          "tmpl-1",
          "c-1",
        ),
      ).resolves.toBe(undefined);
      expect(ApiClient.prototype.deleteComment).toHaveBeenCalledWith(
        "tmpl-1",
        "c-1",
        { user_id: "u-1", user_name: "Ada", user_signature: "sig-1" },
        undefined,
      );
    });

    it("returns the endpoint's authoritative state from setResolved", async () => {
      // Cloud's endpoint toggles server-side, so the requested boolean is not sent;
      // the response is what decides, and `useComments` reads `resolvedAt` off it.
      vi.mocked(ApiClient.prototype.resolveComment).mockResolvedValue(
        record({ resolved_at: "2026-08-17T12:00:00Z" }),
      );
      const { provider } = setup();

      const result = await (provider.setResolved as Exclude<
        typeof provider.setResolved,
        false
      >)("tmpl-1", "c-1", false);

      expect(result.resolvedAt).toBe("2026-08-17T12:00:00Z");
      expect(ApiClient.prototype.resolveComment).toHaveBeenCalledWith(
        "tmpl-1",
        "c-1",
        { user_id: "u-1", user_name: "Ada", user_signature: "sig-1" },
        undefined,
      );
    });

    it("refuses every write when the token carries no user claim", async () => {
      const { provider } = setup({ user: null });

      await expect(
        (provider.create as Exclude<typeof provider.create, false>)("tmpl-1", {
          body: "x",
        }),
      ).rejects.toThrow(/signed user in the auth token/);
      expect(ApiClient.prototype.createComment).not.toHaveBeenCalled();
    });
  });

  describe("subscribe — where Pusher lives", () => {
    it("binds the broadcast event once the channel lands", async () => {
      const channel = ref<RealtimeChannel | null>(null);
      const { provider } = setup({ channel });
      const onChange = vi.fn();

      provider.subscribe!("tmpl-1", onChange);
      const pusher = createChannel();
      channel.value = pusher;
      await nextTick();

      expect(pusher.bind).toHaveBeenCalledWith(
        "comment-broadcast",
        expect.any(Function),
      );
    });

    it.each([
      ["comment_created", "created"],
      ["comment_updated", "updated"],
      ["comment_resolved", "updated"],
      ["comment_unresolved", "updated"],
    ])("maps %s to a %s change", async (action, type) => {
      const pusher = createChannel();
      const channel = ref<RealtimeChannel | null>(pusher);
      const { provider } = setup({ channel });
      const onChange = vi.fn<(change: CommentChange) => void>();

      provider.subscribe!("tmpl-1", onChange);
      await nextTick();
      pusher.emit("comment-broadcast", { action, comment: record() });

      expect(onChange).toHaveBeenCalledTimes(1);
      const change = onChange.mock.calls[0][0];
      expect(change.type).toBe(type);
      expect(change).toMatchObject({
        comment: { id: "c-1", author: { id: "u-1", name: "Ada" } },
      });
    });

    it("maps comment_deleted to the id and parent, with no comment payload", async () => {
      const pusher = createChannel();
      const channel = ref<RealtimeChannel | null>(pusher);
      const { provider } = setup({ channel });
      const onChange = vi.fn<(change: CommentChange) => void>();

      provider.subscribe!("tmpl-1", onChange);
      await nextTick();
      pusher.emit("comment-broadcast", {
        action: "comment_deleted",
        comment: record({ id: "r-1", parent_id: "c-1" }),
      });

      expect(onChange).toHaveBeenCalledWith({
        type: "deleted",
        commentId: "r-1",
        parentId: "c-1",
      });
    });

    it("rebinds when the channel is replaced, unbinding the old one", async () => {
      const first = createChannel();
      const channel = ref<RealtimeChannel | null>(first);
      const { provider } = setup({ channel });

      provider.subscribe!("tmpl-1", vi.fn());
      await nextTick();

      const second = createChannel();
      channel.value = second;
      await nextTick();

      expect(first.unbind).toHaveBeenCalledWith(
        "comment-broadcast",
        expect.any(Function),
      );
      expect(second.bind).toHaveBeenCalledWith(
        "comment-broadcast",
        expect.any(Function),
      );
    });

    it("unbinds the current channel on unsubscribe, not only on a transition", async () => {
      // The watcher alone only unbinds when the channel *changes*; without the
      // explicit unbind the handler stays attached and keeps mutating a dead list.
      const pusher = createChannel();
      const channel = ref<RealtimeChannel | null>(pusher);
      const { provider } = setup({ channel });

      const unsubscribe = provider.subscribe!("tmpl-1", vi.fn());
      await nextTick();
      unsubscribe();

      expect(pusher.unbind).toHaveBeenCalledWith(
        "comment-broadcast",
        expect.any(Function),
      );
    });

    it("stops reporting after unsubscribe", async () => {
      const pusher = createChannel();
      const channel = ref<RealtimeChannel | null>(pusher);
      const { provider } = setup({ channel });
      const onChange = vi.fn();

      const unsubscribe = provider.subscribe!("tmpl-1", onChange);
      await nextTick();
      unsubscribe();

      // The watcher is stopped, so a new channel must not be bound either.
      channel.value = createChannel();
      await nextTick();
      expect((channel.value as ReturnType<typeof createChannel>).bind).not
        .toHaveBeenCalled();
    });
  });
});
