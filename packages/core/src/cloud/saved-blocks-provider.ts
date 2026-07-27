import type {
  SavedBlock,
  SavedBlockInput,
  SavedBlockPatch,
  SavedBlocksListParams,
  SavedBlocksProvider,
} from "@templatical/types";
import { ApiClient } from "./api";
import type { AuthManager } from "./auth";

/**
 * Cloud-backed {@link SavedBlocksProvider} — the Templatical Cloud adapter for
 * the same contract consumers implement themselves.
 *
 * Auth (JWT via {@link AuthManager}) and project/tenant scoping live entirely
 * on this side of the seam: the shared `useSavedBlocks` composable and the
 * editor UI never see them. Plan gating is applied by the caller before this
 * provider is constructed.
 *
 * Wraps the existing `ApiClient` saved-module endpoints, so the REST contract
 * is unchanged from before saved blocks became an open-source feature.
 *
 * Rows pass straight through, unmapped: the Cloud endpoints speak the same
 * `SavedBlock` shape the contract defines, so this adapter only supplies auth
 * and scoping. That means the payload's field names track the contract — the
 * backend serialises `category`, `canUpdate`, `canDelete`, `createdAt` and
 * `updatedAt`. Until it does, those fields simply arrive absent, which degrades
 * to "no timestamp label, every action allowed" rather than breaking.
 */
export function createCloudSavedBlocksProvider(
  authManager: AuthManager,
): SavedBlocksProvider {
  const api = new ApiClient(authManager);

  return {
    list(params?: SavedBlocksListParams): Promise<SavedBlock[]> {
      return api.listModules(params?.search, params?.category);
    },
    // All three enabled: Cloud gates saved blocks by plan entitlement above
    // this seam, and row-level permissions arrive as `canUpdate`/`canDelete`
    // on the entries themselves.
    create(input: SavedBlockInput): Promise<SavedBlock> {
      return api.createModule(input);
    },
    update(id: string, patch: SavedBlockPatch): Promise<SavedBlock> {
      return api.updateModule(id, patch);
    },
    delete(id: string): Promise<void> {
      return api.deleteModule(id);
    },
  };
}
