import type {
  Template,
  TemplateContent,
  TemplateVersion,
  VersionHistoryListParams,
  VersionHistoryProvider,
} from "@templatical/types";
import { SdkError } from "@templatical/types";
import { computed, ref, type ComputedRef, type Ref } from "vue";

export interface UseVersionHistoryOptions {
  /**
   * Storage backend. Supplied by the consumer via `init({ versionHistory })`,
   * or by Cloud's own adapter — this composable is transport-agnostic and never
   * talks to a network itself.
   */
  provider: VersionHistoryProvider;
  /**
   * Which template's history this is. A getter rather than a value because a
   * session can outlive the template: `initCloud()` constructs the feature at
   * setup and only learns the id once `create()` / `load()` resolves.
   */
  getTemplateId: () => string | null;
  onError?: (error: Error) => void;
}

export interface UseVersionHistoryReturn {
  /** The provider's list, in the provider's order. Never re-sorted. */
  versions: Ref<TemplateVersion[]>;
  isLoading: Ref<boolean>;
  isRestoring: Ref<boolean>;
  /**
   * Cursor for the page after the one currently held, or `undefined` when the
   * provider signalled there is no more. The editor loads one page and ignores
   * this; it is here so a headless caller can page without reaching past the
   * composable.
   */
  nextCursor: Ref<string | undefined>;
  /** Whether the provider supplied each mutation at all. */
  canCreate: ComputedRef<boolean>;
  canRestore: ComputedRef<boolean>;
  /** Re-read the list. The editor calls this bare; `params` is for headless callers. */
  load: (params?: VersionHistoryListParams) => Promise<void>;
  /**
   * The version's content **if it is already in hand** — the provider's
   * `content` hint, or a previous `get` this composable cached. `null` means a
   * round-trip is required.
   *
   * Callers that must not block (scrubbing through history swaps the canvas in
   * the same tick) check this first and only await {@link resolveContent} when
   * it comes back null.
   */
  peekContent: (version: TemplateVersion) => TemplateContent | null;
  /**
   * `version.content ?? await provider.get(...)`, cached per version id, so a
   * lazily-loaded version costs one round-trip on its first visit and nothing
   * afterwards.
   */
  resolveContent: (version: TemplateVersion) => Promise<TemplateContent>;
  /** Rejects with an {@link SdkError} when the provider disabled `create`. */
  create: (
    content: TemplateContent,
    meta?: { label?: string },
  ) => Promise<TemplateVersion>;
  /** Rejects with an {@link SdkError} when the provider disabled `restore`. */
  restore: (versionId: string) => Promise<Template>;
}

/**
 * Reactive state over a {@link VersionHistoryProvider}.
 *
 * Owns the list, the loading flags and the per-version content cache that keeps
 * scrubbing synchronous. Errors are reported through `onError` and re-thrown,
 * leaving the list untouched on failure.
 *
 * It deliberately does **not** create versions of its own accord. The editor
 * never records a version on a save — whoever implements `TemplatesProvider.save`
 * decides that, because they are the side that pays for the storage.
 */
export function useVersionHistory(
  options: UseVersionHistoryOptions,
): UseVersionHistoryReturn {
  const { provider, getTemplateId } = options;

  const versions = ref<TemplateVersion[]>([]);
  const isLoading = ref(false);
  const nextCursor = ref<string | undefined>(undefined);
  const isRestoring = ref(false);

  /**
   * Content fetched through `get`, keyed by version id. A version that carried
   * a `content` hint never lands here — the hint is read straight off the entry,
   * so a provider that eager-loads pays no second copy.
   */
  const fetched = new Map<string, TemplateContent>();

  const canCreate = computed(() => typeof provider.create === "function");
  const canRestore = computed(() => typeof provider.restore === "function");

  /**
   * The UI hides disabled actions and renders nothing before a template exists,
   * so reaching one of these means a programmatic caller went around it. Fail
   * loudly rather than silently no-op: a resolved promise reads as "done".
   */
  function requireTemplateId(action: string): string {
    const templateId = getTemplateId();
    if (!templateId) {
      throw new SdkError(
        `[Templatical] Version history: ${action} needs a template. Call create() or load() first.`,
      );
    }
    return templateId;
  }

  function refuse(action: string): never {
    throw new SdkError(
      `[Templatical] Version history: ${action} is disabled by the provider. Check the capability before calling — the editor's own UI hides the action.`,
    );
  }

  async function load(params?: VersionHistoryListParams): Promise<void> {
    const templateId = requireTemplateId("list");
    isLoading.value = true;
    try {
      const page = await provider.list(templateId, params);
      versions.value = page.versions;
      nextCursor.value = page.nextCursor;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  function peekContent(version: TemplateVersion): TemplateContent | null {
    return version.content ?? fetched.get(version.id) ?? null;
  }

  async function resolveContent(
    version: TemplateVersion,
  ): Promise<TemplateContent> {
    const known = peekContent(version);
    if (known) return known;

    const templateId = requireTemplateId("get");
    try {
      const content = await provider.get(templateId, version.id);
      fetched.set(version.id, content);
      return content;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    }
  }

  async function create(
    content: TemplateContent,
    meta?: { label?: string },
  ): Promise<TemplateVersion> {
    const { create: providerCreate } = provider;
    if (typeof providerCreate !== "function") refuse("create");
    const templateId = requireTemplateId("create");
    try {
      const created = await providerCreate(templateId, content, meta);
      versions.value = [created, ...versions.value];
      return created;
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    }
  }

  async function restore(versionId: string): Promise<Template> {
    const { restore: providerRestore } = provider;
    if (typeof providerRestore !== "function") refuse("restore");
    const templateId = requireTemplateId("restore");
    isRestoring.value = true;
    try {
      return await providerRestore(templateId, versionId);
    } catch (error) {
      options.onError?.(error as Error);
      throw error;
    } finally {
      isRestoring.value = false;
    }
  }

  return {
    nextCursor,
    versions,
    isLoading,
    isRestoring,
    canCreate,
    canRestore,
    load,
    peekContent,
    resolveContent,
    create,
    restore,
  };
}
