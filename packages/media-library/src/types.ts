// ---------------------------------------------------------------------------
// Media Types — canonical definitions for Templatical media library
// ---------------------------------------------------------------------------

export type MediaCategory = "images" | "documents" | "videos" | "audio";

export type MediaConversion = "original" | "small" | "medium" | "large";

export interface MediaItem {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  url: string;
  small_url: string | null;
  medium_url: string | null;
  large_url: string | null;
  folder_id: string | null;
  conversions_generated: boolean;
  width: number | null;
  height: number | null;
  alt_text: string;
  created_at: string;
  updated_at: string;
}

export interface MediaFolder {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  children?: MediaFolder[];
  created_at: string;
}

export interface MediaBrowseParams {
  folder_id?: string | null;
  search?: string;
  category?: string;
  sort?: string;
  cursor?: string;
}

export interface MediaBrowseResponse {
  data: MediaItem[];
  meta: {
    path: string;
    per_page: number;
    next_cursor: string | null;
    prev_cursor: string | null;
  };
}

export interface MediaUsageInfo {
  template_count: number;
  template_names: string[];
}

export interface MediaUsageResponse {
  data: Record<string, MediaUsageInfo>;
}

export interface MediaRequestContext {
  accept?: MediaCategory[];
}

export interface StorageInfo {
  used_bytes: number;
  limit_bytes: number;
}

export interface MediaCategoryData {
  mime_types: string[];
  extensions: string[];
}

export interface MediaConfig {
  use_media_library: boolean;
  categories: Record<string, MediaCategoryData>;
  max_file_size: number;
}
