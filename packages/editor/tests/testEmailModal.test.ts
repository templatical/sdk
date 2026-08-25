// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import TestEmailModal from "../src/components/TestEmailModal.vue";
import { mountEditor } from "./helpers/mount";
import {
  MERGE_TAGS_KEY,
  MERGE_TAG_SAMPLE_MODE_KEY,
  POPOVER_ROOT_KEY,
} from "../src/keys";
import type { MergeTag } from "@templatical/types";
import { nextTick, ref } from "vue";
import type { TestEmailError } from "../src/composables/useTestEmailFeature";

/**
 * The dialog's three recipient shapes and its two outcome states.
 *
 * The shapes are chosen entirely by the allowlist, with no mode flag:
 * omitted ⇒ free text, one entry ⇒ read-only, several ⇒ a picker. Cloud only
 * ever takes the latter two, so the free-text branch is the one that exists for
 * BYO senders and the one most likely to break unnoticed.
 *
 * TestEmailModal wraps TplModal, which teleports into the injected popover root —
 * so the rendered subtree lives outside `wrapper.element` and assertions query
 * that root directly (same approach as `savedBlocksDialogs.test.ts`).
 */

let popoverRootEl: HTMLElement;

beforeEach(() => {
  popoverRootEl = document.createElement("div");
  popoverRootEl.className = "tpl-popover-root";
  document.body.appendChild(popoverRootEl);
});

afterEach(() => {
  popoverRootEl.remove();
});

/** One tag with a sample, so the dialog's Sample view has something to show. */
const SAMPLED_TAGS: MergeTag[] = [
  { label: "First Name", value: "{{first_name}}", sample: "Ada" },
];

const FIELD = '[data-testid="test-email-recipient"]';
const SEND = '[data-testid="test-email-send"]';
const CANCEL = '[data-testid="test-email-cancel"]';

function get<T extends Element = HTMLElement>(sel: string): T {
  const el = popoverRootEl.querySelector<T>(sel);
  if (!el) throw new Error(`Not found in popover root: ${sel}`);
  return el;
}

function has(sel: string): boolean {
  return popoverRootEl.querySelector(sel) !== null;
}

function text(): string {
  return popoverRootEl.textContent ?? "";
}

function mountModal(
  props: {
    allowedRecipients?: string[];
    defaultRecipient?: string;
    isSending?: boolean;
    justSent?: boolean;
    error?: TestEmailError | null;
    mergeTags?: MergeTag[];
    sampleMode?: boolean;
  } = {},
) {
  return mountEditor(TestEmailModal, {
    props: {
      visible: true,
      isSending: props.isSending ?? false,
      justSent: props.justSent ?? false,
      error: props.error ?? null,
      ...(props.allowedRecipients !== undefined
        ? { allowedRecipients: props.allowedRecipients }
        : {}),
      ...(props.defaultRecipient !== undefined
        ? { defaultRecipient: props.defaultRecipient }
        : {}),
    },
    provides: {
      [POPOVER_ROOT_KEY]: ref(popoverRootEl),
      [MERGE_TAGS_KEY]: props.mergeTags ?? [],
      ...(props.sampleMode !== undefined
        ? { [MERGE_TAG_SAMPLE_MODE_KEY]: ref(props.sampleMode) }
        : {}),
    },
  } as never);
}

/** Drive an input the way a user would, so `v-model` updates. */
async function setValue(el: HTMLInputElement, value: string): Promise<void> {
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
}

async function click(el: Element): Promise<void> {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await nextTick();
}

describe("TestEmailModal recipient shapes", () => {
  it("no allowlist renders a free-text email input", () => {
    mountModal();
    const field = get<HTMLInputElement>(FIELD);

    expect(field.tagName).toBe("INPUT");
    expect(field.getAttribute("type")).toBe("email");
    expect(field.disabled).toBe(false);
  });

  it("one allowed recipient renders a read-only field, pre-filled", () => {
    mountModal({ allowedRecipients: ["only@b.com"] });
    const field = get<HTMLInputElement>(FIELD);

    expect(field.tagName).toBe("INPUT");
    // Disabled, because there is nothing to choose — an editable field would
    // imply otherwise.
    expect(field.disabled).toBe(true);
    expect(field.value).toBe("only@b.com");
  });

  it("several allowed recipients render a picker of exactly those", () => {
    mountModal({ allowedRecipients: ["a@b.com", "c@d.com"] });
    const field = get<HTMLSelectElement>(FIELD);

    expect(field.tagName).toBe("SELECT");
    expect([...field.options].map((o) => o.value)).toEqual([
      "a@b.com",
      "c@d.com",
    ]);
    expect(field.value).toBe("a@b.com");
  });

  it("seeds from defaultRecipient over the first allowed entry", () => {
    mountModal({
      allowedRecipients: ["a@b.com", "c@d.com"],
      defaultRecipient: "c@d.com",
    });

    expect(get<HTMLSelectElement>(FIELD).value).toBe("c@d.com");
  });

  it("seeds free text from defaultRecipient", () => {
    mountModal({ defaultRecipient: "me@b.com" });

    expect(get<HTMLInputElement>(FIELD).value).toBe("me@b.com");
  });
});

describe("TestEmailModal send gating", () => {
  it("disables Send on an empty free-text field", () => {
    mountModal();
    expect(get<HTMLButtonElement>(SEND).disabled).toBe(true);
  });

  it("disables Send on a malformed address and shows the hint", async () => {
    mountModal();
    await setValue(get<HTMLInputElement>(FIELD), "not-an-email");

    expect(get<HTMLButtonElement>(SEND).disabled).toBe(true);
    expect(text()).toContain("testEmail.invalidAddress");
  });

  it("enables Send on a valid address and hides the hint", async () => {
    mountModal();
    await setValue(get<HTMLInputElement>(FIELD), "user@example.com");

    expect(get<HTMLButtonElement>(SEND).disabled).toBe(false);
    expect(text()).not.toContain("testEmail.invalidAddress");
  });

  it("shows no hint before anything has been typed", () => {
    // An empty field is not yet "wrong"; nagging on first render is noise.
    mountModal();
    expect(text()).not.toContain("testEmail.invalidAddress");
  });

  it("enables Send immediately with a picker — no typing needed", () => {
    mountModal({ allowedRecipients: ["a@b.com", "c@d.com"] });

    expect(get<HTMLButtonElement>(SEND).disabled).toBe(false);
  });

  it("emits the trimmed recipient on send", async () => {
    const wrapper = mountModal();
    await setValue(get<HTMLInputElement>(FIELD), "  user@example.com  ");

    await click(get(SEND));

    expect(wrapper.emitted("send")).toEqual([["user@example.com"]]);
  });

  it("does not emit send while a send is in flight", async () => {
    const wrapper = mountModal({ isSending: true });

    await click(get(SEND));

    expect(wrapper.emitted("send")).toBeUndefined();
  });

  it("does not emit send while showing success", async () => {
    const wrapper = mountModal({
      allowedRecipients: ["a@b.com"],
      justSent: true,
    });

    await click(get(SEND));

    expect(wrapper.emitted("send")).toBeUndefined();
  });
});

describe("TestEmailModal outcome states", () => {
  it("announces success politely and hides any error", () => {
    mountModal({
      allowedRecipients: ["a@b.com"],
      justSent: true,
      error: { kind: "provider", message: "stale failure" },
    });

    const success = get('[data-testid="test-email-success"]');
    expect(success.getAttribute("role")).toBe("status");
    expect(success.textContent).toContain("testEmail.success");
    // Success wins: a lingering error beside a confirmation is contradictory.
    expect(has('[data-testid="test-email-error"]')).toBe(false);
  });

  it("renders a provider error message verbatim, as an alert", () => {
    mountModal({ error: { kind: "provider", message: "mail server said no" } });

    const error = get('[data-testid="test-email-error"]');
    expect(error.getAttribute("role")).toBe("alert");
    expect(error.textContent?.trim()).toBe("mail server said no");
  });

  it("localizes an editor-generated refusal instead of printing a code", () => {
    mountModal({
      allowedRecipients: ["a@b.com"],
      error: { kind: "recipientNotAllowed" },
    });

    expect(get('[data-testid="test-email-error"]').textContent?.trim()).toBe(
      "testEmail.recipientNotAllowed",
    );
  });

  it("shows the sending label while in flight", () => {
    mountModal({ isSending: true });

    expect(get(SEND).textContent).toContain("testEmail.sending");
  });
});

/**
 * The preview is always shown — it's part of the dialog, not something to opt
 * into. Two things make it *truthful* rather than decorative: it filters blocks a
 * display condition excludes (asserted in `blockPreviewCanvas.test.ts`), and it
 * can switch viewport. Without either it would show content the recipient never
 * receives, which is worse than showing nothing.
 */
describe("TestEmailModal preview", () => {
  const REGION = '[data-testid="test-email-preview"]';
  /**
   * The dialog reuses the editor header's `ViewportToggle`, so these query its
   * radiogroup semantics rather than testids of our own — which is the point: if
   * someone swapped it for a bespoke control, these would fail.
   */
  const DESKTOP = '[role="radio"][aria-label="viewport.desktop"]';
  const MOBILE = '[role="radio"][aria-label="viewport.mobile"]';

  it("renders the preview region without any interaction", () => {
    mountModal();

    expect(has(REGION)).toBe(true);
    expect(text()).toContain("testEmail.preview");
  });

  it("uses the wide dialog so a full-width email fits with room beside it", () => {
    mountModal();

    // Not `max-w-2xl`: at that width the preview region's content box is
    // exactly the 600px email, so the band of body background the preview
    // draws beside the column has nowhere to go and `backgroundColor` reads as
    // unset for any template whose sections span the full width (#598).
    expect(get('[role="dialog"]').className).toContain("max-w-3xl");
  });

  it("scrolls the preview while the form and actions stay put", () => {
    mountModal();

    // `min-h-0` is what lets a flex child shrink below its content and scroll;
    // without it the region grows and pushes Send past the viewport.
    const region = get(REGION);
    expect(region.className).toContain("min-h-0");
    expect(region.className).toContain("overflow-y-auto");
    expect(get('[data-testid="test-email-send"]').closest("div")?.className)
      .toContain("shrink-0");
  });

  it("offers the editor's viewport switch, desktop selected first", () => {
    mountModal();

    // A radiogroup, because that's what the header control is — one of a set,
    // not two independent toggles.
    expect(has('[role="radiogroup"]')).toBe(true);
    expect(get(DESKTOP).getAttribute("aria-checked")).toBe("true");
    expect(get(MOBILE).getAttribute("aria-checked")).toBe("false");
  });

  it("switches the selected viewport", async () => {
    mountModal();

    await click(get(MOBILE));

    expect(get(MOBILE).getAttribute("aria-checked")).toBe("true");
    expect(get(DESKTOP).getAttribute("aria-checked")).toBe("false");
  });

  /**
   * Asserted on the element's exact text, never with `toContain`:
   * `"testEmail.previewHintSample"` *contains* `"testEmail.previewHint"`, so a
   * substring check passes even when the wrong hint is rendered.
   */
  function hintText(): string {
    return get('[data-testid="test-email-preview-hint"]').textContent?.trim() ?? "";
  }

  it("states that merge tags are unresolved when no sample is configured", () => {
    // The preview shows the template, not the delivered email — saying so is what
    // keeps it from implying more fidelity than it has.
    mountModal();

    expect(hintText()).toBe("testEmail.previewHint");
  });

  it("says values are examples once samples exist and Sample view is on", () => {
    // The old wording ("shown unresolved") is simply false in this state.
    mountModal({ mergeTags: SAMPLED_TAGS });

    expect(hintText()).toBe("testEmail.previewHintSample");
  });

  it("returns to the unresolved wording in Label view", () => {
    mountModal({ mergeTags: SAMPLED_TAGS, sampleMode: false });

    expect(hintText()).toBe("testEmail.previewHint");
  });
});

describe("TestEmailModal dismissal", () => {
  it("Cancel closes it", async () => {
    const wrapper = mountModal();

    await click(get(CANCEL));

    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("Cancel is inert while sending — the send can't be abandoned midway", async () => {
    const wrapper = mountModal({ isSending: true });

    await click(get(CANCEL));

    expect(wrapper.emitted("close")).toBeUndefined();
  });

  it("Cancel works while showing success, without waiting out the timer", async () => {
    const wrapper = mountModal({
      allowedRecipients: ["a@b.com"],
      justSent: true,
    });

    await click(get(CANCEL));

    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
