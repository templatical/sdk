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
  lintStructure: ReturnType<typeof vi.fn>;
  resolveImport: () => void;
  rejectImport: (err: unknown) => void;
}

/**
 * Stage a per-test mock for `@templatical/quality` whose dynamic import can
 * be deferred. Returns the spies + resolver so the test can control timing.
 */
async function setupQualityMock(): Promise<QualityMockHandle> {
  vi.resetModules();

  const lintAccessibility = vi.fn(() => [] as unknown[]);
  const lintStructure = vi.fn(() => [] as unknown[]);
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const importPromise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  vi.doMock("@templatical/quality", async () => {
    await importPromise;
    return { lintAccessibility, lintStructure };
  });

  return {
    lintAccessibility,
    lintStructure,
    resolveImport: resolve,
    rejectImport: reject,
  };
}

async function loadComposable() {
  return (await import("../src/composables/useTemplateLint")).useTemplateLint;
}

describe("useTemplateLint", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("does not run linters after destroy() if dynamic import resolves later", async () => {
    const mock = await setupQualityMock();
    const useTemplateLint = await loadComposable();

    const content = ref(createContent());

    const result = useTemplateLint({
      content,
      options: {},
      updateBlock: vi.fn(),
      updateSettings: vi.fn(),
      removeBlock: vi.fn(),
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
    expect(mock.lintStructure).not.toHaveBeenCalled();
    expect(result.ready.value).toBe(false);

    // Mutate content. If a leaked watcher exists, it would fire runLint after
    // its debounce window.
    content.value = {
      blocks: [{ id: "b2", type: "paragraph" }],
      settings: {},
    } as TemplateContent;
    await new Promise((r) => setTimeout(r, 50));

    expect(mock.lintAccessibility).not.toHaveBeenCalled();
    expect(mock.lintStructure).not.toHaveBeenCalled();
  });

  it("runs both linters on content changes when alive", async () => {
    const mock = await setupQualityMock();
    const useTemplateLint = await loadComposable();

    const content = ref(createContent());

    useTemplateLint({
      content,
      options: {},
      updateBlock: vi.fn(),
      updateSettings: vi.fn(),
      removeBlock: vi.fn(),
      debounce: 10,
    });

    mock.resolveImport();
    // First lint runs synchronously after import resolves.
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    expect(mock.lintAccessibility).toHaveBeenCalledTimes(1);
    expect(mock.lintStructure).toHaveBeenCalledTimes(1);

    content.value = {
      blocks: [{ id: "b2", type: "paragraph" }],
      settings: {},
    } as TemplateContent;
    await new Promise((r) => setTimeout(r, 50));

    expect(mock.lintAccessibility).toHaveBeenCalledTimes(2);
    expect(mock.lintStructure).toHaveBeenCalledTimes(2);
  });

  it("merges issues from both linters", async () => {
    const mock = await setupQualityMock();
    mock.lintAccessibility.mockReturnValue([
      { ruleId: "a11y.x", blockId: "b1", severity: "error", message: "a" },
    ]);
    mock.lintStructure.mockReturnValue([
      { ruleId: "structure.x", blockId: "b1", severity: "error", message: "b" },
    ]);
    const useTemplateLint = await loadComposable();

    const result = useTemplateLint({
      content: ref(createContent()),
      options: {},
      updateBlock: vi.fn(),
      updateSettings: vi.fn(),
      removeBlock: vi.fn(),
      debounce: 10,
    });

    mock.resolveImport();
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    expect(result.issues.value.map((i) => i.ruleId)).toEqual([
      "a11y.x",
      "structure.x",
    ]);
  });

  it("does not start lint when options.disabled is true", async () => {
    const mock = await setupQualityMock();
    const useTemplateLint = await loadComposable();

    useTemplateLint({
      content: ref(createContent()),
      options: { disabled: true },
      updateBlock: vi.fn(),
      updateSettings: vi.fn(),
      removeBlock: vi.fn(),
    });

    // Even if we resolve the (un-awaited) import, nothing should run.
    mock.resolveImport();
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    expect(mock.lintAccessibility).not.toHaveBeenCalled();
    expect(mock.lintStructure).not.toHaveBeenCalled();
  });
});
