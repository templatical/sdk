// @vitest-environment happy-dom
//
// The merge-tag chip on the canvas. Two guarantees live here:
//
//  1. Activating a chip opens the tag chooser wherever one can resolve the
//     token, so the raw token is neither shown nor editable as free text.
//  2. The surviving raw path — the only route left for a token no chooser
//     knows — can never commit something that is not a merge tag. `renderHTML`
//     writes `value` straight into `data-merge-tag` and the renderer drops that
//     into the MJML verbatim, so an unvalidated commit ships literal text in
//     the sent email.
//
// Issue #733.

import { describe, expect, it, vi } from "vitest";
import type { MergeTag } from "@templatical/types";
import { shallowRef, nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import MergeTagNodeView from "../src/extensions/MergeTagNodeView.vue";
import { mountEditor } from "./helpers/mount";
import en from "../src/i18n/locales/en";
import {
  MERGE_TAGS_KEY,
  MERGE_TAG_PICKER_KEY,
  MERGE_TAG_SHOW_RAW_VALUE_KEY,
  ON_REQUEST_MERGE_TAG_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";

// An opaque backend identifier — the shape issue #733 was reported against.
const TOKEN = "{{8f14e45f-ceea-467a-9e1f-2c0b4b0f7b21}}";
const OTHER_TOKEN = "{{c9f0f895-fb98-4b41-b9a4-9d0f6a1e9f77}}";

const FIRST_NAME: MergeTag = { label: "First Name", value: TOKEN };
const LAST_NAME: MergeTag = { label: "Last Name", value: OTHER_TOKEN };

function mountChip(options: {
  value?: string;
  tags?: MergeTag[];
  onRequest?: (context?: unknown) => Promise<MergeTag | null>;
  picker?: { open: ReturnType<typeof vi.fn>; [k: string]: unknown };
  showRawValue?: boolean;
  updateAttributes?: ReturnType<typeof vi.fn>;
} = {}) {
  const updateAttributes = options.updateAttributes ?? vi.fn();
  const wrapper = mountEditor(MergeTagNodeView as never, {
    props: {
      node: { attrs: { label: "First Name", value: options.value ?? TOKEN } },
      deleteNode: vi.fn(),
      updateAttributes,
    },
    provides: {
      [TRANSLATIONS_KEY]: en,
      [MERGE_TAGS_KEY]: shallowRef(options.tags ?? [FIRST_NAME, LAST_NAME]),
      [ON_REQUEST_MERGE_TAG_KEY]: options.onRequest ?? null,
      [MERGE_TAG_PICKER_KEY]: options.picker ?? null,
      [MERGE_TAG_SHOW_RAW_VALUE_KEY]: options.showRawValue ?? true,
    },
  });
  return { wrapper, updateAttributes, caption: () => wrapper.find('[role="button"]') };
}

describe("MergeTagNodeView", () => {
  describe("which route activating a chip takes", () => {
    it("calls the consumer's chooser with the resolved tag", async () => {
      const onRequest = vi.fn().mockResolvedValue(LAST_NAME);
      const { caption, updateAttributes, wrapper } = mountChip({ onRequest });

      await caption().trigger("click");
      await nextTick();

      expect(wrapper.find("input").exists()).toBe(false);
      expect(onRequest).toHaveBeenCalledTimes(1);
      expect(onRequest).toHaveBeenCalledWith({
        reason: "edit",
        current: FIRST_NAME,
      });
      expect(updateAttributes).toHaveBeenCalledWith({
        value: OTHER_TOKEN,
        label: "Last Name",
      });
    });

    it("opens the consumer's chooser for an unknown token, with no current tag", async () => {
      // The trap this guards: a consumer who drives insertion entirely through
      // `onRequest` and leaves `tags` empty. Gating on "is the token known"
      // would drop every chip back to raw editing for them.
      const onRequest = vi.fn().mockResolvedValue(LAST_NAME);
      const { caption, wrapper } = mountChip({ onRequest, tags: [] });

      await caption().trigger("click");
      await nextTick();

      expect(wrapper.find("input").exists()).toBe(false);
      expect(onRequest).toHaveBeenCalledWith({ reason: "edit" });
    });

    it("opens the built-in picker with the current tag preselected", async () => {
      const open = vi.fn().mockResolvedValue(LAST_NAME);
      const { caption, updateAttributes, wrapper } = mountChip({
        picker: { open },
      });

      await caption().trigger("click");
      await nextTick();

      expect(wrapper.find("input").exists()).toBe(false);
      expect(open).toHaveBeenCalledWith([FIRST_NAME, LAST_NAME], {
        current: FIRST_NAME,
      });
      expect(updateAttributes).toHaveBeenCalledWith({
        value: OTHER_TOKEN,
        label: "Last Name",
      });
    });

    it("falls back to the raw input when no chooser can resolve the token", async () => {
      const open = vi.fn();
      const { caption, wrapper } = mountChip({
        value: "{{legacy_token}}",
        picker: { open },
      });

      await caption().trigger("click");
      await nextTick();

      expect(open).not.toHaveBeenCalled();
      const input = wrapper.find("input");
      expect(input.exists()).toBe(true);
      expect((input.element as HTMLInputElement).value).toBe("{{legacy_token}}");
    });

    it("falls back to the raw input when nothing is configured at all", async () => {
      const { caption, wrapper } = mountChip({ tags: [] });

      await caption().trigger("click");
      await nextTick();

      expect(wrapper.find("input").exists()).toBe(true);
    });

    it("leaves the node untouched when the chooser is cancelled", async () => {
      const onRequest = vi.fn().mockResolvedValue(null);
      const { caption, updateAttributes } = mountChip({ onRequest });

      await caption().trigger("click");
      await nextTick();

      expect(onRequest).toHaveBeenCalledTimes(1);
      expect(updateAttributes).not.toHaveBeenCalled();
    });

    it("is reachable from the keyboard", async () => {
      const onRequest = vi.fn().mockResolvedValue(LAST_NAME);
      const { caption } = mountChip({ onRequest });

      await caption().trigger("keydown.enter");
      await nextTick();

      expect(onRequest).toHaveBeenCalledTimes(1);
    });

    // #737's scenario end to end: the consumer's picker returns a tag it just
    // minted, which is in no `tags` array. The chip must show the label the
    // author chose, not the identifier behind it.
    it("shows a minted tag's label after the pick, not its token", async () => {
      const minted = { label: "Loyalty Tier", value: "{{c9f0f895-2222}}" };
      const attrs = { label: "First Name", value: TOKEN };
      const updateAttributes = vi.fn((patch: Record<string, unknown>) => {
        Object.assign(attrs, patch);
      });
      const wrapper = mountEditor(MergeTagNodeView as never, {
        props: { node: { attrs }, deleteNode: vi.fn(), updateAttributes },
        provides: {
          [TRANSLATIONS_KEY]: en,
          [MERGE_TAGS_KEY]: shallowRef([FIRST_NAME]),
          [ON_REQUEST_MERGE_TAG_KEY]: vi.fn().mockResolvedValue(minted),
        },
      });

      await wrapper.find('[role="button"]').trigger("click");
      await flushPromises();
      // TipTap re-renders the node view with the written attrs.
      await wrapper.setProps({ node: { attrs: { ...attrs } } });

      expect(updateAttributes).toHaveBeenCalledWith({
        value: minted.value,
        label: minted.label,
      });
      expect(wrapper.find('[role="button"]').text()).toBe("Loyalty Tier");
    });

    it("does not write attributes onto a node view that was torn down mid-pick", async () => {
      // The chooser mounts outside this node view, so the block can finish
      // editing while it is open.
      let resolvePick: (tag: MergeTag | null) => void = () => {};
      const onRequest = vi.fn(
        () => new Promise<MergeTag | null>((r) => (resolvePick = r)),
      );
      const { caption, updateAttributes, wrapper } = mountChip({ onRequest });

      await caption().trigger("click");
      expect(onRequest).toHaveBeenCalledTimes(1);

      wrapper.unmount();
      resolvePick(LAST_NAME);
      // Drain the whole await chain (onRequest -> requestMergeTag -> repick),
      // not one nextTick: a single tick resolves before the write would have
      // happened, so the assertion passes with the guard deleted.
      await flushPromises();

      expect(updateAttributes).not.toHaveBeenCalled();
    });
  });

  describe("the raw path never commits a non-tag value", () => {
    async function openRawEditor() {
      const ctx = mountChip({ value: "{{legacy_token}}", tags: [] });
      await ctx.caption().trigger("click");
      await nextTick();
      return ctx;
    }

    it("discards free text that is not a merge tag", async () => {
      const { wrapper, updateAttributes } = await openRawEditor();

      await wrapper.find("input").setValue("hello");
      await wrapper.find("input").trigger("blur");

      expect(updateAttributes).not.toHaveBeenCalled();
    });

    it("keeps the input open when Enter is pressed on an invalid value", async () => {
      const { wrapper, updateAttributes } = await openRawEditor();

      await wrapper.find("input").setValue("hello");
      await wrapper.find("input").trigger("keydown", { key: "Enter" });

      expect(updateAttributes).not.toHaveBeenCalled();
      expect(wrapper.find("input").exists()).toBe(true);
      expect(wrapper.find("input").attributes("aria-invalid")).toBe("true");
    });

    it("commits a value that is a merge tag", async () => {
      const { wrapper, updateAttributes } = await openRawEditor();

      await wrapper.find("input").setValue("{{repaired_token}}");
      await wrapper.find("input").trigger("keydown", { key: "Enter" });

      expect(updateAttributes).toHaveBeenCalledWith({
        value: "{{repaired_token}}",
        label: "{{repaired_token}}",
      });
      expect(wrapper.find("input").exists()).toBe(false);
    });

    it("marks the input valid while it holds a real tag", async () => {
      const { wrapper } = await openRawEditor();

      await wrapper.find("input").setValue("{{ok}}");

      expect(wrapper.find("input").attributes("aria-invalid")).toBeUndefined();
    });
  });

  describe("showRawValue", () => {
    it("exposes the token in the tooltip by default", () => {
      const { caption } = mountChip();

      expect(caption().attributes("data-tooltip")).toBe(TOKEN);
      expect(caption().classes()).toContain("tpl-tooltip");
    });

    it("drops the attribute AND the class when disabled", () => {
      // The class alone still renders an empty bubble on hover, because the
      // CSS is `content: attr(data-tooltip)`.
      const { caption } = mountChip({ showRawValue: false });

      expect(caption().attributes("data-tooltip")).toBeUndefined();
      expect(caption().classes()).not.toContain("tpl-tooltip");
    });

    it("never hides the label itself", () => {
      const { caption } = mountChip({ showRawValue: false });

      expect(caption().text()).toBe("First Name");
    });

    // The gap `showRawValue` was added to close, on the surface that matters
    // most: a token the consumer has not declared rendered as its own caption,
    // so hiding the tooltip hid nothing.
    describe("an undeclared token", () => {
      function mountUndeclared(showRawValue: boolean, label = "First Name") {
        return mountEditor(MergeTagNodeView as never, {
          props: {
            node: { attrs: { label, value: TOKEN } },
            deleteNode: vi.fn(),
            updateAttributes: vi.fn(),
          },
          provides: {
            [TRANSLATIONS_KEY]: en,
            [MERGE_TAGS_KEY]: shallowRef([]),
            [ON_REQUEST_MERGE_TAG_KEY]: vi.fn(),
            [MERGE_TAG_SHOW_RAW_VALUE_KEY]: showRawValue,
          },
        }).find('[role="button"]');
      }

      it("renders as itself when its stored label is the token", () => {
        // The shape every tag the editor makes for itself has: the input rule,
        // paste rule and normalization all derive an undeclared tag's stored
        // label from getMergeTagLabel, which returns the token.
        expect(mountUndeclared(true, TOKEN).text()).toBe(TOKEN);
      });

      it("renders as itself with no stored label at all", () => {
        expect(mountUndeclared(true, "").text()).toBe(TOKEN);
      });

      // #737: a picker that mints a tag returns one in no `tags` array, and
      // writes its label onto the node. Reaching for the token first showed a
      // raw identifier the instant the author picked a field.
      it("renders a minted tag's stored label, even with raw tokens shown", () => {
        expect(mountUndeclared(true, "Loyalty Tier").text()).toBe(
          "Loyalty Tier",
        );
      });

      it("renders the stored label when raw tokens are hidden", () => {
        expect(mountUndeclared(false).text()).toBe("First Name");
      });

      it("renders a neutral placeholder with no stored label", () => {
        expect(mountUndeclared(false, "").text()).toBe("Merge tag");
      });

      it("keeps the token out of the accessible name too", () => {
        // The accessible name interpolates the display label, so a raw
        // fallback there would read the identifier aloud.
        const caption = mountUndeclared(false, "");
        expect(caption.attributes("aria-label")).toBe(
          "Change merge tag: Merge tag",
        );
        expect(caption.attributes("aria-label")).not.toContain("8f14e45f");
      });
    });
  });

  describe("accessible name", () => {
    it("announces a re-pick when a chooser is available", () => {
      const { caption } = mountChip({ picker: { open: vi.fn() } });

      expect(caption().attributes("aria-label")).toBe(
        "Change merge tag: First Name",
      );
    });

    it("announces raw editing when none is", () => {
      const { caption } = mountChip({ value: "{{legacy_token}}", tags: [] });

      expect(caption().attributes("aria-label")).toBe("Edit merge tag value");
    });
  });
});
