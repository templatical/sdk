import { inject, ref, type Ref } from "vue";
import { POPOVER_ROOT_KEY } from "../keys";

/**
 * Returns the editor's shared popover mount ref — the `<div
 * class="tpl-popover-root" />` rendered at the top level of `Editor.vue` /
 * `CloudEditor.vue`. Teleport targets that previously hard-coded
 * `to="body"` (RichTextLinkDialog, TitleEditor toolbar, ParagraphToolbar,
 * TplModal) inject this and teleport to `popoverRoot.value` instead, so
 * popups stay inside the editor's effective DOM root (shadow-aware).
 *
 * Falls back to a never-resolving `ref(null)` when no provider is in scope.
 * Components must guard with `v-if="popoverRoot"` before teleporting —
 * with the fallback, isolated component tests that don't mount the editor
 * shell simply render nothing rather than blow up.
 *
 * Internal — not exported from the package entry.
 */
export function usePopoverRoot(): Ref<HTMLElement | null> {
  return inject(POPOVER_ROOT_KEY, ref<HTMLElement | null>(null));
}
