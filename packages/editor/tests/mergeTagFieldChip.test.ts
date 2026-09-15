import { shallowRef } from "vue";
// @vitest-environment happy-dom
//
// The merge-tag chip inside a sidebar field (`MergeTagSegments`, rendered by
// both MergeTagInput and MergeTagTextarea, so this covers every toolbar field,
// template settings and the rich-text link dialog).
//
// A chip is a button that re-picks the tag; the surrounding text still opens
// the raw editor. A tag no chooser can resolve stays a plain span so the click
// falls through to that editor — a disabled button would swallow it instead.
//
// Issue #733.

import { describe, expect, it, vi } from "vitest";
import type { MergeTag } from "@templatical/types";
import MergeTagSegments from "../src/components/MergeTagSegments.vue";
import type { MergeTagSegment } from "../src/composables/useMergeTagField";
import { mountEditor } from "./helpers/mount";
import en from "../src/i18n/locales/en";
import {
  MERGE_TAGS_KEY,
  MERGE_TAG_SHOW_RAW_VALUE_KEY,
  ON_REQUEST_MERGE_TAG_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";

const NAME: MergeTag = { label: "Name", value: "{{name}}" };
const EMAIL: MergeTag = { label: "Email", value: "{{email}}" };

const SEGMENTS: MergeTagSegment[] = [
  { type: "text", value: "Hi " },
  { type: "mergeTag", value: "{{name}}", label: "Name" },
  { type: "text", value: ", " },
  { type: "logicMergeTag", value: "{% if vip %}", keyword: "IF" },
  { type: "mergeTag", value: "{{legacy}}", label: "{{legacy}}" },
];

function mountSegments(
  options: {
    segments?: MergeTagSegment[];
    tags?: MergeTag[];
    onRequest?: () => Promise<MergeTag | null>;
    showRawValue?: boolean;
  } = {},
) {
  return mountEditor(MergeTagSegments as never, {
    props: {
      segments: options.segments ?? SEGMENTS,
      displayClass: "field",
    },
    provides: {
      [TRANSLATIONS_KEY]: en,
      [MERGE_TAGS_KEY]: shallowRef(options.tags ?? [NAME, EMAIL]),
      [ON_REQUEST_MERGE_TAG_KEY]: options.onRequest ?? null,
      [MERGE_TAG_SHOW_RAW_VALUE_KEY]: options.showRawValue ?? true,
    },
  });
}

const chips = (w: ReturnType<typeof mountSegments>) =>
  w.findAll('[data-testid="merge-tag-field-chip"]');

describe("merge tag chips in a field", () => {
  describe("repick", () => {
    it("emits the segment index of the clicked tag", async () => {
      const wrapper = mountSegments();

      expect(chips(wrapper)).toHaveLength(1);
      await chips(wrapper)[0].trigger("click");

      expect(wrapper.emitted("repick")).toEqual([[1]]);
    });

    it("does not also open the raw editor", async () => {
      const wrapper = mountSegments();

      await chips(wrapper)[0].trigger("click");

      expect(wrapper.emitted("edit")).toBeUndefined();
    });

    it("clicking the surrounding field still opens the raw editor", async () => {
      const wrapper = mountSegments();

      await wrapper.find('[role="group"]').trigger("click");

      expect(wrapper.emitted("edit")).toHaveLength(1);
      expect(wrapper.emitted("repick")).toBeUndefined();
    });

    it("renders an unresolvable tag as a plain span, not a disabled button", () => {
      const wrapper = mountSegments();

      // {{legacy}} is in the segments but not in `tags`, and no onRequest is
      // configured — so there is nothing to pick from.
      expect(chips(wrapper)).toHaveLength(1);
      expect(wrapper.html()).toContain("{{legacy}}");
      expect(wrapper.findAll("button[disabled]")).toHaveLength(0);
    });

    it("makes every tag re-pickable once a consumer chooser exists", () => {
      const wrapper = mountSegments({ onRequest: vi.fn(), tags: [] });

      // Both merge tags, including the one no configured tag resolves.
      expect(chips(wrapper)).toHaveLength(2);
    });

    it("never turns a logic tag into a button", () => {
      const wrapper = mountSegments({ onRequest: vi.fn() });

      const labels = chips(wrapper).map((c) => c.text());
      expect(labels).toEqual(["Name", "{{legacy}}"]);
    });

    it("names the tag it changes", () => {
      const wrapper = mountSegments();

      expect(chips(wrapper)[0].attributes("aria-label")).toBe(
        "Change merge tag: Name",
      );
    });
  });

  // #738: the field holds its own controls, so the wrapper cannot be a button —
  // ARIA forbids focusable descendants inside one, and the tab order reads as
  // if you stepped into the element you just landed on.
  describe("the field is a group, not a button", () => {
    it("exposes the wrapper as a named group", () => {
      const wrapper = mountSegments();
      const group = wrapper.find('[role="group"]');

      expect(group.exists()).toBe(true);
      expect(group.attributes("aria-label")).toBe("Value with merge tags");
    });

    it("is not itself a control", () => {
      const wrapper = mountSegments();
      const group = wrapper.find('[role="group"]');

      expect(wrapper.find('[role="button"]').exists()).toBe(false);
      // No tabindex either: a focusable group would put a stop in the tab
      // order that does nothing a child button does not already do.
      expect(group.attributes("tabindex")).toBeUndefined();
    });

    it("puts every control at the same level, none nested in another", () => {
      const wrapper = mountSegments({ onRequest: vi.fn() });
      const group = wrapper.find('[role="group"]');

      const buttons = group.findAll("button");
      expect(buttons.length).toBeGreaterThan(0);
      for (const button of buttons) {
        expect(button.find("button").exists()).toBe(false);
      }
    });

    it("gives raw editing an explicit, keyboard-reachable control", async () => {
      // The wrapper's own click is mouse-only convenience; without this button
      // there is no keyboard route to raw editing at all.
      const wrapper = mountSegments();
      const edit = wrapper.find('[data-testid="merge-tag-field-edit"]');

      expect(edit.exists()).toBe(true);
      expect(edit.attributes("aria-label")).toBe("Edit as text");

      await edit.trigger("click");
      expect(wrapper.emitted("edit")).toHaveLength(1);
    });

    it("does not double-fire when the Edit button is clicked", async () => {
      const wrapper = mountSegments();

      await wrapper.find('[data-testid="merge-tag-field-edit"]').trigger("click");

      expect(wrapper.emitted("edit")).toHaveLength(1);
    });

    it("keeps Clear working and distinct from Edit", async () => {
      const wrapper = mountSegments();

      await wrapper.find('[data-testid="merge-tag-field-clear"]').trigger("click");

      expect(wrapper.emitted("clear")).toHaveLength(1);
      expect(wrapper.emitted("edit")).toBeUndefined();
    });

    it("names every control it contains", () => {
      const wrapper = mountSegments({ onRequest: vi.fn() });

      for (const button of wrapper.findAll("button")) {
        expect(button.attributes("aria-label")).toBeTruthy();
      }
    });
  });

  describe("showRawValue", () => {
    it("exposes the token in the tooltip by default", () => {
      const wrapper = mountSegments();

      expect(chips(wrapper)[0].attributes("data-tooltip")).toBe("{{name}}");
      expect(chips(wrapper)[0].classes()).toContain("tpl-tooltip");
    });

    it("drops the attribute AND the class when disabled", () => {
      const wrapper = mountSegments({ showRawValue: false });

      expect(chips(wrapper)[0].attributes("data-tooltip")).toBeUndefined();
      expect(chips(wrapper)[0].classes()).not.toContain("tpl-tooltip");
    });

    it("covers a tag that is not re-pickable too", () => {
      const wrapper = mountSegments({ showRawValue: false });

      // The {{legacy}} span — the fallback branch, which is easy to miss.
      const html = wrapper.html();
      expect(html).not.toContain('data-tooltip="{{legacy}}"');
    });

    it("leaves the logic-tag tooltip alone", () => {
      // A logic badge shows only its keyword, so the tooltip is the only place
      // the condition itself is readable.
      const wrapper = mountSegments({ showRawValue: false });

      expect(wrapper.html()).toContain('data-tooltip="{% if vip %}"');
    });
  });
});
