import "./dom-stubs";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
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

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each(["development", "production"])(
    "logs one development hint through logger.info after two failed imports (%s)",
    async (mode) => {
      vi.stubEnv("NODE_ENV", mode);
      const mock = await setupQualityMock();
      const { logger } = await import("../src/utils/logger");
      const info = vi.spyOn(logger, "info");
      const consoleInfo = vi
        .spyOn(console, "info")
        .mockImplementation(() => {});
      const useTemplateLint = await loadComposable();
      const start = () =>
        useTemplateLint({
          content: ref(createContent()),
          options: {},
          updateBlock: vi.fn(),
          updateSettings: vi.fn(),
          removeBlock: vi.fn(),
        });
      const first = start();
      mock.rejectImport(new Error("quality missing"));
      await vi.waitFor(() => expect(first.unavailable.value).toBe(true));
      const second = start();
      await vi.waitFor(() => expect(second.unavailable.value).toBe(true));
      expect(info).toHaveBeenCalledExactlyOnceWith(
        "@templatical/quality isn't installed, so the Issues panel and its lint badges are off. Add @templatical/quality to your dependencies to turn them on.",
      );
      expect(consoleInfo).toHaveBeenCalledTimes(mode === "production" ? 0 : 1);
      expect(first.ready.value).toBe(false);
      expect(second.ready.value).toBe(false);
      first.destroy();
      second.destroy();
    },
  );

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

  it("keeps ready false and sets unavailable when the package cannot be imported", async () => {
    // RightSidebar hides the Issues tab on `unavailable`, so a failed import
    // must set it, and must not report the linter as ready.
    const mock = await setupQualityMock();
    const useTemplateLint = await loadComposable();

    const result = useTemplateLint({
      content: ref(createContent()),
      options: {},
      updateBlock: vi.fn(),
      updateSettings: vi.fn(),
      removeBlock: vi.fn(),
    });
    expect(result.ready.value).toBe(false);
    expect(result.unavailable.value).toBe(false);

    mock.rejectImport(new Error("Cannot find module '@templatical/quality'"));
    await vi.waitFor(() => expect(result.unavailable.value).toBe(true));
    expect(result.ready.value).toBe(false);
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
    // lintTemplate merges the four categories inside the
    // quality package; the composable just surfaces whatever it returns.
    mock.lintTemplate.mockReturnValue([
      { ruleId: "a11y.x", blockId: "b1", severity: "error", message: "a" },
      { ruleId: "structure.x", blockId: "b1", severity: "error", message: "b" },
      { ruleId: "link.x", blockId: "b1", severity: "error", message: "c" },
      {
        ruleId: "deliverability.x",
        blockId: "b1",
        severity: "warning",
        message: "d",
      },
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
      "deliverability.x",
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
      options: {
        accessibility: false,
        structure: false,
        links: false,
        deliverability: false,
        compatibility: false,
      },
      updateBlock: vi.fn(),
      updateSettings: vi.fn(),
      removeBlock: vi.fn(),
    });

    mock.resolveImport();
    await new Promise((r) => setTimeout(r, 0));
    await nextTick();

    expect(mock.lintTemplate).not.toHaveBeenCalled();
  });

  it("starts lint when only the original three categories are false", async () => {
    const mock = await setupQualityMock();
    const useTemplateLint = await loadComposable();
    const options = {
      accessibility: false,
      structure: false,
      links: false,
    } as const;

    const result = useTemplateLint({
      content: ref(createContent()),
      options,
      updateBlock: vi.fn(),
      updateSettings: vi.fn(),
      removeBlock: vi.fn(),
    });

    mock.resolveImport();
    await vi.waitFor(() => expect(result.ready.value).toBe(true));
    expect(mock.lintTemplate).toHaveBeenCalledTimes(1);
    expect(mock.lintTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ blocks: expect.any(Array) }),
      options,
    );
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
    const { isLintFullyDisabled } =
      await import("../src/composables/useTemplateLint");
    expect(isLintFullyDisabled(undefined)).toBe(false);
  });

  it("returns false for empty options", async () => {
    const { isLintFullyDisabled } =
      await import("../src/composables/useTemplateLint");
    expect(isLintFullyDisabled({})).toBe(false);
  });

  it("returns true when disabled flag is set", async () => {
    const { isLintFullyDisabled } =
      await import("../src/composables/useTemplateLint");
    expect(isLintFullyDisabled({ disabled: true })).toBe(true);
  });

  it("returns true only when all five tool keys are false", async () => {
    const { isLintFullyDisabled } =
      await import("../src/composables/useTemplateLint");
    expect(
      isLintFullyDisabled({
        accessibility: false,
        structure: false,
        links: false,
        deliverability: false,
        compatibility: false,
      }),
    ).toBe(true);
  });

  it("returns false when only the original three tool keys are false", async () => {
    const { isLintFullyDisabled } =
      await import("../src/composables/useTemplateLint");
    expect(
      isLintFullyDisabled({
        accessibility: false,
        structure: false,
        links: false,
      }),
    ).toBe(false);
  });

  it("returns false when only two tools are disabled", async () => {
    const { isLintFullyDisabled } =
      await import("../src/composables/useTemplateLint");
    expect(
      isLintFullyDisabled({ accessibility: false, structure: false }),
    ).toBe(false);
  });
});
