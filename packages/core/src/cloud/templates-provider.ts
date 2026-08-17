import type {
  Template,
  TemplateContent,
  TemplatePatch,
  TemplatesProvider,
} from "@templatical/types";
import { ApiClient } from "./api";
import type { AuthManager } from "./auth";

/**
 * How often a save may also record an automatic version. Cloud's storage, Cloud's
 * number — an editor-side default would be guessing on someone else's behalf.
 */
const AUTO_VERSION_INTERVAL_MS = 60_000;

/**
 * Cloud-backed {@link TemplatesProvider} — the Templatical Cloud adapter for the
 * same save/load contract consumers implement themselves.
 *
 * Auth (JWT via {@link AuthManager}) and project/tenant scoping live entirely on
 * this side of the seam; the editor's header, Cmd+S, autosave and
 * unsaved-changes guard never see them.
 *
 * All three methods are enabled: Cloud's template storage is what the plan pays
 * for, so there is no tier in which a Cloud session can load but not save. A
 * consumer who wants read-only supplies their own provider with `save: false`.
 *
 * **This is also where automatic versions are recorded.** The editor never
 * creates one on its own — whoever implements `save` decides whether a save also
 * records a version, which keeps throttling and retention with the side that
 * pays for the storage. Cloud throttles to one automatic version per
 * {@link AUTO_VERSION_INTERVAL_MS}, so an autosave firing every few seconds does
 * not turn history into a keystroke log. This replaced an editor-side
 * `createSnapshot()` on a timer, which put Cloud's retention policy in the
 * editor.
 *
 * Note `initCloud()` **rejects** a consumer-supplied templates provider, unlike
 * `savedBlocks` and `testEmail`. Those are inert — nothing keys off them. The
 * template id is the join key for collaboration, version history, comments, AI
 * rewrite, scoring and the server-side export, so an id Cloud never issued would
 * degrade all six silently.
 */
export function createCloudTemplatesProvider(
  authManager: AuthManager,
): TemplatesProvider {
  const api = new ApiClient(authManager);

  // `0` rather than `Date.now()`: the first save of a session always records a
  // version, so a short session that saves once still has history.
  let lastAutoVersionAt = 0;

  /**
   * Fire-and-forget: a version is a convenience on top of a save that already
   * succeeded, so a failing history endpoint must not turn a successful save
   * into a failed one. The clock advances before the request, so a slow endpoint
   * can't let a burst of saves queue several at once.
   *
   * Logged rather than swallowed: history quietly not filling up is exactly the
   * kind of failure nobody notices until they need a version that was never
   * recorded.
   */
  function maybeRecordVersion(
    templateId: string,
    content: TemplateContent,
  ): void {
    const now = Date.now();
    if (now - lastAutoVersionAt < AUTO_VERSION_INTERVAL_MS) return;
    lastAutoVersionAt = now;
    void api.createVersion(templateId, content).catch((error: unknown) => {
      console.warn(
        "[Templatical] Automatic version not recorded — the save itself succeeded:",
        error,
      );
    });
  }

  return {
    load(id: string): Promise<Template> {
      return api.getTemplate(id);
    },
    create(input: {
      name?: string;
      content: TemplateContent;
    }): Promise<Template> {
      return api.createTemplate(input.content, input.name);
    },
    async save(id: string, patch: TemplatePatch): Promise<Template> {
      // Forwarded verbatim: the endpoint speaks the same patch shape, so this
      // adapter only supplies auth and scoping. `name` is inert until the backend
      // stores the column, then live with no SDK change.
      const template = await api.updateTemplate(id, patch);
      // Only content changes are worth a version — a rename patch carries no
      // content, and versioning one would record a duplicate of the last state.
      if (patch.content) maybeRecordVersion(id, patch.content);
      return template;
    },
  };
}
