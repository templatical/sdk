// @vitest-environment happy-dom
//
// Editor.vue with a version-history provider, with and without a collaboration
// provider: a version previewed on the canvas is not an edit, so nothing is
// sent for it, and cancelling the preview puts the live content back.

import { afterEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createTitleBlock,
  safeClone,
  type CollaborationProvider,
  type Template,
  type TemplateContent,
  type VersionHistoryProvider,
} from "@templatical/types";
import Editor from "../src/Editor.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";

// Each test's editor holds a live controller and window listeners.
enableAutoUnmount(afterEach);

/** The menu and the banner are lazy chunks; CI has taken seconds to load one. */
const LAZY_CHUNK = { timeout: 5000 };

interface ExposedEditor {
  load: (id: string) => Promise<Template>;
  getContent: () => TemplateContent;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await flushPromises();
}

function ids(content: TemplateContent): string[] {
  return content.blocks.map((block) => block.id);
}

async function mountEditor({ collaborate = true } = {}) {
  const title = createTitleBlock({ content: "<p>Live</p>" });
  const live: TemplateContent = {
    ...createDefaultTemplateContent(),
    blocks: [title],
  };
  const older = createParagraphBlock({ content: "<p>Older</p>" });
  const version: TemplateContent = {
    ...createDefaultTemplateContent(),
    blocks: [older],
  };
  const provider: CollaborationProvider = {
    join: vi.fn(async () => ({
      revision: 0,
      locks: [],
      members: [],
      leave: () => {},
    })),
    submit: vi.fn(async () => ({ revision: 1 })),
    operationsAfter: vi.fn(async () => ({ revision: 0, batches: [] })),
  };
  const versionHistory: VersionHistoryProvider = {
    list: vi.fn(async () => ({
      versions: [
        { id: "ver-1", createdAt: "2026-10-19T12:00:00Z", content: version },
      ],
    })),
    get: vi.fn(async () => safeClone(version)),
    create: false,
    restore: false,
  };
  const wrapper = mount(Editor, {
    props: {
      config: {
        container: document.createElement("div"),
        content: live,
        user: { id: "u-1", name: "Ada" },
        templates: {
          load: async (id: string): Promise<Template> => ({
            id,
            revision: 0,
            content: safeClone(live),
          }),
          create: false,
          save: false,
        },
        ...(collaborate ? { collaboration: provider } : {}),
        versionHistory,
      },
      translations: await loadTranslations("en"),
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
  const vm = wrapper.vm as unknown as ExposedEditor;
  await vm.load("tpl-1");
  await flush();
  return { wrapper, vm, provider, title, older };
}

/** Open the history, preview its one version, then cancel; returns the canvas at each step. */
async function previewAndCancel(
  wrapper: Awaited<ReturnType<typeof mountEditor>>["wrapper"],
  vm: ExposedEditor,
): Promise<{ previewing: string[]; after: string[] }> {
  await vi.waitFor(
    () =>
      expect(
        wrapper.find('[data-testid="version-history-toggle"]').exists(),
      ).toBe(true),
    LAZY_CHUNK,
  );
  await wrapper.get('[data-testid="version-history-toggle"]').trigger("click");
  await vi.waitFor(
    () =>
      expect(
        wrapper.find('[data-testid="version-history-entry"]').exists(),
      ).toBe(true),
    LAZY_CHUNK,
  );
  await wrapper.get('[data-testid="version-history-entry"]').trigger("click");
  await flush();
  const previewing = ids(vm.getContent());

  await vi.waitFor(
    () =>
      expect(
        wrapper.find('[data-testid="version-preview-cancel"]').exists(),
      ).toBe(true),
    LAZY_CHUNK,
  );
  await wrapper.get('[data-testid="version-preview-cancel"]').trigger("click");
  await flush();
  return { previewing, after: ids(vm.getContent()) };
}

describe("Editor.vue previewing a version", () => {
  it("with collaboration, sends nothing for the version on the canvas, and puts the live content back on cancel", async () => {
    const { wrapper, vm, provider, title, older } = await mountEditor();

    const canvas = await previewAndCancel(wrapper, vm);

    expect(canvas).toEqual({ previewing: [older.id], after: [title.id] });
    expect(provider.submit).not.toHaveBeenCalled();
  });

  it("without collaboration, previews and cancels the same way", async () => {
    const { wrapper, vm, title, older } = await mountEditor({
      collaborate: false,
    });

    const canvas = await previewAndCancel(wrapper, vm);

    expect(canvas).toEqual({ previewing: [older.id], after: [title.id] });
  });
});
