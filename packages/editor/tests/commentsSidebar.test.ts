// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { computed, nextTick, reactive, ref } from "vue";
import CommentsSidebar from "../src/components/CommentsSidebar.vue";
import { mountEditor } from "./helpers/mount";
import { EDITOR_KEY } from "../src/keys";
import type { Comment, CommentsProvider, EditorUser } from "@templatical/types";
import { useCommentsFeature } from "../src/composables/useCommentsFeature";

/**
 * The panel, driven by the shared feature rather than by injections.
 *
 * What matters here is that **every write affordance is gated on the provider
 * having supplied that mutation, and hidden rather than disabled** — so a provider
 * that withholds all four yields a review you can read and navigate but not
 * change. Disabling instead of hiding would read as a broken UI; a stray enabled
 * button would read as a working one that silently rejects.
 *
 * These cases also pin that the panel is shared rather than cloud-only: it takes
 * the feature as a prop instead of injecting an auth manager, and renders the
 * camelCase `Comment` contract rather than any backend's wire shape.
 */

const USER: EditorUser = { id: "u-1", name: "Ada" };
const OTHER = { id: "u-2", name: "Grace" };

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

async function mountSidebar(
  opts: {
    threads?: Comment[];
    permissions?: Partial<
      Pick<CommentsProvider, "create" | "update" | "delete" | "setResolved">
    >;
    user?: EditorUser | null;
    isBlockSaved?: (blockId: string) => boolean;
    filterBlockId?: string | null;
    /** Block ids present on the canvas, so anchored comments aren't "missing". */
    canvasBlockIds?: string[];
  } = {},
) {
  const threads = opts.threads ?? [comment("c-1")];
  const provider: CommentsProvider = {
    list: vi.fn(async () => threads),
    create: vi.fn(async () => comment("c-new")),
    update: vi.fn(async (_t, id) => comment(id, { body: "edited" })),
    delete: vi.fn(async () => {}),
    setResolved: vi.fn(async (_t, id, resolved) =>
      comment(id, { resolvedAt: resolved ? "2026-08-17T12:00:00Z" : null }),
    ),
    ...opts.permissions,
  };

  const editor = {
    state: reactive({
      template: { id: "tpl-1" },
      selectedBlockId: null as string | null,
    }),
    content: ref({
      blocks: (opts.canvasBlockIds ?? []).map((id) => ({ id, type: "title" })),
      settings: {},
    }),
    selectBlock: vi.fn(),
  };

  const feature = useCommentsFeature({
    provider,
    editor,
    user: opts.user === undefined ? USER : opts.user,
    isBlockSaved: opts.isBlockSaved,
  });

  // The list is read when the panel opens; drive that explicitly rather than
  // relying on the wrapper's mount order.
  await feature.headless.load();
  if (opts.filterBlockId !== undefined) {
    feature.filterBlockId.value = opts.filterBlockId;
  }

  const wrapper = mountEditor(CommentsSidebar, {
    props: { visible: true, feature },
    provides: {
      [EDITOR_KEY]: {
        state: editor.state,
        content: editor.content,
        selectBlock: editor.selectBlock,
      },
    },
  });
  await nextTick();
  return { wrapper, feature, provider, editor };
}

describe("CommentsSidebar", () => {
  describe("thread rendering", () => {
    it("renders the author's name from the camelCase contract shape", async () => {
      const { wrapper } = await mountSidebar({
        threads: [comment("c-1", { author: OTHER, body: "Nice header" })],
      });

      expect(wrapper.text()).toContain("Grace");
      expect(wrapper.text()).toContain("Nice header");
    });

    it('labels the current user\'s own comment "you" rather than by name', async () => {
      const { wrapper } = await mountSidebar({
        threads: [comment("c-1", { author: { id: USER.id, name: USER.name } })],
      });

      // Stub translations render as their dot-path.
      expect(wrapper.text()).toContain("comments.ownedByYou");
      expect(wrapper.text()).not.toContain("Ada");
    });

    it("marks an edited comment, and only an edited one", async () => {
      const { wrapper } = await mountSidebar({
        threads: [
          comment("c-1", { updatedAt: "2026-08-17T11:00:00Z" }),
          comment("c-2"),
        ],
      });

      // One marker for two comments — the un-edited one carries none.
      const markers = wrapper.text().match(/comments\.edited/g) ?? [];
      expect(markers).toHaveLength(1);
    });

    it("shows the resolved badge with the resolver's name", async () => {
      const { wrapper } = await mountSidebar({
        threads: [
          comment("c-1", {
            resolvedAt: "2026-08-17T12:00:00Z",
            resolvedBy: OTHER,
          }),
        ],
      });

      // The default filter hides resolved threads, so switch to All first.
      await wrapper
        .findAll("button")
        .find((b) => b.text() === "comments.filterAll")!
        .trigger("click");

      expect(wrapper.text()).toContain("comments.resolvedBy");
    });

    it("names the close control and exposes filter pressed state", async () => {
      const { wrapper } = await mountSidebar();
      expect(wrapper.find('[aria-label="comments.close"]').exists()).toBe(true);
      expect(
        wrapper
          .get('[data-testid="comments-filter-unresolved"]')
          .attributes("aria-pressed"),
      ).toBe("true");
      expect(
        wrapper
          .get('[data-testid="comments-filter-all"]')
          .attributes("aria-pressed"),
      ).toBe("false");
    });

    it("filters to unresolved by default", async () => {
      const { wrapper } = await mountSidebar({
        threads: [
          comment("c-open", { body: "still open" }),
          comment("c-done", {
            body: "already done",
            resolvedAt: "2026-08-17T12:00:00Z",
          }),
        ],
      });

      expect(wrapper.text()).toContain("still open");
      expect(wrapper.text()).not.toContain("already done");
    });
  });

  describe("read-only review — every mutation withheld", () => {
    const READ_ONLY = {
      create: false as const,
      update: false as const,
      delete: false as const,
      setResolved: false as const,
    };

    it("renders no composer", async () => {
      const { wrapper } = await mountSidebar({ permissions: READ_ONLY });
      expect(wrapper.find("textarea").exists()).toBe(false);
    });

    it("renders the composer when create is supplied", async () => {
      const { wrapper } = await mountSidebar();
      expect(wrapper.find("textarea").exists()).toBe(true);
    });

    it("renders no resolve, edit, delete or reply action", async () => {
      const { wrapper } = await mountSidebar({ permissions: READ_ONLY });
      const titles = wrapper
        .findAll("button")
        .map((b) => b.attributes("title") ?? "");

      expect(titles).not.toContain("comments.resolve");
      expect(titles).not.toContain("comments.edit");
      expect(titles).not.toContain("comments.delete");
      expect(titles).not.toContain("comments.reply");
    });

    it("still renders the thread, so the review is readable", async () => {
      const { wrapper } = await mountSidebar({
        permissions: READ_ONLY,
        threads: [comment("c-1", { body: "read me" })],
      });
      expect(wrapper.text()).toContain("read me");
    });
  });

  describe("per-mutation gating", () => {
    it("hides only the resolve action when setResolved is withheld", async () => {
      const { wrapper } = await mountSidebar({
        permissions: { setResolved: false },
      });
      const titles = wrapper
        .findAll("button")
        .map((b) => b.attributes("title") ?? "");

      expect(titles).not.toContain("comments.resolve");
      expect(titles).toContain("comments.edit");
      expect(titles).toContain("comments.delete");
    });

    it("hides only the edit action when update is withheld", async () => {
      const { wrapper } = await mountSidebar({
        permissions: { update: false },
      });
      const titles = wrapper
        .findAll("button")
        .map((b) => b.attributes("title") ?? "");

      expect(titles).not.toContain("comments.edit");
      expect(titles).toContain("comments.delete");
      expect(titles).toContain("comments.resolve");
    });

    it("hides only the delete action when delete is withheld", async () => {
      const { wrapper } = await mountSidebar({
        permissions: { delete: false },
      });
      const titles = wrapper
        .findAll("button")
        .map((b) => b.attributes("title") ?? "");

      expect(titles).not.toContain("comments.delete");
      expect(titles).toContain("comments.edit");
    });

    it("never offers edit or delete on someone else's comment", async () => {
      const { wrapper } = await mountSidebar({
        threads: [comment("c-1", { author: OTHER })],
      });
      const titles = wrapper
        .findAll("button")
        .map((b) => b.attributes("title") ?? "");

      expect(titles).not.toContain("comments.edit");
      expect(titles).not.toContain("comments.delete");
      // Resolving someone else's thread is fine — that's the point of a review.
      expect(titles).toContain("comments.resolve");
    });
  });

  describe("writes", () => {
    it("creates a comment anchored to nothing when no block filter is active", async () => {
      const { wrapper, provider } = await mountSidebar();

      await wrapper.find("textarea").setValue("a new note");
      const send = wrapper
        .findAll("button")
        .find((b) => b.element.className.includes("tpl-comments-send-btn"))!;
      await send.trigger("click");

      expect(provider.create).toHaveBeenCalledWith("tpl-1", {
        body: "a new note",
        blockId: undefined,
      });
    });

    it("sends the target resolved state, not a toggle", async () => {
      const { wrapper, provider } = await mountSidebar();

      const resolve = wrapper
        .findAll("button")
        .find((b) => b.attributes("title") === "comments.resolve")!;
      await resolve.trigger("click");

      expect(provider.setResolved).toHaveBeenCalledWith("tpl-1", "c-1", true);
    });
  });

  describe("block filter", () => {
    it("switches to the block filter for the id the feature parked", async () => {
      const { wrapper } = await mountSidebar({
        threads: [
          comment("c-1", { blockId: "blk-1", body: "on block one" }),
          comment("c-2", { blockId: "blk-2", body: "on block two" }),
        ],
        filterBlockId: "blk-1",
      });

      expect(wrapper.text()).toContain("on block one");
      expect(wrapper.text()).not.toContain("on block two");
    });

    it("replaces the composer with a save-first notice for an unsaved block", async () => {
      // Cloud anchors a comment server-side; a block that only exists on the canvas
      // has nothing stored to attach to.
      const { wrapper } = await mountSidebar({
        threads: [],
        filterBlockId: "canvas-only",
        isBlockSaved: () => false,
      });

      expect(wrapper.text()).toContain("comments.saveTemplateFirst");
      expect(wrapper.find("textarea").exists()).toBe(false);
    });

    it("shows the composer when the anchor block is stored", async () => {
      const { wrapper } = await mountSidebar({
        threads: [],
        filterBlockId: "saved-block",
        isBlockSaved: () => true,
      });

      expect(wrapper.text()).not.toContain("comments.saveTemplateFirst");
      expect(wrapper.find("textarea").exists()).toBe(true);
    });
  });

  describe("i18n", () => {
    it("reads its strings from the OSS chunk, not the cloud one", () => {
      // The panel is shared now, so `useCloudI18nStrict` would throw outside a
      // Cloud session. Structural, because a runtime throw is what a consumer
      // would otherwise see.
      const source = String(CommentsSidebar);
      expect(source).not.toContain("useCloudI18nStrict");
    });

    it("renders no hard-coded English", async () => {
      const { wrapper } = await mountSidebar({
        threads: [comment("c-1", { blockId: "blk-1" })],
        canvasBlockIds: ["blk-1"],
        isBlockSaved: () => true,
      });

      // The jump-to-block button was a bare `Block` literal — the one hard-coded
      // string in this component before it moved to the OSS chunk.
      expect(wrapper.text()).toContain("comments.jumpToBlock");
      expect(wrapper.text()).not.toMatch(/\bBlock\b/);
    });
  });
});

describe("CommentsSidebar mutations", () => {
  it("replies on the parent with the parent's block id", async () => {
    const { wrapper, provider } = await mountSidebar({
      threads: [comment("c-1", { blockId: "blk-1" })],
      canvasBlockIds: ["blk-1"],
    });

    await wrapper.get('[data-testid="comment-reply"]').trigger("click");
    await nextTick();

    const reply = wrapper.find(
      'textarea[placeholder="comments.replyPlaceholder"]',
    );
    await reply.setValue("a reply");
    await reply.trigger("keydown", { key: "Enter" });

    expect(provider.create).toHaveBeenCalledWith("tpl-1", {
      body: "a reply",
      blockId: "blk-1",
      parentId: "c-1",
    });
  });

  it("edits on Enter and cancels on Escape", async () => {
    const { wrapper, provider } = await mountSidebar();

    await wrapper.get('[data-testid="comment-edit"]').trigger("click");
    await nextTick();
    const editor = wrapper.findAll("textarea")[0];
    await editor.setValue("revised");
    await editor.trigger("keydown", { key: "Enter" });
    expect(provider.update).toHaveBeenCalledWith("tpl-1", "c-1", {
      body: "revised",
    });

    await wrapper.get('[data-testid="comment-edit"]').trigger("click");
    await nextTick();
    await wrapper.findAll("textarea")[0].setValue("never mind");
    await wrapper.findAll("textarea")[0].trigger("keydown", { key: "Escape" });
    await nextTick();
    // The mock update returns `{ body: "edited" }`; Escape must drop the draft
    // and show the stored body again.
    expect(wrapper.text()).toContain("edited");
    expect(wrapper.text()).not.toContain("never mind");
  });

  it("asks for a second click before deleting, and cancel restores the actions", async () => {
    const { wrapper, provider } = await mountSidebar();

    await wrapper.get('[data-testid="comment-delete"]').trigger("click");
    await nextTick();
    expect(provider.delete).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("comments.deleteConfirm");

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "comments.cancel")!
      .trigger("click");
    await nextTick();
    expect(
      wrapper.find('[data-testid="comment-delete-confirm"]').exists(),
    ).toBe(false);

    await wrapper.get('[data-testid="comment-delete"]').trigger("click");
    await wrapper
      .get('[data-testid="comment-delete-confirm"]')
      .trigger("click");
    expect(provider.delete).toHaveBeenCalledWith("tpl-1", "c-1");
  });

  it("does not throw when a write is rejected", async () => {
    const { wrapper, provider } = await mountSidebar();
    vi.mocked(provider.create).mockRejectedValueOnce(new Error("offline"));

    await wrapper.find('[data-testid="comments-input"]').setValue("note");
    await wrapper.get('[data-testid="comments-send"]').trigger("click");
    await nextTick();

    expect(wrapper.find('[data-testid="comments-input"]').exists()).toBe(true);
  });

  it("marks a comment whose block is gone, and jumps when it is still on the canvas", async () => {
    const missing = await mountSidebar({
      threads: [comment("c-1", { blockId: "gone" })],
      canvasBlockIds: [],
    });
    expect(missing.wrapper.text()).toContain("comments.missingBlock");

    const { wrapper, editor } = await mountSidebar({
      threads: [comment("c-1", { blockId: "blk-1" })],
      canvasBlockIds: ["blk-1"],
    });
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "comments.jumpToBlock")!
      .trigger("click");
    expect(editor.selectBlock).toHaveBeenCalledWith("blk-1");
  });

  it("follows the selected block while the block filter is on", async () => {
    const { wrapper, feature, editor } = await mountSidebar({
      threads: [
        comment("c-1", { blockId: "blk-1", body: "one" }),
        comment("c-2", { blockId: "blk-2", body: "two" }),
      ],
      canvasBlockIds: ["blk-1", "blk-2"],
      filterBlockId: "blk-1",
    });
    expect(wrapper.text()).toContain("one");
    expect(wrapper.text()).not.toContain("two");

    editor.state.selectedBlockId = "blk-2";
    await nextTick();
    expect(feature.filterBlockId.value).toBe("blk-2");
    expect(wrapper.text()).toContain("two");
    expect(wrapper.text()).not.toContain("one");
  });

  it("expands a thread to show its replies", async () => {
    const { wrapper } = await mountSidebar({
      threads: [
        comment("c-1", {
          replies: [comment("r-1", { parentId: "c-1", body: "nested" })],
        }),
      ],
    });
    expect(wrapper.text()).not.toContain("nested");
    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("comments.replyOne"))!
      .trigger("click");
    await nextTick();
    expect(wrapper.text()).toContain("nested");
  });

  it("shows the first-load spinner and the empty copy for each filter", async () => {
    const loading = await mountSidebar({ threads: [] });
    loading.feature.headless.isLoading.value = true;
    await nextTick();
    expect(loading.wrapper.find(".tpl-spinner").exists()).toBe(true);

    const empty = await mountSidebar({ threads: [] });
    expect(empty.wrapper.text()).toContain("comments.noComments");
    await empty.wrapper
      .get('[data-testid="comments-filter-all"]')
      .trigger("click");
    await nextTick();
    expect(empty.wrapper.text()).toContain("comments.noCommentsHint");
  });

  it("anchors a new comment to the block filter", async () => {
    const { wrapper, provider } = await mountSidebar({
      threads: [],
      filterBlockId: "blk-1",
      canvasBlockIds: ["blk-1"],
      isBlockSaved: () => true,
    });
    await wrapper.find('[data-testid="comments-input"]').setValue("on this");
    await wrapper.get('[data-testid="comments-send"]').trigger("click");
    expect(provider.create).toHaveBeenCalledWith("tpl-1", {
      body: "on this",
      blockId: "blk-1",
    });
  });
});

describe("CommentsSidebar — no user", () => {
  it("is never reached, because the feature reports itself unavailable", () => {
    const provider: CommentsProvider = {
      list: vi.fn(async () => []),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      setResolved: vi.fn(),
    };
    const feature = useCommentsFeature({
      provider,
      editor: { state: reactive({ template: { id: "tpl-1" } }) },
      user: null,
    });

    // `Editor.vue` mounts `CommentsPanel` on `isAvailable`, so this is the gate
    // that keeps the panel — and any anonymous write — from existing at all.
    expect(feature.isAvailable.value).toBe(false);
    expect(computed(() => feature.capability.isAvailable.value).value).toBe(
      false,
    );
  });
});
