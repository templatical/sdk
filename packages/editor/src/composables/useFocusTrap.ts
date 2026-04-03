import { useEventListener } from "@vueuse/core";
import { watch, type Ref } from "vue";

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
    previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus first focusable element after DOM update
    requestAnimationFrame(() => {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        // Prefer autofocus element if present
        const autofocus = containerRef.value?.querySelector<HTMLElement>(
          "[autofocus], input:not([disabled])",
        );
        (autofocus ?? focusable[0]).focus();
      }
    });

    cleanupListener = useEventListener(containerRef, "keydown", handleKeydown);
  }

  function deactivate(): void {
    cleanupListener?.();
    cleanupListener = null;

    if (previouslyFocused && previouslyFocused.focus) {
      previouslyFocused.focus();
      previouslyFocused = null;
    }
  }

  watch(
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
}
