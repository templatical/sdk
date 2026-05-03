import { useEventListener } from "@vueuse/core";
import { onScopeDispose, watch, type Ref } from "vue";

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
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function activate(): void {
    // Re-entry guard: if a previous activate didn't deactivate (e.g.
    // container ref swapped while still active), tear down the prior
    // listener and rAF before registering new ones — otherwise they leak.
    if (cleanupListener || pendingRaf !== null) {
      deactivate({ restoreFocus: false });
    }

    previouslyFocused = document.activeElement as HTMLElement | null;

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
