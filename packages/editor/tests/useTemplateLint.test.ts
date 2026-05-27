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
  lintTemplate: ReturnType<typeof vi.fn>;
  resolveImport: () => void;
  rejectImport: (err: unknown) => void;
}

/**
 * Stage a per-test mock for `@templatical/quality` whose dynamic import can
 * be deferred. The composable funnels every linter through the package's
 * single `lintTemplate` entry point, so that's the only spy we need.
 * Returns the spy + resolver so the test can control timing.
 */
async function setupQualityMock(): Promise<QualityMockHandle> {
  vi.resetModules();

  const lintTemplate = vi.fn(() => [] as unknown[]);
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const importPromise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  vi.doMock("@templatical/quality", async () => {
    await importPromise;
    return { lintTemplate };
  });

  return {
    lintTemplate,
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
    // must short-circuit so it neither calls lintTemplate nor installs a watcher.
    mock.resolveImport();
    // Let microtasks settle.
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    expect(mock.lintTemplate).not.toHaveBeenCalled();
    expect(result.ready.value).toBe(false);

    // Mutate content. If a leaked watcher exists, it would fire runLint after
    // its debounce window.
    content.value = {
      blocks: [{ id: "b2", type: "paragraph" }],
      settings: {},
    } as TemplateContent;
    await new Promise((r) => setTimeout(r, 50));

    expect(mock.lintTemplate).not.toHaveBeenCalled();
  });

  it("runs lintTemplate on content changes when alive", async () => {
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

    expect(mock.lintTemplate).toHaveBeenCalledTimes(1);

    content.value = {
      blocks: [{ id: "b2", type: "paragraph" }],
      settings: {},
    } as TemplateContent;
    await new Promise((r) => setTimeout(r, 50));

    expect(mock.lintTemplate).toHaveBeenCalledTimes(2);
  });

  it("surfaces the merged issues lintTemplate returns", async () => {
    const mock = await setupQualityMock();
    // lintTemplate already merges accessibility + structure + links inside the
    // quality package; the composable just surfaces whatever it returns.
    mock.lintTemplate.mockReturnValue([
      { ruleId: "a11y.x", blockId: "b1", severity: "error", message: "a" },
      { ruleId: "structure.x", blockId: "b1", severity: "error", message: "b" },
      { ruleId: "link.x", blockId: "b1", severity: "error", message: "c" },
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
      "link.x",
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

    expect(mock.lintTemplate).not.toHaveBeenCalled();
  });

  it("does not start lint when every per-tool key is false", async () => {
    const mock = await setupQualityMock();
    const useTemplateLint = await loadComposable();

    useTemplateLint({
      content: ref(createContent()),
      options: { accessibility: false, structure: false, links: false },
      updateBlock: vi.fn(),
      updateSettings: vi.fn(),
      removeBlock: vi.fn(),
    });

    mock.resolveImport();
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    expect(mock.lintTemplate).not.toHaveBeenCalled();
  });

  it("still starts lint when only some tools are disabled", async () => {
    const mock = await setupQualityMock();
    const useTemplateLint = await loadComposable();

    const options = { accessibility: false, structure: false } as const;
    useTemplateLint({
      content: ref(createContent()),
      options,
      updateBlock: vi.fn(),
      updateSettings: vi.fn(),
      removeBlock: vi.fn(),
      debounce: 10,
    });

    mock.resolveImport();
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    // The composable still calls lintTemplate while at least one tool is
    // active; the per-tool false is enforced inside the linter functions
    // (each returns []). Options pass through unchanged.
    expect(mock.lintTemplate).toHaveBeenCalledTimes(1);
    expect(mock.lintTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ blocks: expect.any(Array) }),
      options,
    );
  });
});

describe("isLintFullyDisabled", () => {
  it("returns false for undefined options", async () => {
    const { isLintFullyDisabled } = await import(
      "../src/composables/useTemplateLint"
    );
    expect(isLintFullyDisabled(undefined)).toBe(false);
  });

  it("returns false for empty options", async () => {
    const { isLintFullyDisabled } = await import(
      "../src/composables/useTemplateLint"
    );
    expect(isLintFullyDisabled({})).toBe(false);
  });

  it("returns true when disabled flag is set", async () => {
    const { isLintFullyDisabled } = await import(
      "../src/composables/useTemplateLint"
    );
    expect(isLintFullyDisabled({ disabled: true })).toBe(true);
  });

  it("returns true only when ALL three tool keys are false", async () => {
    const { isLintFullyDisabled } = await import(
      "../src/composables/useTemplateLint"
    );
    expect(
      isLintFullyDisabled({
        accessibility: false,
        structure: false,
        links: false,
      }),
    ).toBe(true);
  });

  it("returns false when only two tools are disabled", async () => {
    const { isLintFullyDisabled } = await import(
      "../src/composables/useTemplateLint"
    );
    expect(
      isLintFullyDisabled({ accessibility: false, structure: false }),
    ).toBe(false);
  });
});
