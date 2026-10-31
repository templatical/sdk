// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, describe, expect, it } from "vitest";
import { effectScope, nextTick } from "vue";
import { useEditor } from "@templatical/core";
import {
  applyOperations,
  createDefaultTemplateContent,
  type Comment,
  type CommentsProvider,
} from "@templatical/types";
import CommentsSidebar from "../src/components/CommentsSidebar.vue";
import { useCommentsFeature } from "../src/composables/useCommentsFeature";
import { EDITOR_KEY, LOCALIZATION_KEY, TRANSLATIONS_KEY } from "../src/keys";
import en from "../src/i18n/locales/en";
import { mountEditor } from "./helpers/mount";

const cleanups: (() => void)[] = [];
afterEach(() =>
  cleanups
    .splice(0)
    .reverse()
    .forEach((fn) => fn()),
);
function comment(
  id: string,
  locale?: string | null,
  replies?: Comment[],
): Comment {
  return {
    id,
    body: id,
    locale,
    replies,
    author: { id: "ada", name: "Ada" },
    createdAt: "2026-10-28T10:00:00Z",
  };
}
async function open(
  options: { localization?: boolean; storedLocales?: boolean } = {},
) {
  const localization =
    options.localization === false ? undefined : { locales: ["de", "fr"] };
  const content = createDefaultTemplateContent(undefined, { locale: "en" });
  if (options.storedLocales !== false) content.settings.locales = ["de", "fr"];
  const provider: CommentsProvider = {
    list: async () => [
      comment("English root", "en", [
        comment("German reply", "de"),
        comment("French reply", "fr"),
      ]),
      comment("German root", "de", [comment("English reply", "en")]),
      comment("French only", "fr"),
      comment("Legacy absent"),
      comment("Legacy null", null),
    ],
    create: false,
    update: false,
    delete: false,
    setResolved: false,
  };
  const scope = effectScope();
  const { editor, feature } = scope.run(() => {
    const editor = useEditor({
      content,
      localization,
    });
    const feature = useCommentsFeature({
      provider,
      editor: { state: { template: { id: "template" } } },
      user: { id: "ada", name: "Ada" },
    });
    return { editor, feature };
  })!;
  cleanups.push(() => scope.stop());
  await feature.headless.load();
  function mount() {
    const wrapper = mountEditor(CommentsSidebar, {
      props: { visible: true, feature },
      provides: {
        [EDITOR_KEY]: editor,
        [TRANSLATIONS_KEY]: en,
        [LOCALIZATION_KEY]: localization,
      },
    });
    cleanups.push(() => wrapper.unmount());
    return wrapper;
  }
  return { editor, feature, wrapper: mount(), mount };
}

describe("comment language badges and thread filter", () => {
  it("shows German badges in the English view and badges on every expanded reply", async () => {
    const { wrapper } = await open();
    const german = wrapper
      .findAll('[data-testid="comment-thread"]')
      .find((t) => t.text().includes("German root"))!;
    expect(german.get('[data-testid="comment-locale-badge"]').text()).toBe(
      "Deutsch",
    );
    await german
      .findAll("button")
      .find((b) => b.text().includes("1 Reply"))!
      .trigger("click");
    expect(
      german
        .findAll('[data-testid="comment-locale-badge"]')
        .map((b) => b.text()),
    ).toEqual(["Deutsch", "English"]);
  });

  it("filters whole threads by the root or any reply and retains all messages and badges", async () => {
    const { wrapper, editor } = await open();
    editor.setActiveLocale("de");
    await nextTick();
    const filter = wrapper.get('[data-testid="comments-filter-language"]');
    expect(filter.text()).toBe("This language");
    expect(filter.attributes("aria-pressed")).toBe("false");
    await filter.trigger("click");
    expect(wrapper.findAll('[data-testid="comment-thread"]')).toHaveLength(2);
    expect(wrapper.text()).toContain("English root");
    expect(wrapper.text()).toContain("German root");
    expect(wrapper.text()).not.toContain("French only");
    const threads = wrapper.findAll('[data-testid="comment-thread"]');
    for (const thread of threads)
      await thread
        .findAll("button")
        .find((b) => /repl/i.test(b.text()))!
        .trigger("click");
    expect(wrapper.text()).toContain("French reply");
    expect(wrapper.text()).toContain("English reply");
    expect(
      wrapper
        .findAll('[data-testid="comment-locale-badge"]')
        .map((b) => b.text()),
    ).toEqual(["English", "Deutsch", "Français", "Deutsch", "English"]);
    editor.setActiveLocale("en");
    await nextTick();
    expect(wrapper.findAll('[data-testid="comment-thread"]')).toHaveLength(4);
  });

  it("treats untagged comments as the current default after Make default and never saves the filter", async () => {
    const { wrapper, editor, mount } = await open();
    const before = JSON.stringify(editor.content.value);
    await wrapper
      .get('[data-testid="comments-filter-language"]')
      .trigger("click");
    expect(wrapper.text()).toContain("Legacy absent");
    expect(wrapper.text()).toContain("Legacy null");
    expect(JSON.stringify(editor.content.value)).toBe(before);
    expect(editor.state.isDirty).toBe(false);
    editor.content.value = applyOperations(editor.content.value, [
      { op: "setDefaultLocale", locale: "de" },
    ]);
    await nextTick();
    expect(wrapper.text()).toContain("Legacy absent");
    expect(wrapper.text()).toContain("Legacy null");
    const legacy = wrapper
      .findAll('[data-testid="comment-thread"]')
      .find((t) => t.text().includes("Legacy absent"))!;
    expect(legacy.get('[data-testid="comment-locale-badge"]').text()).toBe(
      "Deutsch",
    );
    editor.setActiveLocale("en");
    await nextTick();
    expect(wrapper.text()).not.toContain("Legacy absent");
    wrapper.unmount();
    const reopened = mount();
    expect(
      reopened
        .get('[data-testid="comments-filter-language"]')
        .attributes("aria-pressed"),
    ).toBe("false");
    expect(reopened.text()).toContain("French only");
  });
});

describe("comments localization opt-in", () => {
  it.each([false, true])(
    "hides badges and the language filter without localization (stored versions: %s)",
    async (storedLocales) => {
      const { wrapper, feature } = await open({
        localization: false,
        storedLocales,
      });
      expect(wrapper.findAll('[data-testid="comment-thread"]')).toHaveLength(5);
      const german = wrapper
        .findAll('[data-testid="comment-thread"]')
        .find((thread) => thread.text().includes("German root"))!;
      await german
        .findAll("button")
        .find((button) => button.text().includes("1 Reply"))!
        .trigger("click");
      expect(german.text()).toContain("English reply");
      expect(
        wrapper.find('[data-testid="comments-filter-language"]').exists(),
      ).toBe(false);
      expect(
        wrapper.findAll('[data-testid="comment-locale-badge"]'),
      ).toHaveLength(0);
      expect(
        feature.headless.comments.value.find(
          (comment) => comment.id === "German root",
        )?.locale,
      ).toBe("de");
    },
  );
});
