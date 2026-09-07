import type { TestEmailProvider } from "@templatical/types";
import { testEmailProvider } from "@/providers/test-email";
import type { CapabilityDef } from "../types";

/** The two demo addresses `testEmailProvider` pins as its allowlist. */
const PINNED_RECIPIENTS = ["you@example.com", "teammate@example.com"];

/**
 * Send-a-test-of-this-template, through the playground's always-on fake
 * sender. `implFor` returns the same module-level `testEmailProvider` every
 * time — unlike saved blocks or comments, a sender has no per-template store
 * to memoise.
 *
 * `allowedRecipients` has no control, deliberately: `useTestEmailFeature`'s
 * `isAvailable` is false for an empty list, and CLAUDE.md is explicit that
 * the list must never be destructured — Cloud implements it as a getter that
 * fills in after setup, so a control that could empty it would delete the
 * whole feature with no explanation. `defaultRecipient` is the safe control
 * instead: an `enum` over the same two pinned addresses.
 */
export const testEmailCapability: CapabilityDef<TestEmailProvider> = {
  id: "test-email",
  group: "backend",
  title: "Test email",
  blurb:
    "Users send a test of the template through your own infrastructure; the editor owns the trigger and the dialog.",
  fixture: "product-launch",
  controls: [
    {
      kind: "boolean",
      path: "testEmail.includeMjml",
      label: "includeMjml",
      help: "Off omits the mjml field from the payload rather than sending it empty.",
      default: true,
    },
    {
      kind: "enum",
      path: "testEmail.defaultRecipient",
      label: "default recipient",
      help: "Pre-fills which pinned address the dialog opens with.",
      options: PINNED_RECIPIENTS,
      default: PINNED_RECIPIENTS[0],
    },
  ],
  implFor: () => testEmailProvider,
  build: (state, impl) => {
    // Always defined: this capability declares `implFor`, so
    // `buildAllCapabilityConfig` never calls `build` without a live instance —
    // only a capability with no `implFor` at all ever receives `undefined`.
    impl = impl!;
    return {
      // `Object.assign` onto the provider itself, never `{ ...impl }`.
      //
      // A spread reads every own property once and stores the results, so a
      // getter becomes a static value at the moment `build()` ran. That is
      // the snapshot CLAUDE.md forbids for `allowedRecipients`: Cloud's
      // adapter implements it as a getter over a list that arrives with the
      // JWT, starting `[]` — and `[]` means "nobody", so
      // `useTestEmailFeature.isAvailable` goes false and no trigger renders
      // at all. Re-reading `impl.allowedRecipients` into a new object does
      // not help; that is still one read at build time rather than the live
      // property the editor's own computed re-reads.
      //
      // CLAUDE.md's Cloud seam uses `Object.assign` for exactly this reason.
      // This demo provider holds a plain array, so a spread would not break
      // anything visible today — which is why it is worth being deliberate
      // here rather than copying the idiom the other four capabilities use.
      testEmail: Object.assign(impl, {
        includeMjml: state["testEmail.includeMjml"] === true,
        defaultRecipient: state["testEmail.defaultRecipient"] as string,
      }),
    };
  },
};
