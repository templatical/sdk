import type {
  Template,
  TemplateContent,
  TemplateVersion,
  TemplateVersionResponse,
  VersionHistoryProvider,
} from "@templatical/types";
import { ApiClient } from "./api";
import type { AuthManager } from "./auth";

/**
 * Cloud's wire shape → the contract shape. The only real work this adapter does:
 * snake_case to camelCase, and `is_autosave` to `isAutomatic`.
 *
 * `content` is carried through deliberately — Cloud's index endpoint already
 * returns it, so every listed version arrives hydrated and the editor never
 * calls `get` while scrubbing. See {@link TemplateVersion.content}: that is the
 * hint working as intended, not a shortcut. `get` is implemented anyway, because
 * it is the contract's operation and Cloud is one implementation of it like any
 * other.
 */
function toVersion(record: TemplateVersionResponse): TemplateVersion {
  return {
    id: record.id,
    createdAt: record.created_at,
    isAutomatic: record.is_autosave,
    content: record.content,
  };
}

/**
 * Cloud-backed {@link VersionHistoryProvider} — the Templatical Cloud adapter for
 * the same contract consumers implement themselves.
 *
 * Both mutations are enabled: version storage is what the plan pays for, so
 * there is no Cloud tier that can list history but not restore it. A consumer
 * who wants read-only history supplies their own provider with `restore: false`.
 *
 * **Automatic versions are not created here.** They are recorded by
 * `createCloudTemplatesProvider`'s `save`, because the contract puts that
 * decision on whoever implements `save` — the side that knows the storage cost.
 * `create` here is for a version a person asked for.
 */
export function createCloudVersionHistoryProvider(
  authManager: AuthManager,
): VersionHistoryProvider {
  const api = new ApiClient(authManager);

  return {
    async list(templateId: string): Promise<TemplateVersion[]> {
      const records = await api.getVersions(templateId);
      return records.map(toVersion);
    },
    async get(templateId: string, versionId: string): Promise<TemplateContent> {
      const record = await api.getVersion(templateId, versionId);
      return record.content;
    },
    async create(
      templateId: string,
      content: TemplateContent,
      meta?: { label?: string },
    ): Promise<TemplateVersion> {
      return toVersion(
        await api.createVersion(templateId, content, meta?.label),
      );
    },
    restore(templateId: string, versionId: string): Promise<Template> {
      // Cloud keeps an atomic, audited server endpoint. It is append-only like
      // every other implementation of this method: restoring records a new entry
      // rather than rewriting the one being restored.
      return api.restoreVersion(templateId, versionId);
    },
  };
}
