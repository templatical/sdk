import { useMediaQuery } from "@vueuse/core";
import { computed, type ComputedRef, type Ref } from "vue";
import type { UiTheme } from "@templatical/types";

export interface UseUiThemeReturn {
  resolvedTheme: ComputedRef<"light" | "dark">;
}

export function useUiTheme(uiTheme: Ref<UiTheme>): UseUiThemeReturn {
  const systemPrefersDark = useMediaQuery("(prefers-color-scheme: dark)");

  const resolvedTheme = computed<"light" | "dark">(() => {
    if (uiTheme.value === "auto") {
      return systemPrefersDark.value ? "dark" : "light";
    }
    return uiTheme.value;
  });

  return { resolvedTheme };
}
