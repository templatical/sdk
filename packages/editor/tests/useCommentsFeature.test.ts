import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, reactive, ref } from "vue";
import type {
  Comment,
  CommentChange,
  CommentsProvider,
  EditorUser,
} from "@templatical/types";
import { useCommentsFeature } from "../src/composables/useCommentsFeature";

/**
 * The editor-side seam both entry points share.
 *
 * Three things carry the weight here:
 *
 * - **No `user` ⇒ unavailable, never anonymous.** The feature is off rather than
 *   writing an unattributable comment, which is the same reasoning that makes an
 *   explicitly empty `allowedRecipients` disable test email.
 * - **`subscribe` feeds the remote-apply paths**, and is genuinely optional: a
 *   provider without it behaves identically minus the push.
 * - **Nothing is fetched until the panel opens.** A review panel nobody opens
 *   should cost no round-trip.
 */

const USER: EditorUser = { id: "u-1", name: "Ada" };

function comment(id: string, overrides: Partial<Comment> = {}): Comment {
  return {
    id,
    body: `body ${id}`,
    author: { id: USER.id, name: USER.name },
    createdAt: "2026-08-17T10:00:00Z",
    blockId: null,
    parentId: null,
    resolvedAt: null,
    ...overrides,
  };
}

function setup(
  providerOverrides: Partial<CommentsProvider> = {},
  opts: {
    user?: EditorUser | null;
    templateId?: string | null;
    isOpen?: ReturnType<typeof ref<boolean>>;
    isAvailable?: () => boolean;
    isBlockSaved?: (blockId: string) => boolean;
  } = {},
) {
  const provider: CommentsProvider = {
    list: vi.fn(async () => [comment("c-1")]),
    create: vi.fn(async () => comment("c-new")),
    update: vi.fn(async (_t, id) => comment(id, { body: "edited" })),
    delete: vi.fn(async () => {}),
    setResolved: vi.fn(async (_t, id, resolved) =>
      comment(id, { resolvedAt: resolved ? "2026-08-17T12:00:00Z" : null }),
    ),
    ...providerOverrides,
  };

  const editor = {
    state: reactive({
      template:
        opts.templateId === null ? null : { id: opts.templateId ?? "tpl-1" },
      selectedBlockId: null as string | null,
    }),
  };

  const scope = effectScope();
  let feature!: ReturnType<typeof useCommentsFeature>;
  scope.run(() => {
    feature = useCommentsFeature({
      provider,
      editor,
      user: opts.user === undefined ? USER : opts.user,
      isOpen: opts.isOpen,
      isAvailable: opts.isAvailable,
      isBlockSaved: opts.isBlockSaved,
    });
  });

  return { provider, editor, feature, scope };
}

describe("useCommentsFeature", () => {
  describe("availability", () => {
    it("is available with a provider and a user", () => {
      const { feature } = setup();
      expect(feature.isAvailable.value).toBe(true);
    });

    it("is unavailable without a user — never anonymous", () => {
      const { feature } = setup({}, { user: null });
      expect(feature.isAvailable.value).toBe(false);
    });

    it("stays unavailable without a user even when the extra gate says yes", () => {
      // The two conditions are ANDed and identity is not negotiable: Cloud's plan
      // entitlement cannot buy an unattributable comment.
      const { feature } = setup({}, { user: null, isAvailable: () => true });
      expect(feature.isAvailable.value).toBe(false);
    });

    it("defers to the extra gate when one is supplied", () => {
      const gate = ref(false);
      const { feature } = setup({}, { isAvailable: () => gate.value });

      expect(feature.isAvailable.value).toBe(false);
      gate.value = true;
      expect(feature.isAvailable.value).toBe(true);
    });

    it("closes an open panel when the feature goes away", async () => {
      const gate = ref(true);
      const { feature } = setup({}, { isAvailable: () => gate.value });
      feature.toggle();
      expect(feature.isOpen.value).toBe(true);

      gate.value = false;
      await nextTick();

      expect(feature.isOpen.value).toBe(false);
    });

    it("refuses to open while unavailable", () => {
      const { feature } = setup({}, { user: null });
      feature.toggle();
      expect(feature.isOpen.value).toBe(false);
    });
  });

  describe("hasTemplate", () => {
    it("is false before a template is loaded, true after", () => {
      const { feature, editor } = setup({}, { templateId: null });
      expect(feature.hasTemplate.value).toBe(false);

      editor.state.template = { id: "tpl-9" };
      expect(feature.hasTemplate.value).toBe(true);
    });
  });

  describe("loading follows the template, not the panel", () => {
    it("reads the list as soon as a template is attached", async () => {
      // The header badge and the per-block canvas markers both derive from the
      // whole list, so deferring the fetch to the first panel open left a
      // template with existing comments showing no sign of them anywhere.
      const { feature, provider } = setup();
      await nextTick();

      expect(provider.list).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      expect(feature.headless.comments.value.map((c) => c.id)).toEqual(["c-1"]);
    });

    it("has the unresolved count before the panel is ever opened", async () => {
      // This is the observable the badge reads. Zero here means the badge is
      // hidden on a template that does have open threads, then pops when clicked.
      const { feature } = setup();
      await nextTick();
      await Promise.resolve();

      expect(feature.isOpen.value).toBe(false);
      expect(feature.unresolvedCount.value).toBeGreaterThan(0);
    });

    it("still re-reads on every open, because the conversation grows elsewhere", async () => {
      const { feature, provider } = setup();
      await nextTick();
      const afterAttach = provider.list.mock.calls.length;

      feature.toggle();
      await nextTick();
      feature.close();
      await nextTick();
      feature.toggle();
      await nextTick();

      expect(provider.list.mock.calls.length).toBe(afterAttach + 2);
    });

    it("does not fetch without a template", async () => {
      const { feature, provider } = setup({}, { templateId: null });
      await nextTick();
      feature.toggle();
      await nextTick();
      expect(provider.list).not.toHaveBeenCalled();
    });

    it("does not fetch while the feature is unavailable", async () => {
      // No identity means no comments feature at all, so it must not reach the
      // provider on attach either.
      const { provider } = setup({}, { user: null });
      await nextTick();
      expect(provider.list).not.toHaveBeenCalled();
    });
  });

  describe("openForBlock — what a canvas indicator calls", () => {
    it("parks the block id and opens the panel", async () => {
      const { feature } = setup();

      feature.openForBlock("blk-7");

      // Parked on the feature rather than relayed through a runtime: the panel is
      // lazy, so the filter target has to survive its mount.
      expect(feature.filterBlockId.value).toBe("blk-7");
      expect(feature.isOpen.value).toBe(true);
    });

    it("re-reads when the panel is already open, since assigning true fires nothing", async () => {
      // Counted relative to the attach-time read, which happens before any of
      // this: what matters here is that opening again adds one, not the total.
      const { feature, provider } = setup();
      await nextTick();
      const afterAttach = provider.list.mock.calls.length;

      feature.toggle();
      await nextTick();
      expect(provider.list.mock.calls.length).toBe(afterAttach + 1);

      feature.openForBlock("blk-7");
      await nextTick();

      expect(feature.filterBlockId.value).toBe("blk-7");
      expect(provider.list.mock.calls.length).toBe(afterAttach + 2);
    });

    it("does nothing while unavailable", () => {
      const { feature } = setup({}, { user: null });
      feature.openForBlock("blk-7");
      expect(feature.filterBlockId.value).toBe(null);
      expect(feature.isOpen.value).toBe(false);
    });
  });

  describe("panel state", () => {
    it("uses a caller-supplied ref, so Cloud keeps its panels mutually exclusive", () => {
      const shared = ref(false);
      const { feature } = setup({}, { isOpen: shared });

      feature.toggle();
      expect(shared.value).toBe(true);

      shared.value = false;
      expect(feature.isOpen.value).toBe(false);
    });
  });

  describe("subscribe feeds the remote-apply paths", () => {
    function withSubscribe() {
      let emit: ((change: CommentChange) => void) | null = null;
      const unsubscribe = vi.fn();
      const result = setup({
        subscribe: vi.fn((_templateId, onChange) => {
          emit = onChange;
          return unsubscribe;
        }),
      });
      return { ...result, emit: () => emit!, unsubscribe };
    }

    it("subscribes to the open template", () => {
      const { provider } = withSubscribe();
      expect(provider.subscribe).toHaveBeenCalledTimes(1);
      expect(vi.mocked(provider.subscribe!).mock.calls[0][0]).toBe("tpl-1");
    });

    it("applies a remote create into the list", () => {
      const { feature, emit } = withSubscribe();

      emit()({ type: "created", comment: comment("c-9") });

      expect(feature.headless.comments.value.map((c) => c.id)).toEqual(["c-9"]);
    });

    it("applies a remote update in place", () => {
      const { feature, emit } = withSubscribe();

      emit()({ type: "created", comment: comment("c-9") });
      emit()({ type: "updated", comment: comment("c-9", { body: "remote" }) });

      expect(feature.headless.comments.value[0].body).toBe("remote");
    });

    it("applies a remote delete", () => {
      const { feature, emit } = withSubscribe();

      emit()({ type: "created", comment: comment("c-9") });
      emit()({ type: "deleted", commentId: "c-9" });

      expect(feature.headless.comments.value).toEqual([]);
    });

    it("keeps the unresolved badge in step with remote changes", () => {
      const { feature, emit } = withSubscribe();

      emit()({ type: "created", comment: comment("c-9") });
      expect(feature.unresolvedCount.value).toBe(1);

      emit()({
        type: "updated",
        comment: comment("c-9", { resolvedAt: "2026-08-17T12:00:00Z" }),
      });
      expect(feature.unresolvedCount.value).toBe(0);
    });

    it("unsubscribes when the editor tears down", () => {
      const { scope, unsubscribe } = withSubscribe();
      expect(unsubscribe).not.toHaveBeenCalled();

      scope.stop();

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it("works identically with no subscribe at all — realtime is separable", async () => {
      const { feature, provider } = setup();
      expect(provider.subscribe).toBe(undefined);

      feature.toggle();
      await nextTick();
      await Promise.resolve();

      expect(feature.headless.comments.value.map((c) => c.id)).toEqual(["c-1"]);
      expect(feature.isAvailable.value).toBe(true);
    });
  });

  describe("capability", () => {
    it("reports the provider's mutations", () => {
      const { feature } = setup({
        create: false,
        update: false,
        delete: false,
        setResolved: false,
      });

      expect(feature.capability.canCreate.value).toBe(false);
      expect(feature.capability.canUpdate.value).toBe(false);
      expect(feature.capability.canDelete.value).toBe(false);
      expect(feature.capability.canResolve.value).toBe(false);
    });

    it("counts a block's comments, replies included", async () => {
      const { feature } = setup({
        list: vi.fn(async () => [
          comment("c-1", {
            blockId: "blk-1",
            replies: [comment("r-1", { parentId: "c-1", blockId: "blk-1" })],
          }),
        ]),
      });

      feature.toggle();
      await nextTick();
      await Promise.resolve();

      expect(feature.capability.getBlockCount("blk-1")).toBe(2);
      expect(feature.capability.getBlockCount("blk-2")).toBe(0);
    });

    it("assumes any anchor is saved when no predicate is supplied", () => {
      const { feature } = setup();
      expect(feature.capability.isBlockSaved("anything")).toBe(true);
    });

    it("defers to Cloud's predicate when one is supplied", () => {
      const { feature } = setup(
        {},
        { isBlockSaved: (id) => id === "saved-block" },
      );
      expect(feature.capability.isBlockSaved("saved-block")).toBe(true);
      expect(feature.capability.isBlockSaved("canvas-only")).toBe(false);
    });

    it("carries isAvailable and the unresolved count for the shared chrome", async () => {
      const { feature } = setup({}, { user: null });
      expect(feature.capability.isAvailable.value).toBe(false);
      expect(feature.capability.unresolvedCount.value).toBe(0);
    });
  });
});
