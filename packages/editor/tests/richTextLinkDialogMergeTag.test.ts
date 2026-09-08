// @vitest-environment happy-dom
import "./dom-stubs";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ref } from "vue";
import type { MergeTag } from "@templatical/types";
import RichTextLinkDialog from "../src/components/blocks/RichTextLinkDialog.vue";
import { MERGE_TAGS_KEY, POPOVER_ROOT_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

const TAGS: MergeTag[] = [
  { label: "Event Link", value: "{{event_link}}" },
  { label: "First Name", value: "{{first_name}}" },
];

let popoverRootEl: HTMLElement;

beforeEach(() => {
  popoverRootEl = document.createElement("div");
  popoverRootEl.className = "tpl-popover-root";
  document.body.appendChild(popoverRootEl);
});

afterEach(() => {
  popoverRootEl.remove();
  document.body.innerHTML = "";
});

function mountDialog(
  props: Partial<{
    visible: boolean;
    isEditingLink: boolean;
    linkUrl: string;
  }> = {},
  provides: Record<symbol, unknown> = {},
) {
  return mountEditor(RichTextLinkDialog as any, {
    props: {
      visible: props.visible ?? true,
      isEditingLink: props.isEditingLink ?? false,
      linkUrl: props.linkUrl ?? "",
      linkColor: "",
      dialogRef: null,
    },
    provides: { [POPOVER_ROOT_KEY]: ref(popoverRootEl), ...provides },
    attachTo: document.body,
  });
}

function popup(): HTMLElement | null {
  return document.querySelector('[data-testid="merge-tag-suggestion-popup"]');
}

function buttonLabels(): (string | null)[] {
  return Array.from(popoverRootEl.querySelectorAll("button")).map((b) =>
    b.getAttribute("aria-label"),
  );
}

describe("RichTextLinkDialog merge tags", () => {
  // The URL field was the only one in the editor with no merge-tag
  // affordance; every other one (button, image, video, menu, social) is a
  // MergeTagInput. A link is the field most often composed from a tag.
  it("offers the merge tag insert button when tags are configured", () => {
    const wrapper = mountDialog({}, { [MERGE_TAGS_KEY]: TAGS });

    expect(buttonLabels()).toContain("mergeTag.insert");

    wrapper.unmount();
  });

  it("offers no merge tag button when no tags are configured", () => {
    const wrapper = mountDialog({}, { [MERGE_TAGS_KEY]: [] });

    expect(buttonLabels()).not.toContain("mergeTag.insert");

    wrapper.unmount();
  });

  it("still submits on Enter", () => {
    const wrapper = mountDialog(
      { linkUrl: "https://example.com" },
      { [MERGE_TAGS_KEY]: TAGS },
    );

    const input = popoverRootEl.querySelector("input") as HTMLInputElement;
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(wrapper.emitted("keydown")).toHaveLength(1);

    wrapper.unmount();
  });

  // Enter is how the autocomplete popup picks a tag. Forwarding that same
  // press to the dialog would submit the link on the keystroke that was
  // choosing its URL.
  it("does not submit on the Enter that picks a tag from the popup", async () => {
    const wrapper = mountDialog({}, { [MERGE_TAGS_KEY]: TAGS });

    const input = popoverRootEl.querySelector("input") as HTMLInputElement;
    input.value = "{{eve";
    input.setSelectionRange(5, 5);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(popup()).not.toBeNull();

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(wrapper.emitted("keydown")).toBeUndefined();

    wrapper.unmount();
  });
});
