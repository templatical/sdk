import { computed, onScopeDispose, ref, type ComputedRef, type Ref } from "vue";
import type { TemplateContent, TestEmailProvider } from "@templatical/types";
import { logger } from "../utils/logger";
import { tryLoadRenderer } from "../utils/toMjml";
import type { EditorCapabilities } from "../types/editor-capabilities";

/** How long the dialog shows its success confirmation before closing itself. */
const SUCCESS_DISMISS_MS = 1200;

/**
 * Why a send failed.
 *
 * Split by origin so the dialog knows whether it may render the text directly.
 * A provider's message is already user-presentable and is passed through
 * verbatim; an editor-generated refusal carries no text, because only the
 * component has the active locale.
 */
export type TestEmailError =
  { kind: "provider"; message: string } | { kind: "recipientNotAllowed" };

export interface UseTestEmailFeatureOptions {
  /** Sending backend — consumer-supplied in OSS, the Cloud adapter in Cloud. */
  provider: TestEmailProvider;
  /** The template to send. Read at send time, never snapshotted. */
  getContent: () => TemplateContent;
  /**
   * Render the current template to MJML. Supplied by the entry point, which
   * already owns the `ToMjmlSource` for `editor.toMjml()`, so this composable
   * never learns about custom-block resolvers or stylesheets.
   *
   * Only ever called when the provider set `includeMjml`.
   */
  renderMjml?: () => Promise<string>;
  onError?: (error: Error) => void;
  /**
   * Extra gate on top of the provider being present — Cloud adds its plan
   * entitlement and "template must be saved" here. Read reactively.
   */
  isAvailable?: () => boolean;
}

export interface UseTestEmailFeatureReturn {
  isModalOpen: Ref<boolean>;
  open: () => void;
  close: () => void;
  isSending: Ref<boolean>;
  /** True for a moment after a successful send, while the dialog confirms. */
  justSent: Ref<boolean>;
  error: Ref<TestEmailError | null>;
  send: (recipient: string) => Promise<void>;
  /**
   * The provider's allowlist, or `undefined` when unrestricted.
   *
   * A computed rather than a snapshot: Cloud exposes `allowedRecipients` as a
   * getter over a value that arrives with its JWT, so reading it once at setup
   * would freeze it at `[]` forever.
   */
  allowedRecipients: ComputedRef<string[] | undefined>;
  defaultRecipient: ComputedRef<string | undefined>;
  isAvailable: ComputedRef<boolean>;
  capability: NonNullable<EditorCapabilities["testEmail"]>;
}

export function useTestEmailFeature(
  options: UseTestEmailFeatureOptions,
): UseTestEmailFeatureReturn {
  const { provider } = options;

  const isModalOpen = ref(false);
  const isSending = ref(false);
  const justSent = ref(false);
  const error = ref<TestEmailError | null>(null);

  let dismissTimer: ReturnType<typeof setTimeout> | null = null;
  /** One warning per editor instance, not per send — a retry shouldn't re-log. */
  let warnedAboutRenderer = false;

  function clearDismissTimer(): void {
    if (dismissTimer !== null) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  }

  // The timer outlives a fast unmount otherwise, and fires into dead refs.
  onScopeDispose(clearDismissTimer);

  // IMPORTANT: read `provider.allowedRecipients` *inside* the computed. Cloud's
  // adapter implements it as a getter over a reactive source that starts empty
  // and fills once auth resolves — destructuring it at setup would pin it to
  // `[]`, which (see `isAvailable`) hides the trigger permanently.
  const allowedRecipients = computed(() => provider.allowedRecipients);

  const defaultRecipient = computed(() => {
    const preferred = provider.defaultRecipient;
    if (preferred === undefined) return undefined;
    const allowed = allowedRecipients.value;
    // A default outside the allowlist is ignored rather than smuggled in.
    if (allowed && !allowed.includes(preferred)) return undefined;
    return preferred;
  });

  const isAvailable = computed(() => {
    // An explicitly empty allowlist means nobody may be sent to, so the feature
    // is unusable and must not advertise itself. Distinct from `undefined`,
    // which means "unrestricted".
    if (allowedRecipients.value?.length === 0) return false;
    return options.isAvailable?.() ?? true;
  });

  function open(): void {
    if (!isAvailable.value) return;
    // Clear both, or a reopen shows the previous attempt's error or a stale tick
    // of the success state.
    error.value = null;
    justSent.value = false;
    clearDismissTimer();
    isModalOpen.value = true;
  }

  function close(): void {
    clearDismissTimer();
    isModalOpen.value = false;
    justSent.value = false;
  }

  /**
   * Build `payload.mjml` when the provider opted in.
   *
   * Returns `undefined` for the two non-fatal cases (not opted in; opted in but
   * the renderer isn't installed) and **throws** when rendering itself fails —
   * that means the template is broken, and silently sending JSON-only would hide
   * a real defect indefinitely.
   */
  async function resolveMjml(): Promise<string | undefined> {
    if (!provider.includeMjml || !options.renderMjml) return undefined;

    try {
      return await options.renderMjml();
    } catch (err) {
      // Probe only on the failure path, so the happy path pays nothing. A `null`
      // here means the package is genuinely absent; anything else is a render
      // error and belongs to the caller.
      if ((await tryLoadRenderer()) === null) {
        if (!warnedAboutRenderer) {
          warnedAboutRenderer = true;
          logger.warn(
            "testEmail.includeMjml is set but @templatical/renderer is not installed — " +
              "sending the template as JSON only. Install it to receive `payload.mjml`.",
          );
        }
        return undefined;
      }
      throw err;
    }
  }

  async function send(recipient: string): Promise<void> {
    if (isSending.value) return;

    const allowed = allowedRecipients.value;
    if (allowed && !allowed.includes(recipient)) {
      // Unreachable through the picker, reachable by a programmatic open or a
      // tampered field. Refusing keeps a guarantee worth having: the editor
      // never calls `send` with an address outside a configured allowlist.
      error.value = { kind: "recipientNotAllowed" };
      return;
    }

    isSending.value = true;
    error.value = null;

    try {
      const mjml = await resolveMjml();
      await provider.send({
        recipient,
        content: options.getContent(),
        ...(mjml !== undefined ? { mjml } : {}),
        ...(allowed !== undefined ? { allowedRecipients: allowed } : {}),
      });

      justSent.value = true;
      dismissTimer = setTimeout(close, SUCCESS_DISMISS_MS);
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error(String(err));
      error.value = { kind: "provider", message: wrapped.message };
      options.onError?.(wrapped);
      // Deliberately not re-thrown: the dialog surfaces `error` and stays open
      // for a retry, and nothing awaits this beyond the click handler.
    } finally {
      isSending.value = false;
    }
  }

  const capability: NonNullable<EditorCapabilities["testEmail"]> = {
    open,
    isAvailable,
  };

  return {
    isModalOpen,
    open,
    close,
    isSending,
    justSent,
    error,
    send,
    allowedRecipients,
    defaultRecipient,
    isAvailable,
    capability,
  };
}
