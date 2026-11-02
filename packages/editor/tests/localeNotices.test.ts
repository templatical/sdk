// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { h, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import {
  CollaborationConflict,
  type CollaborationProvider,
} from "@templatical/types";
import { openLanguages, languageContent } from "./helpers/localization";
import NoticeStack from "../src/components/NoticeStack.vue";
import LocaleNotices from "../src/components/localization/LocaleNotices.vue";
import CollaborationNotices from "../src/components/collaboration/CollaborationNotices.vue";
import type { UseCollaborationFeatureReturn } from "../src/composables/useCollaborationFeature";
import en from "../src/i18n/locales/en";
import { TRANSLATIONS_KEY } from "../src/keys";

async function openPromotion(
  wrapper: Awaited<ReturnType<typeof openLanguages>>["wrapper"],
) {
  await wrapper.get('[data-testid="language-menu"]').trigger("click");
  await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
  await wrapper
    .get('[data-testid="language-make-default-de"]')
    .trigger("click");
}

async function promote(
  wrapper: Awaited<ReturnType<typeof openLanguages>>["wrapper"],
) {
  await openPromotion(wrapper);
  await wrapper
    .get('[data-testid="language-default-confirm"]')
    .trigger("click");
  await vi.dynamicImportSettled();
}

describe("locale notices", () => {
  it("shows the captured dialog count without collaboration and dismisses", async () => {
    const { wrapper } = await openLanguages();
    await promote(wrapper);
    const notice = wrapper.get('[data-testid="locale-notice"]');
    expect(notice.attributes("role")).toBe("status");
    expect(notice.text()).toBe(
      "Deutsch is now the default language. 1 field is still in English.",
    );
    await notice.get("button").trigger("click");
    expect(wrapper.find('[data-testid="locale-notice"]').exists()).toBe(false);
  });

  it("keeps the dialog and notice counts in sync when content changes before confirmation", async () => {
    const { wrapper, editor } = await openLanguages();
    await wrapper.get('[data-testid="language-menu"]').trigger("click");
    await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
    await wrapper
      .get('[data-testid="language-make-default-de"]')
      .trigger("click");
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      "1 field has no Deutsch text",
    );
    editor.content.value.blocks[0].l10n = undefined;
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[role="dialog"]').text()).toContain(
      "2 fields have no Deutsch text",
    );
    await wrapper
      .get('[data-testid="language-default-confirm"]')
      .trigger("click");
    await vi.dynamicImportSettled();
    expect(wrapper.get('[data-testid="locale-notice"]').text()).toBe(
      "Deutsch is now the default language. 2 fields are still in English.",
    );
  });

  it("clears the notice when Undo restores the old default, and Redo doesn't bring it back", async () => {
    const { wrapper, editor, history } = await openLanguages();
    await promote(wrapper);
    expect(wrapper.get('[data-testid="locale-notice"]').text()).toContain(
      "Deutsch is now the default language.",
    );
    history.undo();
    await flushPromises();
    expect(editor.content.value.settings.locale).toBe("en");
    expect(wrapper.find('[data-testid="locale-notice"]').exists()).toBe(false);
    history.redo();
    await flushPromises();
    expect(editor.content.value.settings.locale).toBe("de");
    expect(wrapper.find('[data-testid="locale-notice"]').exists()).toBe(false);
  });

  it("omits the remainder when no fields kept the old default", async () => {
    const content = languageContent();
    content.blocks = [content.blocks[0]];
    const { wrapper } = await openLanguages({ content });
    await promote(wrapper);
    expect(wrapper.get('[data-testid="locale-notice"]').text()).toBe(
      "Deutsch is now the default language.",
    );
  });

  it.each(["B", "A"])(
    "closes a pending promotion when loading %s and ignores its old confirm button",
    async (nextId) => {
      const { wrapper, editor, history } = await openLanguages({
        templates: {
          load: async (id) => ({ id, content: languageContent() }),
          create: false,
          save: false,
        },
      });
      await editor.load("A");
      await openPromotion(wrapper);
      const oldConfirm = wrapper.get(
        '[data-testid="language-default-confirm"]',
      );
      await editor.load(nextId);
      await flushPromises();
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
      const before = JSON.stringify(editor.content.value);
      const undo = history.canUndo.value;
      const redo = history.canRedo.value;
      await oldConfirm.trigger("click");
      expect(editor.state.template?.id).toBe(nextId);
      expect(editor.content.value.settings.locale).toBe("en");
      expect(JSON.stringify(editor.content.value)).toBe(before);
      expect(history.canUndo.value).toBe(undo);
      expect(history.canRedo.value).toBe(redo);
      expect(wrapper.find('[data-testid="locale-notice"]').exists()).toBe(
        false,
      );
    },
  );

  it("keeps outside focus when a template loads with the menu and dialogs closed", async () => {
    const { wrapper, editor } = await openLanguages({
      templates: {
        load: async (id) => ({ id, content: languageContent() }),
        create: false,
        save: false,
      },
    });
    const outside = document.createElement("button");
    document.body.append(wrapper.element, outside);
    outside.focus();
    await editor.load("A");
    await flushPromises();
    expect(document.activeElement).toBe(outside);
  });

  it.each(["B", "A"])(
    "clears the promotion notice when loading %s",
    async (nextId) => {
      const { wrapper, editor } = await openLanguages({
        templates: {
          load: async (id) => ({ id, content: languageContent() }),
          create: false,
          save: false,
        },
      });
      await editor.load("A");
      await promote(wrapper);
      expect(wrapper.get('[data-testid="locale-notice"]').text()).toContain(
        "Deutsch is now the default language.",
      );
      await editor.load(nextId);
      await flushPromises();
      expect(wrapper.find('[data-testid="locale-notice"]').exists()).toBe(
        false,
      );
      expect(editor.content.value.settings.locale).toBe("en");
    },
  );

  it.each(["remove", "translate"])(
    "closes a pending %s confirmation when another template loads",
    async (kind) => {
      const { wrapper, editor } = await openLanguages({
        templates: {
          load: async (id) => ({ id, content: languageContent() }),
          create: false,
          save: false,
        },
        translation: { translate: async () => ({ fields: [] }) },
      });
      await editor.load("A");
      if (kind === "translate") editor.setActiveLocale("de");
      await wrapper.get('[data-testid="language-menu"]').trigger("click");
      if (kind === "remove") {
        await wrapper
          .get('[data-testid="language-actions-de"]')
          .trigger("click");
        await wrapper
          .get('[data-testid="language-remove-de"]')
          .trigger("click");
      } else
        await wrapper
          .get('[data-testid="translate-all-again"]')
          .trigger("click");
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
      await editor.load("B");
      await flushPromises();
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
      expect(editor.content.value.settings.locales).toEqual(["de", "fr"]);
    },
  );

  it("reports a locked collaboration refusal without changing content or history or showing success", async () => {
    const holder = {
      sessionId: "other-session",
      type: "user" as const,
      id: "other-user",
      name: "Grace",
      color: "#123456",
    };
    const lock = {
      blockId: "title",
      holder,
      expiresAt: "2099-01-01T00:00:00.000Z",
    };
    const collaboration: CollaborationProvider = {
      join: vi.fn(async () => ({
        revision: 0,
        locks: [lock],
        members: [],
        leave() {},
      })),
      submit: vi.fn(async () => ({ revision: 1 })),
      operationsAfter: async () => ({ revision: 0, batches: [] }),
      acquireLock: async () => {
        throw new CollaborationConflict("Someone else is editing this block.", {
          code: "lock_held",
          holder,
        });
      },
      renewLock: async () => lock,
      releaseLock: async () => {},
    };
    const { wrapper, editor, history } = await openLanguages({
      user: { id: "ada", name: "Ada" },
      templates: {
        load: async (id) => ({ id, revision: 0, content: languageContent() }),
        create: false,
        save: false,
      },
      collaboration,
    });
    await editor.load("locked");
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="block-lock"]').exists()).toBe(true),
    );
    await openPromotion(wrapper);
    const before = JSON.stringify(editor.content.value);
    const undo = history.canUndo.value;
    const redo = history.canRedo.value;
    await wrapper
      .get('[data-testid="language-default-confirm"]')
      .trigger("click");
    const error = wrapper.get('[role="dialog"] [role="alert"]');
    expect(error.text()).toBe(
      "Couldn't make Deutsch the default language: someone else is editing this template",
    );
    expect(JSON.stringify(editor.content.value)).toBe(before);
    expect(history.canUndo.value).toBe(undo);
    expect(history.canRedo.value).toBe(redo);
    expect(editor.activeLocale.value).toBeNull();
    expect(collaboration.submit).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="locale-notice"]').exists()).toBe(false);
  });

  it("shows the engine's refusal message and clears it after cancelling", async () => {
    const { wrapper, editor, history } = await openLanguages();
    await openPromotion(wrapper);
    editor.removeLocale("de");
    await flushPromises();
    const before = JSON.stringify(editor.content.value);
    const undo = history.canUndo.value;
    const redo = history.canRedo.value;
    await wrapper
      .get('[data-testid="language-default-confirm"]')
      .trigger("click");
    expect(wrapper.get('[role="dialog"] [role="alert"]').text()).toBe(
      `Couldn't make Deutsch the default language: "de" is not a language version of this template.`,
    );
    expect(JSON.stringify(editor.content.value)).toBe(before);
    expect(history.canUndo.value).toBe(undo);
    expect(history.canRedo.value).toBe(redo);
    expect(wrapper.find('[data-testid="locale-notice"]').exists()).toBe(false);
    await wrapper
      .get('[data-testid="language-default-cancel"]')
      .trigger("click");
    await wrapper
      .get('[data-testid="language-menu"]')
      .trigger("keydown", { key: "Escape" });
    editor.addLocale("de");
    await openPromotion(wrapper);
    expect(wrapper.find('[role="dialog"] [role="alert"]').exists()).toBe(false);
  });

  it("places collaboration and locale notices in one flowing stack", () => {
    const feature = {
      notices: ref([{ id: 1, kind: "undoSkipped" }]),
      connection: ref("connected"),
      dismissNotice: vi.fn(),
    } as unknown as UseCollaborationFeatureReturn;
    const wrapper = mount(NoticeStack, {
      slots: {
        default: () => [
          h(CollaborationNotices, { feature }),
          h(LocaleNotices, { notice: { language: "de", old: "en", count: 1 } }),
        ],
      },
      global: { provide: { [TRANSLATIONS_KEY as symbol]: en } },
    });
    try {
      const locale = wrapper.get('[data-testid="locale-notice"]').element;
      const collaboration = wrapper.get(
        '[data-testid="collaboration-notice"]',
      ).element;
      expect(locale.parentElement).toBe(collaboration.parentElement);
      expect(wrapper.classes()).toContain("tpl:absolute");
      expect(wrapper.classes()).toContain("tpl:flex-col");
      expect(wrapper.classes()).toContain("tpl:gap-2");
      expect(collaboration.classList.contains("tpl:absolute")).toBe(false);
      expect(locale.classList.contains("tpl:absolute")).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });
});
