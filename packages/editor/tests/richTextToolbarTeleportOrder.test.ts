// @vitest-environment happy-dom
import "./dom-stubs";

import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick, ref, type Ref } from "vue";
import type { Editor } from "@tiptap/core";
import { createTitleBlock } from "@templatical/types";
import ParagraphToolbar from "../src/components/blocks/ParagraphToolbar.vue";
import RichTextLinkDialog from "../src/components/blocks/RichTextLinkDialog.vue";
import TitleEditor from "../src/components/blocks/TitleEditor.vue";
import {
  LOGIC_TAG_PICKER_KEY,
  MERGE_TAG_PICKER_KEY,
  POPOVER_ROOT_KEY,
} from "../src/keys";
import { mountEditor } from "./helpers/mount";

// Residents of `.tpl-popover-root` are z-index auto, so they paint in
// Teleport-anchor order. Re-mounting a toolbar Teleport appends a new anchor
// after the link dialog's.

function stubEditor(): Editor {
  const chain: Record<string, () => unknown> = new Proxy(
    {},
    { get: () => () => chain },
  );
  return {
    isActive: () => false,
    getAttributes: () => ({}),
    chain: () => chain,
  } as unknown as Editor;
}

function mountSurface(
  kind: "paragraph" | "title",
  pickerKey: typeof MERGE_TAG_PICKER_KEY | typeof LOGIC_TAG_PICKER_KEY,
) {
  const isOpen = ref(false);
  const popover = document.createElement("div");
  document.body.appendChild(popover);
  const linkUrl = ref("");
  const linkColor = ref("");
  const dialogRef = ref<HTMLElement | null>(null);
  const block = createTitleBlock({ content: "<p>Hello</p>" });
  const editor = stubEditor();

  const wrapper = mountEditor(
    defineComponent({
      setup() {
        return () =>
          h("div", [
            kind === "paragraph"
              ? h(ParagraphToolbar, {
                  editor,
                  toolbarPosition: { top: 12, left: 12 },
                  isLoading: false,
                  canRequestMergeTag: false,
                  canInsertLogicTag: false,
                })
              : h(TitleEditor, {
                  block,
                  toolbarPosition: { top: 12, left: 12 },
                }),
            h(RichTextLinkDialog, {
              visible: true,
              isEditingLink: false,
              linkUrl: linkUrl.value,
              "onUpdate:linkUrl": (value: string) => {
                linkUrl.value = value;
              },
              linkColor: linkColor.value,
              "onUpdate:linkColor": (value: string) => {
                linkColor.value = value;
              },
              dialogRef: dialogRef.value,
              "onUpdate:dialogRef": (value: HTMLElement | null) => {
                dialogRef.value = value;
              },
            }),
          ]);
      },
    }),
    {
      attachTo: document.body,
      provides: {
        [POPOVER_ROOT_KEY]: ref(popover),
        [pickerKey]: { isOpen },
      },
      global: {
        stubs: {
          ColorPicker: true,
          EmojiPickerDropdown: true,
          MergeTagInput: true,
        },
      },
    },
  );

  return { wrapper, popover, isOpen };
}

const mounted: Array<{
  wrapper: { unmount: () => void };
  popover: HTMLElement;
}> = [];

afterEach(() => {
  for (const surface of mounted) {
    surface.wrapper.unmount();
    surface.popover.remove();
  }
  mounted.length = 0;
});

function toolbarOf(popover: HTMLElement): HTMLElement | null {
  return popover.querySelector<HTMLElement>('[role="toolbar"]');
}

function overlayOf(popover: HTMLElement): HTMLElement | null {
  return popover.querySelector<HTMLElement>(".tpl-link-dialog");
}

async function cyclePicker(isOpen: Ref<boolean>, popover: HTMLElement) {
  const overlay = overlayOf(popover);
  expect(overlay?.getAttribute("class")).toContain("tpl-link-dialog");
  expect(toolbarOf(popover)?.getAttribute("role")).toBe("toolbar");

  isOpen.value = true;
  await nextTick();

  expect(toolbarOf(popover)).toBeNull();
  expect(overlayOf(popover)).toBe(overlay);

  isOpen.value = false;
  await nextTick();

  const toolbar = toolbarOf(popover);
  expect(toolbar?.getAttribute("role")).toBe("toolbar");
  // DOCUMENT_POSITION_FOLLOWING: the toolbar node precedes the dialog overlay.
  expect(toolbar!.compareDocumentPosition(overlay!)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

describe("rich text toolbar teleport order", () => {
  it("keeps the paragraph toolbar before the link dialog after the merge tag picker closes", async () => {
    const surface = mountSurface("paragraph", MERGE_TAG_PICKER_KEY);
    mounted.push(surface);
    await nextTick();
    await cyclePicker(surface.isOpen, surface.popover);
  });

  it("keeps the paragraph toolbar before the link dialog after the logic tag picker closes", async () => {
    const surface = mountSurface("paragraph", LOGIC_TAG_PICKER_KEY);
    mounted.push(surface);
    await nextTick();
    await cyclePicker(surface.isOpen, surface.popover);
  });

  it("keeps the title toolbar before the link dialog after the merge tag picker closes", async () => {
    const surface = mountSurface("title", MERGE_TAG_PICKER_KEY);
    mounted.push(surface);
    await nextTick();
    await cyclePicker(surface.isOpen, surface.popover);
  });
});
