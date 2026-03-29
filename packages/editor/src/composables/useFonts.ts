import type { CustomFont, FontsConfig } from "@templatical/types";
import { computed, ref, type ComputedRef, type Ref } from "vue";

export interface FontOption {
  value: string;
  label: string;
  isCustom?: boolean;
}

export interface UseFontsReturn {
  fonts: ComputedRef<FontOption[]>;
  defaultFont: ComputedRef<string>;
  defaultFallback: ComputedRef<string>;
  customFonts: Ref<CustomFont[]>;
  customFontsEnabled: Ref<boolean>;
  isLoaded: Ref<boolean>;
  setCustomFontsEnabled: (enabled: boolean) => void;
  loadCustomFonts: () => Promise<void>;
  getFontWithFallback: (fontName: string) => string;
  getDefaultFont: () => string;
}

const BUILT_IN_FONTS: FontOption[] = [
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Helvetica, sans-serif", label: "Helvetica" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "Times New Roman, serif", label: "Times New Roman" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: "Trebuchet MS, sans-serif", label: "Trebuchet MS" },
  { value: "Courier New, monospace", label: "Courier New" },
];

const DEFAULT_FALLBACK = "Arial, sans-serif";

export function useFonts(config?: FontsConfig): UseFontsReturn {
  const customFonts = ref<CustomFont[]>(config?.customFonts ?? []);
  const customFontsEnabled = ref(true);
  const isLoaded = ref(false);

  const defaultFallback = computed(
    () => config?.defaultFallback ?? DEFAULT_FALLBACK,
  );

  function setCustomFontsEnabled(enabled: boolean): void {
    customFontsEnabled.value = enabled;
  }

  const fonts = computed<FontOption[]>(() => {
    const builtInFonts = [...BUILT_IN_FONTS];

    if (!customFontsEnabled.value) {
      return builtInFonts.sort((a, b) => a.label.localeCompare(b.label));
    }

    const customFontOptions: FontOption[] = customFonts.value.map((font) => ({
      value: font.name,
      label: font.name,
      isCustom: true,
    }));

    const allFonts = [...builtInFonts, ...customFontOptions];

    allFonts.sort((a, b) => a.label.localeCompare(b.label));

    return allFonts;
  });

  function isFontAvailable(fontName: string): boolean {
    return fonts.value.some(
      (font) =>
        font.label.toLowerCase() === fontName.toLowerCase() ||
        font.value.toLowerCase().startsWith(fontName.toLowerCase()),
    );
  }

  function isBuiltInFont(fontName: string): boolean {
    return BUILT_IN_FONTS.some(
      (font) =>
        font.label.toLowerCase() === fontName.toLowerCase() ||
        font.value.toLowerCase().startsWith(fontName.toLowerCase()),
    );
  }

  function getDefaultFont(): string {
    if (config?.defaultFont) {
      if (!customFontsEnabled.value && !isBuiltInFont(config.defaultFont)) {
        return DEFAULT_FALLBACK;
      }

      if (isFontAvailable(config.defaultFont)) {
        const matchedFont = fonts.value.find(
          (font) =>
            font.label.toLowerCase() === config.defaultFont!.toLowerCase() ||
            font.value
              .toLowerCase()
              .startsWith(config.defaultFont!.toLowerCase()),
        );
        if (matchedFont) {
          return matchedFont.value;
        }
      }
    }
    return DEFAULT_FALLBACK;
  }

  const defaultFont = computed(() => getDefaultFont());

  function getFontWithFallback(fontName: string): string {
    const customFont = customFonts.value.find(
      (font) => font.name.toLowerCase() === fontName.toLowerCase(),
    );

    if (customFont) {
      const fallback = customFont.fallback ?? defaultFallback.value;
      return `'${customFont.name}', ${fallback}`;
    }

    const builtInFont = BUILT_IN_FONTS.find(
      (font) =>
        font.label.toLowerCase() === fontName.toLowerCase() ||
        font.value.toLowerCase().startsWith(fontName.toLowerCase()),
    );

    if (builtInFont) {
      return builtInFont.value;
    }

    return fontName.includes(",")
      ? fontName
      : `${fontName}, ${defaultFallback.value}`;
  }

  async function loadCustomFonts(): Promise<void> {
    if (customFonts.value.length === 0) {
      isLoaded.value = true;
      return;
    }

    const loadPromises = customFonts.value.map(async (font) => {
      try {
        const existingLink = document.querySelector(`link[href="${font.url}"]`);
        if (existingLink) {
          return;
        }

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = font.url;
        link.setAttribute("data-custom-font", font.name);

        await new Promise<void>((resolve, reject) => {
          link.onload = () => resolve();
          link.onerror = () =>
            reject(new Error(`Failed to load font: ${font.name}`));
          document.head.appendChild(link);
        });
      } catch (error) {
        console.warn(`Failed to load custom font "${font.name}":`, error);
      }
    });

    await Promise.allSettled(loadPromises);
    isLoaded.value = true;
  }

  return {
    fonts,
    defaultFont,
    defaultFallback,
    customFonts,
    customFontsEnabled,
    isLoaded,
    setCustomFontsEnabled,
    loadCustomFonts,
    getFontWithFallback,
    getDefaultFont,
  };
}
