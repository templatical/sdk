// @vitest-environment happy-dom
//
// `editor.setMergeTags()` — replacing the configured tags after `init()`.
//
// The point is that a replacement REPAINTS: everything that renders a tag
// reads one ref, so the canvas, the sidebar fields and the built-in picker
// move together. Issue #737.

import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, shallowRef, createApp } from "vue";
import type { MergeTag } from "@templatical/types";
import {
  SYNTAX_PRESETS,
  createDefaultTemplateContent,
  createParagraphBlock,
} from "@templatical/types";
import MergeTagNodeView from "../src/extensions/MergeTagNodeView.vue";
import { useMergeTag } from "../src/composables/useMergeTag";
import { useMergeTagField } from "../src/composables/useMergeTagField";
import { mount } from "@vue/test-utils";
import Editor from "../src/Editor.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";
import { logger } from "../src/utils/logger";
import { mountEditor } from "./helpers/mount";
import en from "../src/i18n/locales/en";
import {
  MERGE_TAGS_KEY,
  MERGE_TAG_PICKER_KEY,
  MERGE_TAG_SYNTAX_KEY,
  ON_REQUEST_MERGE_TAG_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";

const TOKEN = "{{first_name}}";
const BEFORE: MergeTag = { label: "First Name", value: TOKEN };
const AFTER: MergeTag = { label: "Given Name", value: TOKEN };

function withProvide<T>(setup: () => T, provides: Record<symbol, unknown>): T {
  let result!: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => h("div");
      },
    }),
  );
  for (const sym of Object.getOwnPropertySymbols(provides)) {
    app.provide(sym as never, provides[sym]);
  }
  app.mount(document.createElement("div"));
  return result;
}

/**
 * Mounts the real `Editor.vue` with a real config. The chain this crosses is
 * the whole point: instance method -> `defineExpose` -> `useEditorCore`'s ref
 * -> every component reading it. A test that provides the injection key
 * directly proves none of it — dropping the `defineExpose` line alone would
 * make the public method a silent no-op with the rest of the suite green.
 */
async function mountRealEditor(tags: MergeTag[]) {
  const translations = await loadTranslations("en");
  return mount(Editor, {
    props: {
      config: {
        container: document.createElement("div"),
        content: {
          ...createDefaultTemplateContent(),
          // The real factory: a hand-rolled block has no `styles`, and the
          // canvas destructures it.
          blocks: [
            createParagraphBlock({
              content: `<p><span data-merge-tag="${TOKEN}">First Name</span></p>`,
            }),
          ],
        },
        mergeTags: { tags },
      },
      translations,
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
}

describe("setMergeTags", () => {
  describe("reaching the editor through the public method", () => {
    it("is exposed by Editor.vue, and repaints what is on screen", async () => {
      const wrapper = await mountRealEditor([BEFORE]);
      const exposed = wrapper.vm as unknown as {
        setMergeTags?: (tags: MergeTag[]) => void;
      };

      expect(typeof exposed.setMergeTags).toBe("function");
      expect(wrapper.html()).toContain("First Name");

      exposed.setMergeTags!([AFTER]);
      await nextTick();

      expect(wrapper.html()).toContain("Given Name");
      expect(wrapper.html()).not.toContain(">First Name<");
    });

    it("ignores a non-array instead of taking the editor down", async () => {
      const wrapper = await mountRealEditor([BEFORE]);
      const exposed = wrapper.vm as unknown as {
        setMergeTags: (tags: unknown) => void;
      };
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});

      exposed.setMergeTags(undefined);
      await nextTick();

      expect(warn).toHaveBeenCalledOnce();
      // Previous list still in force.
      expect(wrapper.html()).toContain("First Name");
      warn.mockRestore();
    });
  });

  describe("repainting", () => {
    it("relabels a chip already on the canvas", async () => {
      // The case #733 could not fix: the array was not reactive, so a tag
      // renamed after mount kept rendering its old label forever.
      const tags = shallowRef<MergeTag[]>([BEFORE]);
      const wrapper = mountEditor(MergeTagNodeView as never, {
        props: {
          node: { attrs: { label: "First Name", value: TOKEN } },
          deleteNode: vi.fn(),
          updateAttributes: vi.fn(),
        },
        provides: { [TRANSLATIONS_KEY]: en, [MERGE_TAGS_KEY]: tags },
      });

      expect(wrapper.find('[role="button"]').text()).toBe("First Name");

      tags.value = [AFTER];
      await nextTick();

      expect(wrapper.find('[role="button"]').text()).toBe("Given Name");
    });

    it("relabels a tag inside a sidebar field", async () => {
      const tags = shallowRef<MergeTag[]>([BEFORE]);
      const field = withProvide(
        () =>
          useMergeTagField({
            modelValue: () => `Hi ${TOKEN}`,
            emit: vi.fn(),
            elementRef: shallowRef(null) as never,
          }),
        {
          [MERGE_TAGS_KEY]: tags,
          [MERGE_TAG_SYNTAX_KEY]: SYNTAX_PRESETS.liquid,
        },
      );

      expect(field.segments.value[1]).toMatchObject({ label: "First Name" });

      tags.value = [AFTER];

      expect(field.segments.value[1]).toMatchObject({ label: "Given Name" });
    });

    it("drops a tag back to its token when it is removed from the list", () => {
      const tags = shallowRef<MergeTag[]>([BEFORE]);
      const { getMergeTagDisplayLabel } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY]: tags,
      });

      expect(getMergeTagDisplayLabel(TOKEN)).toBe("First Name");

      tags.value = [];

      expect(getMergeTagDisplayLabel(TOKEN)).toBe(TOKEN);
    });
  });

  describe("affordances that were captured once and went stale", () => {
    it("reveals the insert affordance when tags arrive", () => {
      // A plain boolean here left the "Insert merge tag" button hidden for the
      // rest of the session once the list went from empty to populated.
      const tags = shallowRef<MergeTag[]>([]);
      const { canRequestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY]: tags,
      });

      expect(canRequestMergeTag.value).toBe(false);

      tags.value = [BEFORE];

      expect(canRequestMergeTag.value).toBe(true);
    });

    it("hides it again when the list is emptied", () => {
      const tags = shallowRef<MergeTag[]>([BEFORE]);
      const { canRequestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY]: tags,
      });

      expect(canRequestMergeTag.value).toBe(true);

      tags.value = [];

      expect(canRequestMergeTag.value).toBe(false);
    });

    it("keeps the affordance for a consumer chooser regardless of the list", () => {
      const tags = shallowRef<MergeTag[]>([]);
      const { canRequestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY]: tags,
        [ON_REQUEST_MERGE_TAG_KEY]: vi.fn(),
      });

      expect(canRequestMergeTag.value).toBe(true);
    });

    it("offers the replacement list to the built-in picker", async () => {
      const open = vi.fn().mockResolvedValue(null);
      const tags = shallowRef<MergeTag[]>([BEFORE]);
      const { requestMergeTag } = withProvide(() => useMergeTag(), {
        [MERGE_TAGS_KEY]: tags,
        [MERGE_TAG_PICKER_KEY]: { open },
      });

      tags.value = [AFTER];
      await requestMergeTag({ reason: "insert" });

      expect(open).toHaveBeenCalledWith([AFTER], { current: undefined });
    });
  });
});
