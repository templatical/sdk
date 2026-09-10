import type {
  MediaAsset,
  MediaAssetPatch,
  MediaCategory,
  MediaCreateInput,
  MediaFolder,
  MediaFolderInput,
  MediaListPage,
  MediaListParams,
  MediaProvider,
  MediaStorageInfo,
  MediaUsageInfo,
  PlanConfig,
} from "@templatical/types";
import type { AuthManager } from "./auth";
import {
  MediaApiClient,
  type CloudMediaFolder,
  type CloudMediaItem,
} from "./media-api";

/**
 * Cloud's wire shape → the contract shape. The whole job of this adapter,
 * plus auth: snake_case to camelCase, and `small_url` / `medium_url` down to
 * a single {@link MediaAsset.thumbnailUrl}. Confirm always inserts `url`;
 * conversions never leak onto the BYO type.
 *
 * `thumbnailUrl` is omitted (not `null`) when both derivatives are null —
 * the grid then falls back to `url`.
 */
function toAsset(item: CloudMediaItem): MediaAsset {
  const asset: MediaAsset = {
    id: item.id,
    url: item.url,
    filename: item.filename,
    alt: item.alt_text,
    mimeType: item.mime_type,
    folderId: item.folder_id,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    size: item.size,
  };
  if (item.width != null) {
    asset.width = item.width;
  }
  if (item.height != null) {
    asset.height = item.height;
  }
  const thumbnailUrl = item.small_url ?? item.medium_url ?? null;
  if (thumbnailUrl != null) {
    asset.thumbnailUrl = thumbnailUrl;
  }
  return asset;
}

function toFolder(
  folder: CloudMediaFolder,
  inheritedParentId: string | null = null,
): MediaFolder {
  return {
    id: folder.id,
    name: folder.name,
    parentId:
      folder.parent_id !== undefined ? folder.parent_id : inheritedParentId,
  };
}

/**
 * Flatten a Cloud folder payload into the contract's flat list.
 *
 * The index endpoint may return a tree (`children`) or already-flat
 * `parent_id` rows. Depth-first so a parent is always listed before its
 * descendants. Already-flat rows just map `parent_id` → `parentId`.
 */
function flattenFolders(
  nodes: CloudMediaFolder[],
  inheritedParentId: string | null = null,
): MediaFolder[] {
  const out: MediaFolder[] = [];
  for (const node of nodes) {
    out.push(toFolder(node, inheritedParentId));
    if (node.children?.length) {
      out.push(...flattenFolders(node.children, node.id));
    }
  }
  return out;
}

function mimeTypesFromPlan(
  plan: PlanConfig | null,
): Partial<Record<MediaCategory, string[]>> | undefined {
  const categories = plan?.media?.categories;
  if (!categories) {
    return undefined;
  }
  const mapped: Partial<Record<MediaCategory, string[]>> = {};
  for (const [key, value] of Object.entries(categories)) {
    mapped[key as MediaCategory] = value.mime_types;
  }
  return mapped;
}

/**
 * Cloud-backed {@link MediaProvider} — the Templatical Cloud adapter for the
 * same DAM contract consumers implement themselves.
 *
 * Every method is a function: Cloud's media storage is what the plan pays
 * for, so there is no Cloud tier that can list but not upload. A consumer
 * who wants a read-only gallery supplies their own provider with the
 * mutations set to `false`.
 *
 * **Ignores `templateId`.** Cloud's library is project-scoped; a CMS that
 * scopes a gallery per template reads that param in its own `list`.
 *
 * **`storage` / `maxFileSize` / `mimeTypes` are live.** They read
 * `getPlanConfig()` at call time, because plan config arrives after
 * construction. Snapshotting at setup would pin `storage()` to `null` and
 * hide the quota ring for the whole session. A spread of this object
 * freezes the getters — `initCloud()` must `Object.assign`, never spread.
 */
export function createCloudMediaProvider(
  authManager: AuthManager,
  getPlanConfig?: () => PlanConfig | null,
): MediaProvider {
  const api = new MediaApiClient(authManager);

  return {
    async list(params?: MediaListParams): Promise<MediaListPage> {
      const response = await api.browseMedia({
        search: params?.search,
        cursor: params?.cursor,
        folder_id: params?.folderId,
        category: params?.category,
      });
      const page: MediaListPage = {
        items: response.data.map(toAsset),
      };
      if (response.meta.next_cursor) {
        page.nextCursor = response.meta.next_cursor;
      }
      return page;
    },

    async create(input: MediaCreateInput): Promise<MediaAsset> {
      return toAsset(await api.uploadMedia(input.file, input.folderId));
    },

    async update(id: string, patch: MediaAssetPatch): Promise<MediaAsset> {
      return toAsset(await api.updateMedia(id, patch.filename, patch.alt));
    },

    delete(ids: string[]): Promise<void> {
      return api.deleteMedia(ids);
    },

    folders: {
      async list(): Promise<MediaFolder[]> {
        return flattenFolders(await api.getMediaFolders());
      },
      async create(input: MediaFolderInput): Promise<MediaFolder> {
        return toFolder(
          await api.createMediaFolder(input.name, input.parentId),
        );
      },
      async update(id: string, patch: { name: string }): Promise<MediaFolder> {
        return toFolder(await api.renameMediaFolder(id, patch.name));
      },
      delete(id: string): Promise<void> {
        return api.deleteMediaFolder(id);
      },
      async move(
        ids: string[],
        folderId: string | null,
      ): Promise<MediaAsset[]> {
        return (await api.moveMedia(ids, folderId)).map(toAsset);
      },
    },

    async replace(id: string, file: File): Promise<MediaAsset> {
      return toAsset(await api.replaceMedia(id, file));
    },

    async importFromUrl(
      url: string,
      folderId?: string | null,
    ): Promise<MediaAsset> {
      return toAsset(await api.importFromUrl(url, folderId));
    },

    async checkUsage(ids: string[]): Promise<Record<string, MediaUsageInfo>> {
      const response = await api.checkMediaUsage(ids);
      const mapped: Record<string, MediaUsageInfo> = {};
      for (const [id, info] of Object.entries(response.data)) {
        mapped[id] = {
          templateCount: info.template_count,
          templateNames: info.template_names,
        };
      }
      return mapped;
    },

    async frequentlyUsed(): Promise<MediaAsset[]> {
      return (await api.getFrequentlyUsed()).map(toAsset);
    },

    async storage(): Promise<MediaStorageInfo | null> {
      const storage = getPlanConfig?.()?.storage;
      if (!storage) {
        return null;
      }
      return {
        usedBytes: storage.used_bytes,
        limitBytes: storage.limit_bytes,
      };
    },

    /**
     * A getter, not a snapshot: plan config arrives after construction.
     * The editor reads this inside a computed; capturing it at setup
     * would pin the client pre-check to `undefined`.
     */
    get maxFileSize(): number | undefined {
      return getPlanConfig?.()?.media?.max_file_size;
    },

    get mimeTypes(): Partial<Record<MediaCategory, string[]>> | undefined {
      return mimeTypesFromPlan(getPlanConfig?.() ?? null);
    },
  };
}
