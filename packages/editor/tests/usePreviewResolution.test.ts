// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  type TemplateContent,
} from "@templatical/types";
import { usePreviewResolution } from "../src/composables/usePreviewResolution";

/**
 * The `resolvePreview` seam.
 *
 * Every preview surface reads its content from here rather than calling the
 * hook, so the interesting behaviour is all lifecycle: debouncing, discarding a
 * superseded response, shape-checking what comes back, and degrading to the
 * unresolved template when any of that fails.
 *
 * The two that would silently corrupt a preview if wrong:
 *
 * 1. **Stale responses must be discarded.** Change recipient twice and the
 *    first (slower) answer must not land last.
 * 2. **A failure must degrade, never throw.** A rejecting or mis-shaped
 *    resolver leaves a usable preview of the unresolved template.
 */

const DEBOUNCE = 500;

function raw(): TemplateContent {
  const c = createDefaultTemplateContent();
  c.blocks = [createParagraphBlock({ content: "<p>raw</p>" })];
  return c;
}

function resolvedWith(text: string): TemplateContent {
  const c = createDefaultTemplateContent();
  c.blocks = [createParagraphBlock({ content: `<p>${text}</p>` })];
  return c;
}

/** First paragraph's content, so assertions read as values not structures. */
function firstText(content: TemplateContent): string {
  const block = content.blocks[0] as { content?: string } | undefined;
  return block?.content ?? "";
}

let scope: ReturnType<typeof effectScope>;

function setup(opts: {
  resolvePreview?: Parameters<typeof usePreviewResolution>[0]["resolvePreview"];
  active?: boolean;
  recipient?: string;
}) {
  const active = ref(opts.active ?? true);
  const recipient = ref(opts.recipient);
  const content = raw();

  scope = effectScope();
  const api = scope.run(() =>
    usePreviewResolution({
      resolvePreview: opts.resolvePreview,
      getContent: () => content,
      isActive: () => active.value,
      getRecipient: () => recipient.value,
    }),
  )!;

  return { api, active, recipient, content };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  scope?.stop();
  vi.useRealTimers();
});

describe("usePreviewResolution without a hook", () => {
  it("reports itself unconfigured and returns the raw content", () => {
    const { api, content } = setup({});

    expect(api.isConfigured).toBe(false);
    expect(api.content.value).toBe(content);
    expect(api.isResolving.value).toBe(false);
  });

  it("never shows a skeleton or claims to supersede samples", () => {
    const { api } = setup({});

    expect(api.isInitialResolve.value).toBe(false);
    expect(api.supersedesSamples.value).toBe(false);
  });
});

describe("usePreviewResolution happy path", () => {
  it("resolves immediately on the first attempt, with no debounce", async () => {
    const hook = vi.fn().mockResolvedValue(resolvedWith("resolved"));
    const { api } = setup({ resolvePreview: hook });

    // Called synchronously — nothing is on screen yet, so there is nothing to
    // coalesce and delaying would just show the unresolved template first.
    expect(hook).toHaveBeenCalledTimes(1);
    // And the skeleton is already requested, in the same tick as activation.
    expect(api.isInitialResolve.value).toBe(true);

    await vi.advanceTimersByTimeAsync(0);

    expect(hook).toHaveBeenCalledTimes(1);
    expect(firstText(api.content.value)).toBe("<p>resolved</p>");
    expect(api.isResolving.value).toBe(false);
    expect(api.hasFailed.value).toBe(false);
  });

  it("hands the hook a copy, so a mutating resolver cannot reach editor state", async () => {
    let received: TemplateContent | null = null;
    const hook = vi.fn(async (ctx: { content: TemplateContent }) => {
      received = ctx.content;
      ctx.content.blocks = []; // a badly-behaved resolver
      return resolvedWith("ok");
    });
    const { api, content } = setup({ resolvePreview: hook });

    await vi.advanceTimersByTimeAsync(DEBOUNCE);

    expect(received).not.toBe(content);
    expect(content.blocks).toHaveLength(1);
    expect(firstText(api.content.value)).toBe("<p>ok</p>");
  });

  it("passes the recipient when the surface has one, and omits the key otherwise", async () => {
    const withRecipient = vi.fn().mockResolvedValue(resolvedWith("a"));
    setup({ resolvePreview: withRecipient, recipient: "who@example.com" });
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(withRecipient.mock.calls[0]![0].recipient).toBe("who@example.com");

    scope.stop();

    const without = vi.fn().mockResolvedValue(resolvedWith("b"));
    setup({ resolvePreview: without });
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect("recipient" in without.mock.calls[0]![0]).toBe(false);
  });

  it("supersedes samples from the first frame, not once content lands", async () => {
    const hook = vi.fn().mockResolvedValue(resolvedWith("resolved"));
    const { api } = setup({ resolvePreview: hook });

    // Configuring a resolver is the consumer's declared intent for how previews
    // read. Waiting for a landed result made the Sample/Label toggle appear for
    // the debounce plus the resolver's latency and then vanish — measured ~900ms
    // in the playground, which reads as a bug.
    expect(api.supersedesSamples.value).toBe(true);

    await vi.advanceTimersByTimeAsync(DEBOUNCE);

    expect(api.supersedesSamples.value).toBe(true);
  });
});

describe("usePreviewResolution debouncing and staleness", () => {
  it("collapses rapid recipient changes into one call once content is showing", async () => {
    const hook = vi.fn().mockResolvedValue(resolvedWith("x"));
    const { recipient } = setup({
      resolvePreview: hook,
      recipient: "a@x.test",
    });

    // The first resolve is immediate (nothing on screen yet).
    await vi.advanceTimersByTimeAsync(0);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook.mock.calls[0]![0].recipient).toBe("a@x.test");

    // Now that a result is showing, re-resolves debounce — which is the only
    // case the delay exists for.
    recipient.value = "b@x.test";
    await nextTick();
    recipient.value = "c@x.test";
    await nextTick();
    expect(hook).toHaveBeenCalledTimes(1); // still coalescing
    await vi.advanceTimersByTimeAsync(DEBOUNCE);

    expect(hook).toHaveBeenCalledTimes(2);
    expect(hook.mock.calls[1]![0].recipient).toBe("c@x.test");
  });

  it("discards a superseded response even when it lands last", async () => {
    // The race that matters, and it has to be forced rather than simulated with
    // timers: an earlier attempt must settle *after* a later one has already
    // been applied. Timer-based delays can't guarantee that ordering — advancing
    // the debounce also advances the fake latency, so the first response lands
    // before the second request is even made and the test proves nothing.
    // Explicit deferreds give exact control.
    const settle: Array<(c: TemplateContent) => void> = [];
    const hook = vi.fn(
      () => new Promise<TemplateContent>((res) => settle.push(res)),
    );
    const { api, recipient } = setup({
      resolvePreview: hook,
      recipient: "first@x.test",
    });

    await vi.advanceTimersByTimeAsync(DEBOUNCE); // request 1 in flight
    recipient.value = "second@x.test";
    await nextTick();
    await vi.advanceTimersByTimeAsync(DEBOUNCE); // request 2 in flight
    expect(hook).toHaveBeenCalledTimes(2);

    // The newer answer arrives first and is applied.
    settle[1]!(resolvedWith("second"));
    await vi.advanceTimersByTimeAsync(0);
    expect(firstText(api.content.value)).toBe("<p>second</p>");

    // Now the stale one lands. It must be ignored.
    settle[0]!(resolvedWith("first"));
    await vi.advanceTimersByTimeAsync(0);
    expect(firstText(api.content.value)).toBe("<p>second</p>");
  });

  it("ignores a stale failure, so a dead earlier attempt can't mark a good preview failed", async () => {
    const settle: Array<{
      res: (c: TemplateContent) => void;
      rej: (e: Error) => void;
    }> = [];
    const hook = vi.fn(
      () =>
        new Promise<TemplateContent>((res, rej) => settle.push({ res, rej })),
    );
    const { api, recipient } = setup({
      resolvePreview: hook,
      recipient: "first@x.test",
    });

    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    recipient.value = "second@x.test";
    await nextTick();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);

    settle[1]!.res(resolvedWith("second"));
    await vi.advanceTimersByTimeAsync(0);

    settle[0]!.rej(new Error("stale failure"));
    await vi.advanceTimersByTimeAsync(0);

    expect(api.hasFailed.value).toBe(false);
    expect(firstText(api.content.value)).toBe("<p>second</p>");
  });

  it("keeps the previous result during a re-resolve instead of flashing a skeleton", async () => {
    const hook = vi
      .fn()
      .mockResolvedValueOnce(resolvedWith("first"))
      .mockImplementation(
        () =>
          new Promise<TemplateContent>((res) =>
            setTimeout(() => res(resolvedWith("second")), 100),
          ),
      );
    const { api, recipient } = setup({
      resolvePreview: hook,
      recipient: "a@x.test",
    });

    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(firstText(api.content.value)).toBe("<p>first</p>");

    recipient.value = "b@x.test";
    await nextTick();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);

    // Mid-flight: still resolving, but the old result is on screen and no
    // skeleton is requested.
    expect(api.isResolving.value).toBe(true);
    expect(api.isInitialResolve.value).toBe(false);
    expect(firstText(api.content.value)).toBe("<p>first</p>");
  });

  it("asks for a skeleton immediately, and drops it once content lands", async () => {
    const hook = vi.fn(
      () =>
        new Promise<TemplateContent>((res) =>
          setTimeout(() => res(resolvedWith("done")), 100),
        ),
    );
    const { api } = setup({ resolvePreview: hook });

    // No timer advance at all: the skeleton must be up the moment the preview
    // opens, or the unresolved template shows through first.
    expect(api.isInitialResolve.value).toBe(true);

    await vi.advanceTimersByTimeAsync(100);

    expect(api.isInitialResolve.value).toBe(false);
    expect(firstText(api.content.value)).toBe("<p>done</p>");
  });
});

describe("usePreviewResolution failure degrades", () => {
  it("falls back to the unresolved template when the hook rejects", async () => {
    const hook = vi.fn().mockRejectedValue(new Error("backend down"));
    const { api } = setup({ resolvePreview: hook });

    await vi.advanceTimersByTimeAsync(DEBOUNCE);

    expect(api.hasFailed.value).toBe(true);
    // Still a usable preview, not an empty frame.
    expect(firstText(api.content.value)).toBe("<p>raw</p>");
    expect(api.isResolving.value).toBe(false);
  });

  it("treats an unrenderable result as a failure rather than throwing", async () => {
    const hook = vi.fn().mockResolvedValue({ nope: true });
    const { api } = setup({ resolvePreview: hook as never });

    await vi.advanceTimersByTimeAsync(DEBOUNCE);

    expect(api.hasFailed.value).toBe(true);
    expect(firstText(api.content.value)).toBe("<p>raw</p>");
  });

  it("keeps superseding samples after a failure", async () => {
    // The fallback shows the *unresolved* template, which is what the inline
    // failure note says. If samples substituted into that fallback the note
    // would be false, so a configured resolver keeps samples off either way.
    const hook = vi.fn().mockRejectedValue(new Error("nope"));
    const { api } = setup({ resolvePreview: hook });

    await vi.advanceTimersByTimeAsync(DEBOUNCE);

    expect(api.hasFailed.value).toBe(true);
    expect(api.supersedesSamples.value).toBe(true);
  });

  it("clears the failure once a later attempt succeeds", async () => {
    const hook = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue(resolvedWith("recovered"));
    const { api, recipient } = setup({
      resolvePreview: hook,
      recipient: "a@x.test",
    });

    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(api.hasFailed.value).toBe(true);

    recipient.value = "b@x.test";
    await nextTick();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);

    expect(api.hasFailed.value).toBe(false);
    expect(firstText(api.content.value)).toBe("<p>recovered</p>");
  });
});

describe("usePreviewResolution only runs while a preview is showing", () => {
  it("never calls the hook when no preview is active", async () => {
    const hook = vi.fn().mockResolvedValue(resolvedWith("x"));
    setup({ resolvePreview: hook, active: false });

    await vi.advanceTimersByTimeAsync(DEBOUNCE * 4);

    expect(hook).not.toHaveBeenCalled();
  });

  it("resolves on activation and drops the result on deactivation", async () => {
    const hook = vi.fn().mockResolvedValue(resolvedWith("resolved"));
    const { api, active } = setup({ resolvePreview: hook, active: false });

    active.value = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(firstText(api.content.value)).toBe("<p>resolved</p>");

    active.value = false;
    await nextTick();

    // Dropped, so reopening resolves fresh rather than showing stale data.
    expect(firstText(api.content.value)).toBe("<p>raw</p>");
    // Still superseding: the resolver is configured whether or not a preview is
    // open, and samples must not reappear the moment one closes.
    expect(api.supersedesSamples.value).toBe(true);
  });

  it("cancels a pending re-resolve when the preview closes before it fires", async () => {
    // Only re-resolves are debounced now, so this is the case that can be
    // cancelled mid-flight: resolve once, change recipient, then close.
    const hook = vi.fn().mockResolvedValue(resolvedWith("x"));
    const { active, recipient } = setup({
      resolvePreview: hook,
      recipient: "a@x.test",
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(hook).toHaveBeenCalledTimes(1);

    recipient.value = "b@x.test";
    await nextTick();
    await vi.advanceTimersByTimeAsync(DEBOUNCE / 2);
    active.value = false;
    await nextTick();
    await vi.advanceTimersByTimeAsync(DEBOUNCE * 2);

    // The queued second call never fired.
    expect(hook).toHaveBeenCalledTimes(1);
  });
});
