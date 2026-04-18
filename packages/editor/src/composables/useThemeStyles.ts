import type { ThemeOverrides } from "@templatical/types";
import { computed, type ComputedRef, type Ref } from "vue";

const THEME_VAR_MAPPING: Record<keyof Omit<ThemeOverrides, "dark">, string> = {
  bg: "--tpl-bg",
  bgElevated: "--tpl-bg-elevated",
  bgHover: "--tpl-bg-hover",
  bgActive: "--tpl-bg-active",
  border: "--tpl-border",
  borderLight: "--tpl-border-light",
  text: "--tpl-text",
  textMuted: "--tpl-text-muted",
  textDim: "--tpl-text-dim",
  primary: "--tpl-primary",
  primaryHover: "--tpl-primary-hover",
  primaryLight: "--tpl-primary-light",
  secondary: "--tpl-secondary",
  secondaryHover: "--tpl-secondary-hover",
  secondaryLight: "--tpl-secondary-light",
  success: "--tpl-success",
  successLight: "--tpl-success-light",
  warning: "--tpl-warning",
  warningLight: "--tpl-warning-light",
  danger: "--tpl-danger",
  dangerLight: "--tpl-danger-light",
  canvasBg: "--tpl-canvas-bg",
};

export interface UseThemeStylesOptions {
  themeOverrides: Ref<ThemeOverrides>;
  resolvedTheme: ComputedRef<string>;
  extraStyles?: () => Record<string, string>;
}

export function useThemeStyles({
  themeOverrides,
  resolvedTheme,
  extraStyles,
}: UseThemeStylesOptions): {
  themeStyles: ComputedRef<Record<string, string>>;
} {
  const themeStyles = computed(() => {
    const styles: Record<string, string> = {};
    const base = themeOverrides.value;
    const isDark = resolvedTheme.value === "dark";
    // In dark mode, only apply consumer's dark overrides as inline styles.
    // Base (light) overrides must NOT be inlined — they'd pin CSS variables to
    // light values and prevent the CSS [data-tpl-theme="dark"] block from working.
    const overrides = isDark ? base.dark : base;

    if (overrides) {
      for (const [key, cssVar] of Object.entries(THEME_VAR_MAPPING)) {
        const k = key as keyof Omit<ThemeOverrides, "dark">;
        const value = overrides[k];
        if (value) {
          styles[cssVar] = value;
        }
      }
    }

    if (extraStyles) {
      Object.assign(styles, extraStyles());
    }

    return styles;
  });

  return { themeStyles };
}
