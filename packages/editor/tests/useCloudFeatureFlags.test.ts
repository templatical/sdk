import "./dom-stubs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ref, computed } from "vue";
import { useCloudFeatureFlags } from "../src/cloud/composables/useCloudFeatureFlags";

vi.mock("@vueuse/core", () => ({
  useTimeoutFn: vi.fn(() => ({ start: vi.fn() })),
}));

function createMockPlanConfig(
  features: string[] = [],
  config: any = null,
) {
  return {
    hasFeature: vi.fn((f: string) => features.includes(f)),
    config: ref(config),
  };
}

function createMockAiConfig(hasAny: boolean) {
  return {
    hasAnyMenuFeature: computed(() => hasAny),
  };
}

function createMockEditor(templateId?: string) {
  return {
    state: {
      template: templateId ? { id: templateId } : null,
    },
  };
}

describe("useCloudFeatureFlags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("canUseAiGeneration is true when planConfig has ai_generation AND aiConfig.hasAnyMenuFeature is true", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig(["ai_generation"]) as any,
      aiConfig: createMockAiConfig(true) as any,
      editor: createMockEditor(),
    });

    expect(result.canUseAiGeneration.value).toBe(true);
  });

  it("canUseAiGeneration is false when ai_generation feature missing", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig([]) as any,
      aiConfig: createMockAiConfig(true) as any,
      editor: createMockEditor(),
    });

    expect(result.canUseAiGeneration.value).toBe(false);
  });

  it("canUseAiGeneration is false when hasAnyMenuFeature is false", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig(["ai_generation"]) as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: createMockEditor(),
    });

    expect(result.canUseAiGeneration.value).toBe(false);
  });

  it("canUseAiGeneration is false when both conditions fail", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig([]) as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: createMockEditor(),
    });

    expect(result.canUseAiGeneration.value).toBe(false);
  });

  it("canSendTestEmail reflects planConfig.hasFeature('test_email')", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig(["test_email"]) as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: createMockEditor(),
    });

    expect(result.canSendTestEmail.value).toBe(true);
  });

  it("canSendTestEmail is false when test_email feature missing", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig([]) as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: createMockEditor(),
    });

    expect(result.canSendTestEmail.value).toBe(false);
  });

  it("hasTemplateSaved is true when editor.state.template?.id exists", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig() as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: createMockEditor("tmpl-123"),
    });

    expect(result.hasTemplateSaved.value).toBe(true);
  });

  it("hasTemplateSaved is false when no template", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig() as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: createMockEditor(),
    });

    expect(result.hasTemplateSaved.value).toBe(false);
  });

  it("hasTemplateSaved is false when template is undefined", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig() as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: { state: {} },
    });

    expect(result.hasTemplateSaved.value).toBe(false);
  });

  it("isWhiteLabeled reflects white_label feature", () => {
    const withWhiteLabel = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig(["white_label"]) as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: createMockEditor(),
    });

    expect(withWhiteLabel.isWhiteLabeled.value).toBe(true);

    const withoutWhiteLabel = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig([]) as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: createMockEditor(),
    });

    expect(withoutWhiteLabel.isWhiteLabeled.value).toBe(false);
  });

  it("templateLimit returns max_templates from config", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig([], {
        limits: { max_templates: 50 },
        template_count: 10,
      }) as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: createMockEditor(),
    });

    expect(result.templateLimit.value).toBe(50);
  });

  it("templateLimit returns null when no config", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig([], null) as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: createMockEditor(),
    });

    expect(result.templateLimit.value).toBe(null);
  });

  it("templateCount returns template_count from config", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig([], {
        limits: { max_templates: 50 },
        template_count: 7,
      }) as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: createMockEditor(),
    });

    expect(result.templateCount.value).toBe(7);
  });

  it("templateCount returns 0 when no config", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig([], null) as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: createMockEditor(),
    });

    expect(result.templateCount.value).toBe(0);
  });

  it("isSaveExporting starts as false", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig() as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: createMockEditor(),
    });

    expect(result.isSaveExporting.value).toBe(false);
  });

  it("saveStatus starts as 'idle'", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig() as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: createMockEditor(),
    });

    expect(result.saveStatus.value).toBe("idle");
  });

  it("saveErrorMessage starts as empty string", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig() as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: createMockEditor(),
    });

    expect(result.saveErrorMessage.value).toBe("");
  });

  it("startSaveStatusClear calls the timeout start function", async () => {
    const { useTimeoutFn } = await import("@vueuse/core");
    const mockStart = vi.fn();
    vi.mocked(useTimeoutFn).mockReturnValue({
      start: mockStart,
      stop: vi.fn(),
      isPending: ref(false),
    } as any);

    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig() as any,
      aiConfig: createMockAiConfig(false) as any,
      editor: createMockEditor(),
    });

    result.startSaveStatusClear();
    expect(mockStart).toHaveBeenCalled();
  });
});
