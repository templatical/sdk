// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick } from "vue";
import { useEditor } from "@templatical/core";
import {
  createDefaultTemplateContent,
  type Comment,
  type CommentsProvider,
} from "@templatical/types";
import CommentsSidebar from "../src/components/CommentsSidebar.vue";
import { useCommentsFeature } from "../src/composables/useCommentsFeature";
import { EDITOR_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

const cleanups: (() => void)[] = [];
afterEach(() =>
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup()),
);

function open(withoutLocaleState = false) {
  const root: Comment = {
    id: "c-1",
    body: "English thread",
    author: { id: "u-1", name: "Ada" },
    createdAt: "2026-10-28T10:00:00Z",
    blockId: "block-1",
    locale: "en",
  };
  const provider: CommentsProvider = {
    list: async () => [root],
    create: vi.fn(async (_templateId, input) => ({
      ...root,
      ...input,
      id: "c-new",
    })),
    update: false,
    delete: false,
    setResolved: false,
  };
  const content = createDefaultTemplateContent();
  content.settings.locale = "en";
  content.settings.locales = ["de"];
  const scope = effectScope();
  const { editor, feature } = scope.run(() => {
    const editor = useEditor({ content, localization: { locales: ["de"] } });
    const feature = useCommentsFeature({
      provider,
      editor: { state: { template: { id: "tpl-1" } } },
      user: root.author,
    });
    return { editor, feature };
  })!;
  cleanups.push(() => scope.stop());
  const wrapper = mountEditor(CommentsSidebar, {
    props: { visible: true, feature },
    provides: {
      [EDITOR_KEY]: withoutLocaleState
        ? { ...editor, activeLocale: undefined }
        : editor,
    },
  });
  cleanups.push(() => wrapper.unmount());
  return { editor, feature, provider, wrapper };
}

describe("comment creation language", () => {
  it("sends the default tag when the editor has no language-view state", async () => {
    const { provider, wrapper } = open(true);
    await wrapper.get('[data-testid="comments-input"]').setValue("A note");
    await wrapper.get('[data-testid="comments-send"]').trigger("click");
    expect(provider.create).toHaveBeenCalledWith("tpl-1", {
      body: "A note",
      blockId: undefined,
      locale: "en",
    });
  });

  it.each(["en", "de"])("sends %s on a root comment", async (locale) => {
    const { editor, provider, wrapper } = open();
    editor.setActiveLocale(locale);
    await wrapper.get('[data-testid="comments-input"]').setValue("A note");
    await wrapper.get('[data-testid="comments-send"]').trigger("click");
    expect(provider.create).toHaveBeenCalledWith("tpl-1", {
      body: "A note",
      blockId: undefined,
      locale,
    });
  });

  it.each(["en", "de"])(
    "sends the active %s tag on a reply",
    async (locale) => {
      const { editor, feature, provider, wrapper } = open();
      await feature.headless.load();
      editor.setActiveLocale(locale);
      await nextTick();
      await wrapper.get('[data-testid="comment-reply"]').trigger("click");
      const input = wrapper.get(
        'textarea[placeholder="comments.replyPlaceholder"]',
      );
      await input.setValue("A reply");
      await input.trigger("keydown", { key: "Enter" });
      expect(provider.create).toHaveBeenCalledWith("tpl-1", {
        body: "A reply",
        blockId: "block-1",
        parentId: "c-1",
        locale,
      });
    },
  );
});
