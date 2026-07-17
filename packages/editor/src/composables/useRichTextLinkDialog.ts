import type { Editor } from "@tiptap/core";
import { ref, type Ref, type ShallowRef } from "vue";
import { useFocusTrap } from "./useFocusTrap";
import { sanitizeLinkColor } from "../utils/linkColorExtension";

export interface UseRichTextLinkDialogReturn {
  showLinkDialog: Ref<boolean>;
  linkUrl: Ref<string>;
  /** Per-link color (inline on the `<a>`); empty = inherit the document link color. */
  linkColor: Ref<string>;
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
  const linkColor = ref("");
  const linkDialogRef = ref<HTMLElement | null>(null);
  useFocusTrap(linkDialogRef, showLinkDialog);

  function openLinkDialog(): void {
    const attrs = editor.value?.getAttributes("link") ?? {};
    linkUrl.value = attrs.href || "";
    linkColor.value = attrs.color || "";
    showLinkDialog.value = true;
  }

  function insertLink(): void {
    if (linkUrl.value) {
      const url = normalizeLinkUrl(linkUrl.value);
      if (url !== null) {
        // Set the link, then stamp its color on the `<a>` itself so text and
        // underline stay in sync. Empty/invalid color → null = inherit the
        // document link color.
        editor.value
          ?.chain()
          .focus()
          .extendMarkRange("link")
          .setLink({ href: url })
          .updateAttributes("link", {
            color: sanitizeLinkColor(linkColor.value),
          })
          .run();
      }
    }
    closeLinkDialog();
  }

  // Allowlist mirroring @tiptap/extension-link defaults so URLs persisted
  // via the dialog can't smuggle in javascript:/data:/vbscript: payloads
  // that bypass TipTap's apply-time filter on JSON load.
  const SAFE_SCHEMES = new Set([
    "http",
    "https",
    "mailto",
    "tel",
    "ftp",
    "ftps",
    "sms",
    "xmpp",
    "cid",
  ]);

  function normalizeLinkUrl(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("#")) return trimmed;
    const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed);
    if (schemeMatch) {
      return SAFE_SCHEMES.has(schemeMatch[1].toLowerCase()) ? trimmed : null;
    }
    return `https://${trimmed}`;
  }

  function removeLink(): void {
    editor.value?.chain().focus().extendMarkRange("link").unsetLink().run();
    closeLinkDialog();
  }

  function closeLinkDialog(): void {
    showLinkDialog.value = false;
    linkUrl.value = "";
    linkColor.value = "";
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
    linkColor,
    linkDialogRef,
    openLinkDialog,
    insertLink,
    removeLink,
    closeLinkDialog,
    handleLinkKeydown,
  };
}
