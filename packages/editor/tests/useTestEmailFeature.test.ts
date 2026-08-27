// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { computed, defineComponent, h, ref } from "vue";
import { mount } from "@vue/test-utils";
import type { TemplateContent, TestEmailProvider } from "@templatical/types";
import {
  useTestEmailFeature,
  type UseTestEmailFeatureReturn,
} from "../src/composables/useTestEmailFeature";
import { logger } from "../src/utils/logger";

/**
 * `tryLoadRenderer` is what tells a missing `@templatical/renderer` apart from a
 * template that failed to render — the whole basis of the degradation ladder, so
 * it's mocked rather than exercised against a real install.
 */
vi.mock("../src/utils/toMjml", () => ({
  tryLoadRenderer: vi.fn(),
  toMjmlForInstance: vi.fn(),
}));
import { tryLoadRenderer } from "../src/utils/toMjml";

const CONTENT = { blocks: [], settings: {} } as unknown as TemplateContent;

function createProvider(
  overrides: Partial<TestEmailProvider> = {},
): TestEmailProvider {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** `useTestEmailFeature` registers `onScopeDispose`, so it must run in a scope. */
function withFeature(options: {
  provider?: TestEmailProvider;
  renderMjml?: () => Promise<string>;
  isAvailable?: () => boolean;
  onError?: (error: Error) => void;
}) {
  const provider = options.provider ?? createProvider();
  let feature!: UseTestEmailFeatureReturn;

  const wrapper = mount(
    defineComponent({
      setup() {
        feature = useTestEmailFeature({
          provider,
          getContent: () => CONTENT,
          renderMjml: options.renderMjml,
          isAvailable: options.isAvailable,
          onError: options.onError,
        });
        return () => h("div");
      },
    }),
  );

  return { feature, provider, wrapper };
}

/** The payload the provider's `send` was called with. */
function payloadOf(provider: TestEmailProvider) {
  return vi.mocked(provider.send).mock.calls[0][0];
}

describe("useTestEmailFeature", () => {
  beforeEach(() => {
    vi.mocked(tryLoadRenderer).mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("dialog state", () => {
    it("starts closed with nothing in flight", () => {
      const { feature } = withFeature({});

      expect(feature.isModalOpen.value).toBe(false);
      expect(feature.isSending.value).toBe(false);
      expect(feature.justSent.value).toBe(false);
      expect(feature.error.value).toBeNull();
    });

    it("open() opens it, close() closes it", () => {
      const { feature } = withFeature({});

      feature.open();
      expect(feature.isModalOpen.value).toBe(true);

      feature.close();
      expect(feature.isModalOpen.value).toBe(false);
    });

    it("open() is a no-op while unavailable", () => {
      const { feature } = withFeature({ isAvailable: () => false });

      feature.open();

      expect(feature.isModalOpen.value).toBe(false);
    });

    it("reopening clears a stale error", async () => {
      const provider = createProvider({
        send: vi.fn().mockRejectedValue(new Error("nope")),
      });
      const { feature } = withFeature({ provider });

      feature.open();
      await feature.send("a@b.com");
      expect(feature.error.value).toEqual({
        kind: "provider",
        message: "nope",
      });

      feature.close();
      feature.open();

      expect(feature.error.value).toBeNull();
    });
  });

  describe("sending", () => {
    it("passes the recipient and current content to the provider", async () => {
      const { feature, provider } = withFeature({});

      await feature.send("a@b.com");

      expect(provider.send).toHaveBeenCalledTimes(1);
      expect(payloadOf(provider)).toEqual({
        recipient: "a@b.com",
        content: CONTENT,
      });
    });

    it("shows success, then closes itself after the confirmation delay", async () => {
      const { feature } = withFeature({});
      feature.open();

      await feature.send("a@b.com");

      expect(feature.justSent.value).toBe(true);
      expect(feature.isModalOpen.value).toBe(true);
      expect(feature.isSending.value).toBe(false);

      await vi.advanceTimersByTimeAsync(1200);

      expect(feature.isModalOpen.value).toBe(false);
      expect(feature.justSent.value).toBe(false);
    });

    it("keeps the dialog open on failure and reports the message", async () => {
      const onError = vi.fn();
      const provider = createProvider({
        send: vi.fn().mockRejectedValue(new Error("mail server said no")),
      });
      const { feature } = withFeature({ provider, onError });
      feature.open();

      await feature.send("a@b.com");

      expect(feature.error.value).toEqual({
        kind: "provider",
        message: "mail server said no",
      });
      expect(feature.isModalOpen.value).toBe(true);
      expect(feature.justSent.value).toBe(false);
      expect(feature.isSending.value).toBe(false);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("wraps a non-Error rejection", async () => {
      const provider = createProvider({
        send: vi.fn().mockRejectedValue("just a string"),
      });
      const { feature } = withFeature({ provider });

      await feature.send("a@b.com");

      expect(feature.error.value).toEqual({
        kind: "provider",
        message: "just a string",
      });
    });

    it("ignores a second send while one is in flight", async () => {
      let release!: () => void;
      const provider = createProvider({
        send: vi.fn(
          () =>
            new Promise<void>((resolve) => {
              release = resolve;
            }),
        ),
      });
      const { feature } = withFeature({ provider });

      const first = feature.send("a@b.com");
      expect(feature.isSending.value).toBe(true);

      await feature.send("c@d.com");
      expect(provider.send).toHaveBeenCalledTimes(1);

      release();
      await first;
      expect(feature.isSending.value).toBe(false);
    });

    it("does not leave a timer running past unmount", async () => {
      const { feature, wrapper } = withFeature({});
      feature.open();
      await feature.send("a@b.com");

      wrapper.unmount();
      // Would throw or flip state on a disposed scope if the timer survived.
      await vi.advanceTimersByTimeAsync(2000);

      expect(feature.justSent.value).toBe(true);
    });
  });

  describe("onSent", () => {
    it("fires once with the payload send was given after a successful send", async () => {
      const onSent = vi.fn();
      const provider = createProvider({ onSent });
      const { feature } = withFeature({ provider });

      await feature.send("a@b.com");

      expect(onSent).toHaveBeenCalledTimes(1);
      expect(onSent).toHaveBeenCalledWith({
        recipient: "a@b.com",
        content: CONTENT,
      });
      // The exact object `send` received, not a re-derived copy.
      expect(vi.mocked(onSent).mock.calls[0][0]).toBe(payloadOf(provider));
    });

    it("does not fire when send rejects", async () => {
      const onSent = vi.fn();
      const provider = createProvider({
        onSent,
        send: vi.fn().mockRejectedValue(new Error("mail server said no")),
      });
      const { feature } = withFeature({ provider });

      await feature.send("a@b.com");

      expect(onSent).not.toHaveBeenCalled();
      expect(feature.error.value).toEqual({
        kind: "provider",
        message: "mail server said no",
      });
    });

    it("a throwing handler does not fail the send — the modal still reaches success", async () => {
      const onSent = vi.fn(() => {
        throw new Error("handler exploded");
      });
      const onError = vi.fn();
      const provider = createProvider({ onSent });
      const { feature } = withFeature({ provider, onError });
      feature.open();

      await feature.send("a@b.com");

      expect(onSent).toHaveBeenCalledTimes(1);
      // The state the dialog actually keys off for success — "the awaited
      // call didn't reject" alone would also be true if onSent were never
      // wired in at all.
      expect(feature.justSent.value).toBe(true);
      expect(feature.isModalOpen.value).toBe(true);
      expect(feature.error.value).toBeNull();
      // The throw is reported, not silently dropped — the same channel
      // `@templatical/core`'s `notifyHandler` reports handler throws through.
      expect(onError).toHaveBeenCalledTimes(1);
      expect(vi.mocked(onError).mock.calls[0][0].message).toBe(
        "handler exploded",
      );

      await vi.advanceTimersByTimeAsync(1200);

      expect(feature.isModalOpen.value).toBe(false);
      expect(feature.justSent.value).toBe(false);
    });
  });

  /**
   * The four rows of the `includeMjml` ladder. Rows 3 and 4 are the reason
   * `tryLoadRenderer` exists as a separate helper: a missing package degrades,
   * a broken template does not.
   */
  describe("includeMjml degradation ladder", () => {
    it("row 1: flag unset — never renders, and omits the key", async () => {
      const renderMjml = vi.fn();
      const { feature, provider } = withFeature({ renderMjml });

      await feature.send("a@b.com");

      expect(renderMjml).not.toHaveBeenCalled();
      expect("mjml" in payloadOf(provider)).toBe(false);
    });

    it("row 2: flag set + renderer present — includes the MJML", async () => {
      const provider = createProvider({ includeMjml: true });
      const { feature } = withFeature({
        provider,
        renderMjml: vi.fn().mockResolvedValue("<mjml></mjml>"),
      });

      await feature.send("a@b.com");

      expect(payloadOf(provider).mjml).toBe("<mjml></mjml>");
    });

    it("row 3: flag set + renderer missing — sends JSON only and warns once", async () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
      vi.mocked(tryLoadRenderer).mockResolvedValue(null);
      const provider = createProvider({ includeMjml: true });
      const { feature } = withFeature({
        provider,
        renderMjml: vi.fn().mockRejectedValue(new Error("not installed")),
      });

      await feature.send("a@b.com");
      await feature.send("a@b.com");

      // Still sent, twice — opting in must never break sending.
      expect(provider.send).toHaveBeenCalledTimes(2);
      expect("mjml" in payloadOf(provider)).toBe(false);
      expect(feature.error.value).toBeNull();
      // Warned once across both attempts, not per send.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain("@templatical/renderer");
      warn.mockRestore();
    });

    it("row 4: flag set + render throws — fails the send", async () => {
      vi.mocked(tryLoadRenderer).mockResolvedValue(
        {} as Awaited<ReturnType<typeof tryLoadRenderer>>,
      );
      const provider = createProvider({ includeMjml: true });
      const { feature } = withFeature({
        provider,
        renderMjml: vi.fn().mockRejectedValue(new Error("bad custom block")),
      });

      await feature.send("a@b.com");

      // Nothing sent: a broken template must not silently ship as JSON.
      expect(provider.send).not.toHaveBeenCalled();
      expect(feature.error.value).toEqual({
        kind: "provider",
        message: "bad custom block",
      });
    });
  });

  describe("allowlist", () => {
    it("is available and unrestricted when allowedRecipients is omitted", () => {
      const { feature } = withFeature({});

      expect(feature.isAvailable.value).toBe(true);
      expect(feature.allowedRecipients.value).toBeUndefined();
    });

    it("is available with one or more entries", () => {
      const { feature } = withFeature({
        provider: createProvider({ allowedRecipients: ["a@b.com"] }),
      });

      expect(feature.isAvailable.value).toBe(true);
      expect(feature.allowedRecipients.value).toEqual(["a@b.com"]);
    });

    /* `[]` is a decision ("nobody may be sent to"), not "unset" — so the whole
       feature reports itself unavailable and no trigger renders. */
    it("is UNAVAILABLE with an explicitly empty allowlist", () => {
      const { feature } = withFeature({
        provider: createProvider({ allowedRecipients: [] }),
      });

      expect(feature.isAvailable.value).toBe(false);
    });

    it("refuses an off-list recipient without calling the provider", async () => {
      const provider = createProvider({ allowedRecipients: ["ok@b.com"] });
      const { feature } = withFeature({ provider });

      await feature.send("sneaky@evil.com");

      expect(provider.send).not.toHaveBeenCalled();
      expect(feature.error.value).toEqual({ kind: "recipientNotAllowed" });
    });

    it("echoes the allowlist in the payload when configured", async () => {
      const provider = createProvider({
        allowedRecipients: ["ok@b.com", "also@b.com"],
      });
      const { feature } = withFeature({ provider });

      await feature.send("ok@b.com");

      expect(payloadOf(provider).allowedRecipients).toEqual([
        "ok@b.com",
        "also@b.com",
      ]);
    });

    it("OMITS the key entirely when no allowlist is configured", async () => {
      const { feature, provider } = withFeature({});

      await feature.send("a@b.com");

      // Absence, not `undefined` — an unconditional key would leak into every
      // consumer's payload.
      expect("allowedRecipients" in payloadOf(provider)).toBe(false);
    });

    /**
     * The regression this guards is invisible until a Cloud session shows no
     * button: Cloud exposes `allowedRecipients` as a getter over a value that
     * arrives with its JWT, so the feature must read it inside a computed rather
     * than snapshot it at setup.
     */
    it("tracks a getter-backed list that fills after setup", async () => {
      const backing = ref<string[]>([]);
      const provider: TestEmailProvider = {
        send: vi.fn().mockResolvedValue(undefined),
        get allowedRecipients() {
          return backing.value;
        },
      };
      const { feature } = withFeature({ provider });

      // Pre-auth: empty list ⇒ unavailable.
      expect(feature.isAvailable.value).toBe(false);

      backing.value = ["late@b.com"];

      expect(feature.isAvailable.value).toBe(true);
      expect(feature.allowedRecipients.value).toEqual(["late@b.com"]);
    });
  });

  describe("defaultRecipient", () => {
    it("passes through when unrestricted", () => {
      const { feature } = withFeature({
        provider: createProvider({ defaultRecipient: "me@b.com" }),
      });

      expect(feature.defaultRecipient.value).toBe("me@b.com");
    });

    it("passes through when it is on the allowlist", () => {
      const { feature } = withFeature({
        provider: createProvider({
          allowedRecipients: ["me@b.com", "other@b.com"],
          defaultRecipient: "other@b.com",
        }),
      });

      expect(feature.defaultRecipient.value).toBe("other@b.com");
    });

    it("is ignored when it is NOT on the allowlist", () => {
      const { feature } = withFeature({
        provider: createProvider({
          allowedRecipients: ["me@b.com"],
          defaultRecipient: "elsewhere@b.com",
        }),
      });

      expect(feature.defaultRecipient.value).toBeUndefined();
    });
  });

  describe("capability", () => {
    it("exposes open + reactive availability for shared UI", () => {
      const gate = ref(false);
      const { feature } = withFeature({ isAvailable: () => gate.value });

      expect(feature.capability.isAvailable.value).toBe(false);

      gate.value = true;

      expect(feature.capability.isAvailable.value).toBe(true);
      feature.capability.open();
      expect(feature.isModalOpen.value).toBe(true);
    });

    it("shares one availability signal with the feature", () => {
      const { feature } = withFeature({
        provider: createProvider({ allowedRecipients: [] }),
      });

      expect(feature.capability.isAvailable.value).toBe(
        feature.isAvailable.value,
      );
      expect(computed(() => feature.capability.isAvailable.value).value).toBe(
        false,
      );
    });
  });
});
