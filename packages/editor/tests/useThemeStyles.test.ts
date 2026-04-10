import "./dom-stubs";

import { describe, expect, it } from "vitest";
import { createApp, defineComponent, h, ref, computed } from "vue";
import type { ThemeOverrides } from "@templatical/types";
import { useThemeStyles } from "../src/composables/useThemeStyles";

function withSetup<T>(setup: () => T): { result: T; unmount: () => void } {
  let result: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => h("div");
      },
    }),
  );
  app.mount(document.createElement("div"));
  return { result: result!, unmount: () => app.unmount() };
}

describe("useThemeStyles", () => {
  it("returns empty styles when overrides are empty", () => {
    const { result, unmount } = withSetup(() =>
      useThemeStyles({
        themeOverrides: ref<ThemeOverrides>({}),
        resolvedTheme: computed(() => "light"),
      }),
    );

    expect(result.themeStyles.value).toEqual({});
    unmount();
  });

  it("maps light theme overrides to CSS variables", () => {
    const { result, unmount } = withSetup(() =>
      useThemeStyles({
        themeOverrides: ref<ThemeOverrides>({
          primary: "#ff0000",
          bg: "#ffffff",
          text: "#000000",
        }),
        resolvedTheme: computed(() => "light"),
      }),
    );

    expect(result.themeStyles.value["--tpl-primary"]).toBe("#ff0000");
    expect(result.themeStyles.value["--tpl-bg"]).toBe("#ffffff");
    expect(result.themeStyles.value["--tpl-text"]).toBe("#000000");
    unmount();
  });

  it("uses dark overrides when resolvedTheme is dark", () => {
    const { result, unmount } = withSetup(() =>
      useThemeStyles({
        themeOverrides: ref<ThemeOverrides>({
          primary: "#ff0000",
          dark: {
            primary: "#00ff00",
            bg: "#111111",
          },
        }),
        resolvedTheme: computed(() => "dark"),
      }),
    );

    expect(result.themeStyles.value["--tpl-primary"]).toBe("#00ff00");
    expect(result.themeStyles.value["--tpl-bg"]).toBe("#111111");
    // Light-mode primary is NOT inlined in dark mode
    expect(Object.values(result.themeStyles.value)).not.toContain("#ff0000");
    unmount();
  });

  it("does not inline light overrides when in dark mode", () => {
    const { result, unmount } = withSetup(() =>
      useThemeStyles({
        themeOverrides: ref<ThemeOverrides>({
          primary: "#ff0000",
          bg: "#ffffff",
        }),
        resolvedTheme: computed(() => "dark"),
      }),
    );

    // dark overrides are undefined, so nothing is inlined
    expect(result.themeStyles.value).toEqual({});
    unmount();
  });

  it("skips falsy values in overrides", () => {
    const { result, unmount } = withSetup(() =>
      useThemeStyles({
        themeOverrides: ref<ThemeOverrides>({
          primary: "#ff0000",
          bg: "",
        }),
        resolvedTheme: computed(() => "light"),
      }),
    );

    expect(result.themeStyles.value["--tpl-primary"]).toBe("#ff0000");
    expect(result.themeStyles.value).not.toHaveProperty("--tpl-bg");
    unmount();
  });

  it("includes extraStyles when provided", () => {
    const { result, unmount } = withSetup(() =>
      useThemeStyles({
        themeOverrides: ref<ThemeOverrides>({ primary: "#ff0000" }),
        resolvedTheme: computed(() => "light"),
        extraStyles: () => ({ "--tpl-drop-text": '"Drop here"' }),
      }),
    );

    expect(result.themeStyles.value["--tpl-primary"]).toBe("#ff0000");
    expect(result.themeStyles.value["--tpl-drop-text"]).toBe('"Drop here"');
    unmount();
  });

  it("reacts to theme override changes", () => {
    const overrides = ref<ThemeOverrides>({ primary: "#ff0000" });
    const { result, unmount } = withSetup(() =>
      useThemeStyles({
        themeOverrides: overrides,
        resolvedTheme: computed(() => "light"),
      }),
    );

    expect(result.themeStyles.value["--tpl-primary"]).toBe("#ff0000");

    overrides.value = { primary: "#00ff00" };
    expect(result.themeStyles.value["--tpl-primary"]).toBe("#00ff00");
    unmount();
  });

  it("reacts to resolvedTheme switching from light to dark", () => {
    const theme = ref("light");
    const { result, unmount } = withSetup(() =>
      useThemeStyles({
        themeOverrides: ref<ThemeOverrides>({
          primary: "#ff0000",
          dark: { primary: "#00ff00" },
        }),
        resolvedTheme: computed(() => theme.value),
      }),
    );

    expect(result.themeStyles.value["--tpl-primary"]).toBe("#ff0000");

    theme.value = "dark";
    expect(result.themeStyles.value["--tpl-primary"]).toBe("#00ff00");
    unmount();
  });

  it("maps all 22 theme keys to correct CSS variables", () => {
    const overrides: ThemeOverrides = {
      bg: "1",
      bgElevated: "2",
      bgHover: "3",
      bgActive: "4",
      border: "5",
      borderLight: "6",
      text: "7",
      textMuted: "8",
      textDim: "9",
      primary: "10",
      primaryHover: "11",
      primaryLight: "12",
      secondary: "13",
      secondaryHover: "14",
      secondaryLight: "15",
      success: "16",
      successLight: "17",
      warning: "18",
      warningLight: "19",
      danger: "20",
      dangerLight: "21",
      canvasBg: "22",
    };

    const { result, unmount } = withSetup(() =>
      useThemeStyles({
        themeOverrides: ref<ThemeOverrides>(overrides),
        resolvedTheme: computed(() => "light"),
      }),
    );

    const styles = result.themeStyles.value;
    expect(styles["--tpl-bg"]).toBe("1");
    expect(styles["--tpl-bg-elevated"]).toBe("2");
    expect(styles["--tpl-bg-hover"]).toBe("3");
    expect(styles["--tpl-bg-active"]).toBe("4");
    expect(styles["--tpl-border"]).toBe("5");
    expect(styles["--tpl-border-light"]).toBe("6");
    expect(styles["--tpl-text"]).toBe("7");
    expect(styles["--tpl-text-muted"]).toBe("8");
    expect(styles["--tpl-text-dim"]).toBe("9");
    expect(styles["--tpl-primary"]).toBe("10");
    expect(styles["--tpl-primary-hover"]).toBe("11");
    expect(styles["--tpl-primary-light"]).toBe("12");
    expect(styles["--tpl-secondary"]).toBe("13");
    expect(styles["--tpl-secondary-hover"]).toBe("14");
    expect(styles["--tpl-secondary-light"]).toBe("15");
    expect(styles["--tpl-success"]).toBe("16");
    expect(styles["--tpl-success-light"]).toBe("17");
    expect(styles["--tpl-warning"]).toBe("18");
    expect(styles["--tpl-warning-light"]).toBe("19");
    expect(styles["--tpl-danger"]).toBe("20");
    expect(styles["--tpl-danger-light"]).toBe("21");
    expect(styles["--tpl-canvas-bg"]).toBe("22");
    expect(Object.keys(styles)).toHaveLength(22);
    unmount();
  });
});
