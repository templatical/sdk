import "./dom-stubs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ref, nextTick } from "vue";
import type { TemplateContent } from "@templatical/types";

function createContent(): TemplateContent {
  return {
    blocks: [{ id: "b1", type: "paragraph" }],
    settings: {},
  } as TemplateContent;
}

interface QualityMockHandle {
  lintAccessibility: ReturnType<typeof vi.fn>;
  resolveImport: () => void;
  rejectImport: (err: unknown) => void;
}

/**
 * Stage a per-test mock for `@templatical/quality` whose dynamic import can
 * be deferred. Returns the spy + resolver so the test can control timing.
 */
async function setupQualityMock(): Promise<QualityMockHandle> {
  vi.resetModules();

  const lintAccessibility = vi.fn(() => [] as unknown[]);
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const importPromise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  vi.doMock("@templatical/quality", async () => {
    await importPromise;
    return { lintAccessibility };
  });

  return { lintAccessibility, resolveImport: resolve, rejectImport: reject };
}

async function loadComposable() {
  return (await import("../src/composables/useAccessibilityLint"))
    .useAccessibilityLint;
}

describe("useAccessibilityLint", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("does not run lintAccessibility after destroy() if dynamic import resolves later", async () => {
    const mock = await setupQualityMock();
    const useAccessibilityLint = await loadComposable();

    const content = ref(createContent());

    const result = useAccessibilityLint({
      content,
      options: {},
      updateBlock: vi.fn(),
      updateSettings: vi.fn(),
      debounce: 10,
    });

    // Tear down the consumer immediately, BEFORE the dynamic import resolves.
    result.destroy();

    // Now resolve the import — load() will run its post-await body. The fix
    // must short-circuit so it neither calls lintFn nor installs a watcher.
    mock.resolveImport();
    // Let microtasks settle.
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    expect(mock.lintAccessibility).not.toHaveBeenCalled();
    expect(result.ready.value).toBe(false);

    // Mutate content. If a leaked watcher exists, it would fire runLint after
    // its debounce window.
    content.value = {
      blocks: [{ id: "b2", type: "paragraph" }],
      settings: {},
    } as TemplateContent;
    await new Promise((r) => setTimeout(r, 50));

    expect(mock.lintAccessibility).not.toHaveBeenCalled();
  });

  it("runs lintAccessibility on content changes when alive (sanity check)", async () => {
    const mock = await setupQualityMock();
    const useAccessibilityLint = await loadComposable();

    const content = ref(createContent());

    useAccessibilityLint({
      content,
      options: {},
      updateBlock: vi.fn(),
      updateSettings: vi.fn(),
      debounce: 10,
    });

    mock.resolveImport();
    // First lint runs synchronously after import resolves.
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    expect(mock.lintAccessibility).toHaveBeenCalledTimes(1);

    content.value = {
      blocks: [{ id: "b2", type: "paragraph" }],
      settings: {},
    } as TemplateContent;
    await new Promise((r) => setTimeout(r, 50));

    expect(mock.lintAccessibility).toHaveBeenCalledTimes(2);
  });

  it("does not start lint when options.disabled is true", async () => {
    const mock = await setupQualityMock();
    const useAccessibilityLint = await loadComposable();

    useAccessibilityLint({
      content: ref(createContent()),
      options: { disabled: true },
      updateBlock: vi.fn(),
      updateSettings: vi.fn(),
    });

    // Even if we resolve the (un-awaited) import, nothing should run.
    mock.resolveImport();
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    expect(mock.lintAccessibility).not.toHaveBeenCalled();
  });
});
