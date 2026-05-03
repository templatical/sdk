import type { Editor } from "@tiptap/core";
import { ref, type Ref, type ShallowRef } from "vue";
import { useFocusTrap } from "./useFocusTrap";

export interface UseRichTextLinkDialogReturn {
  showLinkDialog: Ref<boolean>;
  linkUrl: Ref<string>;
  linkDialogRef: Ref<HTMLElement | null>;
  openLinkDialog: () => void;
  insertLink: () => void;
  removeLink: () => void;
  closeLinkDialog: () => void;
  handleLinkKeydown: (event: KeyboardEvent) => void;
}

export function useRichTextLinkDialog(
  editor: ShallowRef<Editor | null>,
): UseRichTextLinkDialogReturn {
  const showLinkDialog = ref(false);
  const linkUrl = ref("");
  const linkDialogRef = ref<HTMLElement | null>(null);
  useFocusTrap(linkDialogRef, showLinkDialog);

  function openLinkDialog(): void {
    const previousUrl = editor.value?.getAttributes("link").href || "";
    linkUrl.value = previousUrl;
    showLinkDialog.value = true;
  }

  function insertLink(): void {
    if (linkUrl.value) {
      const url = normalizeLinkUrl(linkUrl.value);
      editor.value
        ?.chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
    closeLinkDialog();
  }

  function normalizeLinkUrl(raw: string): string {
    // Preserve any URL that already declares a scheme (mailto:, tel:, ftp:,
    // http(s):, etc.) and any same-page anchor (#…). Only bare hostnames /
    // paths get the https:// prefix.
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("#")) {
      return raw;
    }
    return `https://${raw}`;
  }

  function removeLink(): void {
    editor.value?.chain().focus().extendMarkRange("link").unsetLink().run();
    closeLinkDialog();
  }

  function closeLinkDialog(): void {
    showLinkDialog.value = false;
    linkUrl.value = "";
  }

  function handleLinkKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      insertLink();
    } else if (event.key === "Escape") {
      closeLinkDialog();
    }
  }

  return {
    showLinkDialog,
    linkUrl,
    linkDialogRef,
    openLinkDialog,
    insertLink,
    removeLink,
    closeLinkDialog,
    handleLinkKeydown,
  };
}
