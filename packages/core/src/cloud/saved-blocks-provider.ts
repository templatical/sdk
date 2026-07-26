import type {
  Block,
  SavedBlock,
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
 */
export function createCloudSavedBlocksProvider(
  authManager: AuthManager,
): SavedBlocksProvider {
  const api = new ApiClient(authManager);

  return {
    list(params?: SavedBlocksListParams): Promise<SavedBlock[]> {
      return api.listModules(params?.search);
    },
    create(input: { name: string; content: Block[] }): Promise<SavedBlock> {
      return api.createModule(input);
    },
    update(
      id: string,
      patch: Partial<{ name: string; content: Block[] }>,
    ): Promise<SavedBlock> {
      return api.updateModule(id, patch);
    },
    delete(id: string): Promise<void> {
      return api.deleteModule(id);
    },
  };
}
