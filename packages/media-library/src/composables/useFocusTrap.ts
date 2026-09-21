import { useEventListener } from "@vueuse/core";
import { onScopeDispose, watch, type Ref } from "vue";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Lightweight focus trap for dialogs.
 *
 * Uses the container's `getRootNode()` so Tab wrapping works both in
 * standalone `document` and when the library is teleported into the
 * editor's shadow root — `document.activeElement` would be the host.
 */
export function useFocusTrap(
  containerRef: Ref<HTMLElement | null>,
  active: Ref<boolean>,
): void {
  let previouslyFocused: HTMLElement | null = null;
  let cleanupListener: (() => void) | null = null;
  let pendingRaf: number | null = null;

  function rootOf(el: HTMLElement | null): Pick<Document, "activeElement"> {
    if (!el) return document;
    const root = el.getRootNode();
    if (root && "activeElement" in root) {
      return root as Document | ShadowRoot;
    }
    return document;
  }

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
    const current = rootOf(containerRef.value).activeElement;

    if (event.shiftKey) {
      if (current === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (current === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function activate(): void {
    const wasActive = cleanupListener !== null || pendingRaf !== null;
    if (wasActive) {
      deactivate({ restoreFocus: false });
    }

    if (!wasActive) {
      previouslyFocused = rootOf(containerRef.value)
        .activeElement as HTMLElement | null;
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
