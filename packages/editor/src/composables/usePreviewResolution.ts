import {
  isRenderableTemplateContent,
  safeClone,
  type PreviewResolveContext,
  type PreviewResolveTrigger,
  type ResolvePreview,
  type TemplateContent,
} from "@templatical/types";
import {
  computed,
  onScopeDispose,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from "vue";

/**
 * Runs the consumer's `resolvePreview` hook and owns everything about its
 * lifecycle: debouncing, discarding stale results, shape-checking what comes
 * back, and degrading when it fails.
 *
 * Every preview surface reads `content` from here rather than calling the hook
 * itself, so the failure and loading behaviour cannot diverge between the
 * editor's preview mode and the test-email dialog.
 *
 * Not to be confused with `MergeTag.sample`, which substitutes value tags at
 * *display* time. This hook exists for **logic** tags: branching cannot be
 * evaluated client-side for every supported syntax, so only a backend can do
 * it. When a resolver is configured it supersedes samples entirely — see
 * `supersedesSamples`.
 */

/** How long to wait before resolving, matching `useTemplateLint`'s debounce. */
const DEBOUNCE_MS = 500;

export interface UsePreviewResolutionOptions {
  /** The consumer's hook. `undefined` disables the whole feature. */
  resolvePreview?: ResolvePreview;
  /** The template to resolve, read live so edits are picked up on re-resolve. */
  getContent: () => TemplateContent;
  /**
   * Whether a preview is currently showing. Resolution only runs while true,
   * so an editor that never enters preview mode never calls the hook.
   */
  isActive: () => boolean;
  /** The recipient to resolve for, when the surface has one. */
  getRecipient?: () => string | undefined;
  /** Active template language; switching it invalidates cached and pending results. */
  getLocale?: () => string | null | undefined;
}

export interface UsePreviewResolutionReturn {
  /** True when the consumer configured a hook. */
  isConfigured: boolean;
  /**
   * The content preview surfaces should render: the resolved template, or the
   * unresolved one while resolving has not produced a result (including after
   * a failure).
   */
  content: ComputedRef<TemplateContent>;
  /** True while a resolve call is outstanding. */
  isResolving: Ref<boolean>;
  /**
   * True while the first resolve since activation or locale reset is in flight.
   * Later requests keep the last settled view, including the unresolved
   * template and failure note after a failed resolve.
   */
  isInitialResolve: ComputedRef<boolean>;
  /** True when the last attempt failed or returned something unrenderable. */
  hasFailed: Ref<boolean>;
  /**
   * True whenever a resolver is **configured** — deliberately not "…and has
   * produced content".
   *
   * A resolver is the consumer's declared intent for how previews should read,
   * so samples are off from the first frame: gating on a landed result made the
   * Sample/Label toggle appear for the debounce plus the resolver's latency and
   * then vanish, which looks like a bug. It also keeps the failure note honest —
   * it says the *unresolved* template is showing, which is only true if samples
   * aren't substituting into the fallback.
   */
  supersedesSamples: ComputedRef<boolean>;
  /** Re-run the active resolver immediately, superseding queued or in-flight work. */
  refresh: () => void;
}

export function usePreviewResolution(
  options: UsePreviewResolutionOptions,
): UsePreviewResolutionReturn {
  const isConfigured = typeof options.resolvePreview === "function";

  const resolved = ref<TemplateContent | null>(null);
  const isResolving = ref(false);
  const hasFailed = ref(false);
  const hasSettled = ref(false);

  /**
   * Bumped on every request. A response is applied only if its token is still
   * current, which is what discards a slow resolve that a newer one has
   * superseded — otherwise switching recipient twice could land the first
   * answer last.
   */
  let token = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function run(trigger: PreviewResolveTrigger): Promise<void> {
    const hook = options.resolvePreview;
    if (!hook) return;

    const mine = ++token;
    isResolving.value = true;

    // A copy, so a resolver that mutates what it is given cannot reach editor
    // state. `safeClone` rather than a naked stringify, per the repo's
    // cycle-safety rule.
    const context: PreviewResolveContext = {
      content: safeClone(options.getContent()),
      trigger,
      ...(options.getRecipient?.() !== undefined
        ? { recipient: options.getRecipient() }
        : {}),
    };

    try {
      const next = await hook(context);
      if (mine !== token) return; // superseded
      if (!isRenderableTemplateContent(next)) {
        // A consumer bug or a mis-shaped API response degrades to the
        // unresolved template rather than throwing inside the render.
        hasFailed.value = true;
        resolved.value = null;
        return;
      }
      resolved.value = next;
      hasFailed.value = false;
    } catch {
      if (mine !== token) return;
      // Deliberately not routed to `config.onError`: a degraded preview is
      // user-visible and non-fatal, and reporting it there reads as more
      // severe than it is.
      hasFailed.value = true;
      resolved.value = null;
    } finally {
      if (mine === token) {
        hasSettled.value = true;
        isResolving.value = false;
      }
    }
  }

  function schedule(trigger: PreviewResolveTrigger): void {
    if (!isConfigured) return;
    clearTimer();

    // Nothing has settled yet — resolve **now**, no debounce. Debouncing the
    // first resolve is pure latency: there is nothing to coalesce at the moment
    // a preview opens, and waiting meant the unresolved template rendered for
    // 500ms before the skeleton even appeared. Showing edit-like content and
    // *then* a skeleton is worse than either on its own.
    //
    // `run()` sets `isResolving` synchronously before its first await, so the
    // skeleton is up in the same frame as the click.
    if (!hasSettled.value && trigger !== "recipient") {
      void run(trigger);
      return;
    }

    // A recipient change always debounces, including before the first answer
    // lands: typing an address coalesces into one call and leaves the pending
    // `open` call (which may be waiting on the host's own picker) to finish.
    timer = setTimeout(() => {
      timer = null;
      void run(trigger);
    }, DEBOUNCE_MS);
  }

  function refresh(): void {
    if (!isConfigured || !options.isActive()) return;
    clearTimer();
    void run("refresh");
  }

  // Resolve when a preview opens or its recipient or locale changes. Content
  // is intentionally not watched: an edit must not request a backend resolve.
  watch(
    () =>
      [
        options.isActive(),
        options.getRecipient?.(),
        options.getLocale?.(),
      ] as const,
    ([active, recipient, locale], previous) => {
      if (previous && locale !== previous[2]) {
        clearTimer();
        token++;
        resolved.value = null;
        isResolving.value = false;
        hasFailed.value = false;
        hasSettled.value = false;
      }
      if (!active) {
        // Leaving a preview cancels an in-flight resolve and drops the result,
        // so reopening resolves fresh rather than showing stale data.
        clearTimer();
        token++;
        isResolving.value = false;
        resolved.value = null;
        hasFailed.value = false;
        hasSettled.value = false;
        return;
      }
      const trigger: PreviewResolveTrigger | null =
        !previous || !previous[0]
          ? "open"
          : locale !== previous[2]
            ? "locale"
            : recipient !== previous[1]
              ? "recipient"
              : null;
      // A source can re-fire with the same values (`getLocale` reading a
      // replaced content object in the same language). Nothing the host cares
      // about changed, so nothing is resolved.
      if (trigger === null) return;
      schedule(trigger);
    },
    { immediate: true, flush: "sync" },
  );

  onScopeDispose(() => {
    clearTimer();
    token++;
  });

  return {
    isConfigured,
    content: computed(() => resolved.value ?? options.getContent()),
    isResolving,
    isInitialResolve: computed(() => isResolving.value && !hasSettled.value),
    hasFailed,
    supersedesSamples: computed(() => isConfigured),
    refresh,
  };
}
