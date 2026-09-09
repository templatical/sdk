import type {
  MediaAsset,
  MediaCategory,
  MediaProvider,
} from "@templatical/types";

export interface MediaLibraryConfig {
  container: string | HTMLElement;
  provider: MediaProvider;
  locale?: string;
  theme?: {
    primaryColor?: string;
    borderRadius?: number;
  };
  onSelect?: (asset: MediaAsset) => void;
  accept?: MediaCategory[];
}

export interface MediaLibraryInstance {
  setTheme(theme: { primaryColor?: string; borderRadius?: number }): void;
  unmount(): void;
}
