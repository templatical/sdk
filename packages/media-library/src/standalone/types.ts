import type { SdkAuthConfig } from "@templatical/core/cloud";
import type { MediaItem } from "../types";

export interface MediaLibraryConfig {
  container: string | HTMLElement;
  auth: SdkAuthConfig;
  baseUrl?: string;
  locale?: string;
  theme?: {
    primaryColor?: string;
    borderRadius?: number;
  };
  onSelect?: (item: MediaItem) => void;
  onError?: (error: Error) => void;
}

export interface MediaLibraryInstance {
  setTheme(theme: { primaryColor?: string; borderRadius?: number }): void;
  unmount(): void;
}
