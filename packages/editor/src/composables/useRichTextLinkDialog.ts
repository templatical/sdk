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
        const color = sanitizeLinkColor(linkColor.value);
        // Set the link, then stamp its color on the `<a>` itself so text and
        // underline stay in sync. Empty/invalid color → null = inherit the
        // document link color.
        const chain = editor.value
          ?.chain()
          .focus()
          .extendMarkRange("link")
          .setLink({ href: url })
          .updateAttributes("link", { color });
        // A per-link color takes absolute priority over any inner text-color:
        // strip the color from any text-style mark on the link range so the
        // `<a>` color alone drives both the glyphs and the underline. Without
        // it, an inner color span keeps painting the text while only the
        // underline (drawn by the `<a>`) picks up the link color — the mismatch
        // this control exists to remove. Guarded on the command existing: Title
        // links share this dialog but register no Color extension.
        if (color && typeof editor.value?.commands.unsetColor === "function") {
          chain?.unsetColor();
        }
        chain?.run();
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
