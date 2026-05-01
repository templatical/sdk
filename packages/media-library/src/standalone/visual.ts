import { createSdkAuthManager } from "@templatical/core/cloud";
import type { PlanConfig } from "@templatical/types";
import { ApiClient } from "@templatical/core/cloud";
import MediaLibrary from "./MediaLibrary.vue";
import { loadMediaTranslations, type MediaTranslations } from "../i18n";
import type { MediaLibraryConfig, MediaLibraryInstance } from "./types";
import { createApp, h, ref, type App, type Ref } from "vue";

// Import SDK styles
import "../styles/index.css";

// Re-export types for consumers
export type { MediaFolder, MediaItem } from "../types";
export type { MediaLibraryConfig, MediaLibraryInstance } from "./types";

let appInstance: App | null = null;
const mediaLibraryRef: Ref<InstanceType<typeof MediaLibrary> | null> =
  ref(null);

async function init(config: MediaLibraryConfig): Promise<MediaLibraryInstance> {
  const container =
    typeof config.container === "string"
      ? document.querySelector(config.container)
      : config.container;

  if (!container) {
    throw new Error(`Container element not found: ${config.container}`);
  }

  // Initialize auth
  const authManager = createSdkAuthManager(config.auth, config.onError);
  await authManager.initialize();

  // Fetch plan config
  const apiClient = new ApiClient(authManager);
  const planConfig: PlanConfig = await apiClient.fetchConfig();

  // Load translations
  const translations: MediaTranslations = await loadMediaTranslations(
    config.locale ?? "en",
  );

  // Apply theme overrides to container
  applyTheme(container as HTMLElement, config.theme);

  // Unmount any prior app *after* awaits so concurrent init() calls don't
  // both pass an early check while appInstance is still null and orphan
  // the first-mounted app.
  if (appInstance) {
    unmount();
  }

  return new Promise((resolve, reject) => {
    try {
      appInstance = createApp({
        setup() {
          const onReady = () => {
            const instance: MediaLibraryInstance = {
              setTheme: (theme) => applyTheme(container as HTMLElement, theme),
              unmount,
            };

            resolve(instance);
          };

          return () =>
            h(MediaLibrary, {
              authManager,
              projectId: authManager.projectId,
              planConfig,
              translations,
              onSelect: config.onSelect,
              onError: config.onError,
              ref: mediaLibraryRef,
              onReady,
            });
        },
      });

      appInstance.mount(container);
    } catch (error) {
      reject(error);
    }
  });
}

function unmount(): void {
  if (appInstance) {
    appInstance.unmount();
    appInstance = null;
    mediaLibraryRef.value = null;
  }
}

function applyTheme(
  container: HTMLElement,
  theme?: { primaryColor?: string; borderRadius?: number },
): void {
  if (!theme) {
    return;
  }

  if (theme.primaryColor) {
    container.style.setProperty("--tpl-primary", theme.primaryColor);
  }

  if (theme.borderRadius !== undefined) {
    container.style.setProperty("--tpl-radius", `${theme.borderRadius}px`);
    container.style.setProperty(
      "--tpl-radius-sm",
      `${Math.max(0, theme.borderRadius - 3)}px`,
    );
    container.style.setProperty(
      "--tpl-radius-lg",
      `${theme.borderRadius + 4}px`,
    );
  }
}

const TemplaticalMedia = {
  init,
  unmount,
};

// Assign to window for IIFE usage
if (typeof window !== "undefined") {
  (
    window as unknown as Window & { TemplaticalMedia: typeof TemplaticalMedia }
  ).TemplaticalMedia = TemplaticalMedia;
}

// Named exports for destructured imports
export { init, unmount };

// Default export for library mode
export default TemplaticalMedia;
