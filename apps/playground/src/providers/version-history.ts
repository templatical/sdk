import type {
  TemplateVersion,
  VersionHistoryProvider,
} from "@templatical/types";
import type { TemplateOption } from "@/templates";
import { SCRATCH_TEMPLATE_NAME } from "./template-name";
import { HYDRATED_VERSIONS, versionStoreFor } from "./version-store";
import type { StoredVersion } from "./version-store";
import { templatesProviderFor } from "./templates";

/**
 * Demo version-history provider over that same store, memoised per template
 * name — the rule every provider here follows, because `init()` re-runs on a
 * locale or config change and a fresh provider each time would be churn around
 * one stored document.
 */
const versionHistoryProviders = new Map<string, VersionHistoryProvider>();

export function versionHistoryProviderFor(
  template?: TemplateOption,
): VersionHistoryProvider {
  const name = template?.name ?? SCRATCH_TEMPLATE_NAME;
  const cached = versionHistoryProviders.get(name);
  if (cached) return cached;

  const store = versionStoreFor(name);
  const templates = templatesProviderFor(template);

  function requireVersion(versionId: string): StoredVersion {
    const version = store.read().find((v) => v.id === versionId);
    if (!version) throw new Error(`No version stored under "${versionId}"`);
    return version;
  }

  const base: VersionHistoryProvider = {
    // The demo store holds everything in localStorage, so one page is the
    // whole history and there is no `nextCursor` to hand back.
    list: async () => ({
      versions: store.read().map((version, index) => {
        const entry: TemplateVersion = {
          id: version.id,
          createdAt: version.createdAt,
          isAutomatic: version.isAutomatic,
        };
        // The hint, on the recent entries only — see HYDRATED_VERSIONS.
        if (index < HYDRATED_VERSIONS) entry.content = version.content;
        return entry;
      }),
    }),
    get: async (_templateId, versionId) => requireVersion(versionId).content,
    create: async (_templateId, content) => {
      const version = store.append(content, false);
      return {
        id: version.id,
        createdAt: version.createdAt,
        isAutomatic: false,
        content: version.content,
      };
    },
    // The one-line composition the contract documents for a backend with no
    // atomic restore endpoint: read the old content, then save it. It is
    // append-only for free, because this demo's `save` records a version.
    restore: async (templateId, versionId) => {
      const content = requireVersion(versionId).content;
      // Belt-and-braces: templatesProviderFor always returns a real save, and
      // a withheld one is enforced in config/capabilities/version-history.ts.
      if (typeof templates.save !== "function") {
        throw new Error("Templates provider is read-only — cannot restore.");
      }
      return templates.save(templateId, { content });
    },
  };

  versionHistoryProviders.set(name, base);
  return base;
}
