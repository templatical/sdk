import type { ApiError, ApiResponse } from "@templatical/types";
import type { AuthManager } from "./auth";
import { API_ROUTES, buildUrl } from "./url-builder";

/**
 * Cloud's wire shape for one media row — snake_case HTTP, not the BYO
 * MediaAsset contract. The adapter maps.
 */
export interface CloudMediaItem {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  url: string;
  small_url: string | null;
  medium_url: string | null;
  large_url: string | null;
  folder_id: string | null;
  conversions_generated?: boolean;
  width: number | null;
  height: number | null;
  alt_text: string;
  created_at: string;
  updated_at: string;
}

/**
 * Cloud's wire shape for one folder. The index endpoint may return a tree
 * (`children`) or a flat list (`parent_id`); the adapter flattens either.
 */
export interface CloudMediaFolder {
  id: string;
  name: string;
  parent_id?: string | null;
  children?: CloudMediaFolder[];
  project_id?: string;
  created_at?: string;
}

export interface CloudMediaBrowseParams {
  folder_id?: string | null;
  search?: string;
  category?: string;
  sort?: string;
  cursor?: string;
}

export interface CloudMediaBrowseResponse {
  data: CloudMediaItem[];
  meta: {
    path: string;
    per_page: number;
    next_cursor: string | null;
    prev_cursor: string | null;
  };
}

export interface CloudMediaUsageInfo {
  template_count: number;
  template_names: string[];
}

export interface CloudMediaUsageResponse {
  data: Record<string, CloudMediaUsageInfo>;
}

/**
 * Cloud's HTTP client for media. Speaks snake_case; auth and project/tenant
 * scoping come from {@link AuthManager}. The BYO contract lives on
 * `createCloudMediaProvider`, which maps this client's rows.
 */
export class MediaApiClient {
  constructor(private readonly authManager: AuthManager) {}

  private get projectId(): string {
    return this.authManager.projectId;
  }

  private get tenantSlug(): string {
    return this.authManager.tenantSlug;
  }

  private get baseParams(): Record<string, string> {
    return { project: this.projectId, tenant: this.tenantSlug };
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await this.authManager.authenticatedFetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: `HTTP error ${response.status}`,
      }));
      throw new Error(error.message, { cause: error });
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const json: ApiResponse<T> = await response.json();
    return json.data;
  }

  async browseMedia(
    params: CloudMediaBrowseParams,
  ): Promise<CloudMediaBrowseResponse> {
    const query = new URLSearchParams();
    if (params.folder_id) query.set("folder_id", params.folder_id);
    if (params.search) query.set("search", params.search);
    if (params.category) query.set("category", params.category);
    if (params.sort) query.set("sort", params.sort);
    if (params.cursor) query.set("cursor", params.cursor);

    const queryString = query.toString();
    const url = `${buildUrl(API_ROUTES["media.browse"], this.baseParams)}${queryString ? `?${queryString}` : ""}`;
    const response = await this.authManager.authenticatedFetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: `HTTP error ${response.status}`,
      }));
      throw new Error(error.message, { cause: error });
    }

    return response.json();
  }

  async uploadMedia(
    file: File,
    folderId?: string | null,
  ): Promise<CloudMediaItem> {
    const formData = new FormData();
    formData.append("file", file);
    if (folderId) formData.append("folder_id", folderId);

    const url = buildUrl(API_ROUTES["media.upload"], this.baseParams);
    const response = await this.authManager.authenticatedFetch(url, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: `HTTP error ${response.status}`,
      }));
      throw new Error(error.message, { cause: error });
    }

    const json: ApiResponse<CloudMediaItem> = await response.json();
    return json.data;
  }

  async updateMedia(
    mediaId: string,
    filename: string,
    altText?: string,
  ): Promise<CloudMediaItem> {
    return this.request<CloudMediaItem>(
      buildUrl(API_ROUTES["media.update"], {
        ...this.baseParams,
        media: mediaId,
      }),
      {
        method: "PUT",
        body: JSON.stringify({
          filename,
          alt_text: altText,
        }),
      },
    );
  }

  async deleteMedia(ids: string[]): Promise<void> {
    return this.request<void>(
      buildUrl(API_ROUTES["media.delete"], this.baseParams),
      {
        method: "POST",
        body: JSON.stringify({ ids }),
      },
    );
  }

  async moveMedia(
    ids: string[],
    folderId: string | null,
  ): Promise<CloudMediaItem[]> {
    return this.request<CloudMediaItem[]>(
      buildUrl(API_ROUTES["media.move"], this.baseParams),
      {
        method: "POST",
        body: JSON.stringify({ ids, folder_id: folderId }),
      },
    );
  }

  async getMediaFolders(): Promise<CloudMediaFolder[]> {
    return this.request<CloudMediaFolder[]>(
      buildUrl(API_ROUTES["folders.index"], this.baseParams),
    );
  }

  async createMediaFolder(
    name: string,
    parentId?: string | null,
  ): Promise<CloudMediaFolder> {
    return this.request<CloudMediaFolder>(
      buildUrl(API_ROUTES["folders.store"], this.baseParams),
      {
        method: "POST",
        body: JSON.stringify({
          name,
          parent_id: parentId ?? null,
        }),
      },
    );
  }

  async renameMediaFolder(
    folderId: string,
    name: string,
  ): Promise<CloudMediaFolder> {
    return this.request<CloudMediaFolder>(
      buildUrl(API_ROUTES["folders.update"], {
        ...this.baseParams,
        mediaFolder: folderId,
      }),
      {
        method: "PUT",
        body: JSON.stringify({ name }),
      },
    );
  }

  async deleteMediaFolder(folderId: string): Promise<void> {
    return this.request<void>(
      buildUrl(API_ROUTES["folders.destroy"], {
        ...this.baseParams,
        mediaFolder: folderId,
      }),
      {
        method: "DELETE",
      },
    );
  }

  async checkMediaUsage(ids: string[]): Promise<CloudMediaUsageResponse> {
    const response = await this.authManager.authenticatedFetch(
      buildUrl(API_ROUTES["media.checkUsage"], this.baseParams),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ ids }),
      },
    );

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: `HTTP error ${response.status}`,
      }));
      throw new Error(error.message, { cause: error });
    }

    return response.json();
  }

  async getFrequentlyUsed(): Promise<CloudMediaItem[]> {
    return this.request<CloudMediaItem[]>(
      buildUrl(API_ROUTES["media.frequentlyUsed"], this.baseParams),
    );
  }

  async importFromUrl(
    url: string,
    folderId?: string | null,
  ): Promise<CloudMediaItem> {
    return this.request<CloudMediaItem>(
      buildUrl(API_ROUTES["media.importFromUrl"], this.baseParams),
      {
        method: "POST",
        body: JSON.stringify({
          url,
          folder_id: folderId ?? null,
        }),
      },
    );
  }

  async replaceMedia(mediaId: string, file: File): Promise<CloudMediaItem> {
    const formData = new FormData();
    formData.append("file", file);

    const url = buildUrl(API_ROUTES["media.replace"], {
      ...this.baseParams,
      media: mediaId,
    });
    const response = await this.authManager.authenticatedFetch(url, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: `HTTP error ${response.status}`,
      }));
      throw new Error(error.message, { cause: error });
    }

    const json: ApiResponse<CloudMediaItem> = await response.json();
    return json.data;
  }
}
