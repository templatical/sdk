import { useEventListener } from "@vueuse/core";
import { onScopeDispose, watch, type Ref } from "vue";
import { useEditorRoot } from "./useEditorRoot";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Lightweight focus trap for modal dialogs.
 * Traps Tab/Shift+Tab within the container and restores focus on deactivation.
 */
export function useFocusTrap(
  containerRef: Ref<HTMLElement | null>,
  active: Ref<boolean>,
): void {
  // Resolve the editor's effective DOM root once at setup time. In light-DOM
  // mode this is the global `document`; in shadow mode it's the editor's
  // open `ShadowRoot`. Both expose `activeElement` with the same semantics
  // we need (the focused element WITHIN that root). Reading `activeElement`
  // off the shadow root instead of `document` is the difference between
  // "the focused descendant inside the trap" and "the host element" when
  // focus is inside the shadow tree.
  const editorRoot = useEditorRoot();

  let previouslyFocused: HTMLElement | null = null;
  let cleanupListener: (() => void) | null = null;
  let pendingRaf: number | null = null;

  function getFocusableElements(): HTMLElement[] {
    if (!containerRef.value) return [];
    return Array.from(
      containerRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => el.offsetParent !== null);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== "Tab") return;

    const focusable = getFocusableElements();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (editorRoot.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (editorRoot.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function activate(): void {
    // Re-entry guard: if a previous activate didn't deactivate (e.g.
    // container ref swapped while still active), tear down the prior
    // listener and rAF before registering new ones — otherwise they leak.
    const wasActive = cleanupListener !== null || pendingRaf !== null;
    if (wasActive) {
      deactivate({ restoreFocus: false });
    }

    // Only capture previouslyFocused on the FIRST activation. On re-entry,
    // editorRoot.activeElement is whatever the user tabbed to inside the
    // trap; overwriting would lose the original pre-trap focus target.
    if (!wasActive) {
      previouslyFocused = editorRoot.activeElement as HTMLElement | null;
    }

    pendingRaf = requestAnimationFrame(() => {
      pendingRaf = null;
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        const autofocus = containerRef.value?.querySelector<HTMLElement>(
          "[autofocus], input:not([disabled])",
        );
        (autofocus ?? focusable[0]).focus();
      }
    });

    cleanupListener = useEventListener(containerRef, "keydown", handleKeydown);
  }

  function deactivate(opts: { restoreFocus?: boolean } = {}): void {
    const restoreFocus = opts.restoreFocus !== false;

    if (pendingRaf !== null) {
      if (typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(pendingRaf);
      }
      pendingRaf = null;
    }

    cleanupListener?.();
    cleanupListener = null;

    if (restoreFocus && previouslyFocused && previouslyFocused.focus) {
      previouslyFocused.focus();
      previouslyFocused = null;
    }
  }

  const stopWatch = watch(
    [active, containerRef],
    ([isActive, container]) => {
      if (isActive && container) {
        activate();
      } else {
        deactivate();
      }
    },
    { flush: "post" },
  );

  onScopeDispose(() => {
    stopWatch();
    deactivate();
  });
}
