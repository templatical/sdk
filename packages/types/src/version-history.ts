import type { Template } from "./templates";
import type { TemplateContent } from "./template";

/**
 * One recorded version of a template.
 *
 * Called a *version* rather than a snapshot deliberately: "snapshot" is an
 * implementation word, and it collides with the editor's undo/redo history,
 * which is a different thing entirely (in-session, unsaved, per-keystroke).
 */
export interface TemplateVersion {
  /** Store-assigned. The editor never generates one. */
  id: string;
  /** ISO 8601. Drives the relative-time label in the history dropdown. */
  createdAt: string;
  /**
   * Recorded by a save rather than by a person. Drives the "auto" badge, and is
   * where a future filter would key off.
   */
  isAutomatic?: boolean;
  /** Short human label, when your store lets someone name a version. */
  label?: string;
  author?: { id?: string; name?: string };
  /**
   * Optional eager content — a **cache hint**, never an alternative to
   * {@link VersionHistoryProvider.get}.
   *
   * When present the editor previews this version instantly and never calls
   * `get` for it. Evaluated **per entry**, so a provider may hydrate the recent
   * versions and omit the older ones.
   *
   * This exists because scrubbing through history is synchronous: once the
   * preview is open, stepping to another version swaps the canvas in the same
   * tick. A provider that eager-loads keeps that; one that omits `content` pays
   * a single round-trip the first time each version is visited, and the editor
   * caches it thereafter.
   */
  content?: TemplateContent;
}

/**
 * Reserved. Nothing populates this yet — it exists so pagination can land here
 * without breaking every implementation, the same precedent
 * `SavedBlocksListParams` set.
 *
 * The editor always calls `list` bare; only headless callers populate it.
 */
export interface VersionHistoryListParams {}

/**
 * Storage contract for a template's version history.
 *
 * Pass an implementation as `versionHistory` to `init()` or `initCloud()`. With
 * no provider the history control does not render and none of its UI is
 * downloaded.
 *
 * **The editor never creates versions on its own.** Whoever implements
 * `TemplatesProvider.save` decides whether a save also records a version, which
 * keeps throttling, retention and dedupe policy on the side that pays for the
 * storage. {@link create} is for versions a *person* asks for.
 *
 * ```ts
 * const provider: VersionHistoryProvider = {
 *   list: (templateId) =>
 *     fetch(`/api/templates/${templateId}/versions`).then((r) => r.json()),
 *   get: (templateId, versionId) =>
 *     fetch(`/api/templates/${templateId}/versions/${versionId}`)
 *       .then((r) => r.json())
 *       .then((v) => v.content),
 *   create: false,
 *   // No atomic restore endpoint? Compose it: read the old content, save it.
 *   restore: async (templateId, versionId) => {
 *     const content = await provider.get(templateId, versionId);
 *     return templates.save(templateId, { content });
 *   },
 * };
 * ```
 */
export interface VersionHistoryProvider {
  /**
   * The versions to offer, newest first. The editor renders this order verbatim
   * and never re-sorts — ordering is your store's call.
   */
  list(
    templateId: string,
    params?: VersionHistoryListParams,
  ): Promise<TemplateVersion[]>;
  /**
   * Fetch one version's content. **The operation, and always required** — the
   * editor must always be able to obtain a version's content.
   * {@link TemplateVersion.content} is the optimisation, and optimisations don't
   * get to be mandatory.
   */
  get(templateId: string, versionId: string): Promise<TemplateContent>;
  /**
   * Record the current content as a version on demand, or `false` to disable
   * it — the editor then offers no way to create one by hand, and the history
   * is whatever `save` recorded.
   *
   * `false`-able and required rather than optional, mirroring
   * `SavedBlocksProvider` and `TemplatesProvider`: disabling is a decision you
   * state, never something you get by forgetting a method.
   */
  create:
    | false
    | ((
        templateId: string,
        content: TemplateContent,
        meta?: { label?: string },
      ) => Promise<TemplateVersion>);
  /**
   * Make a past version current and return the resulting template, or `false`
   * to make history read-only — versions can then be browsed and previewed, but
   * the Restore action does not render.
   *
   * **History is append-only:** a restore adds an entry rather than rewriting
   * one, so undo stays coherent and two backends can't disagree about what
   * history looks like afterwards. A store with no atomic endpoint composes it
   * in one line — `get` the old content, then `save` it — accepting two
   * round-trips and a narrower failure window.
   */
  restore:
    false | ((templateId: string, versionId: string) => Promise<Template>);
}
