import { computed, ref, watch, onUnmounted, type Ref } from "vue";
import type { UiTheme } from "@templatical/types";

export function useUiTheme(uiTheme: Ref<UiTheme>) {
  const systemPrefersDark = ref(false);
  let mediaQuery: MediaQueryList | null = null;
  let handler: ((e: MediaQueryListEvent) => void) | null = null;

  function setupMediaListener(): void {
    cleanupMediaListener();
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemPrefersDark.value = mediaQuery.matches;
    handler = (e: MediaQueryListEvent) => {
      systemPrefersDark.value = e.matches;
    };
    mediaQuery.addEventListener("change", handler);
  }

  function cleanupMediaListener(): void {
    if (mediaQuery && handler) {
      mediaQuery.removeEventListener("change", handler);
    }
    mediaQuery = null;
    handler = null;
  }

  watch(
    uiTheme,
    (theme) => {
      if (theme === "auto") {
        setupMediaListener();
      } else {
        cleanupMediaListener();
      }
    },
    { immediate: true },
  );

  const resolvedTheme = computed<"light" | "dark">(() => {
    if (uiTheme.value === "auto") {
      return systemPrefersDark.value ? "dark" : "light";
    }
    return uiTheme.value;
  });

  onUnmounted(cleanupMediaListener);

  return { resolvedTheme };
}
