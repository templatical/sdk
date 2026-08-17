import "./dom-stubs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ref, computed } from "vue";
import { useCloudFeatureFlags } from "../src/cloud/composables/useCloudFeatureFlags";

function createMockPlanConfig(features: string[] = [], config: any = null) {
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

describe("useCloudFeatureFlags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("canUseAiGeneration is true when planConfig has ai_generation AND aiConfig.hasAnyMenuFeature is true", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig(["ai_generation"]) as any,
      aiConfig: createMockAiConfig(true) as any,
      getTemplateId: () => null,
    });

    expect(result.canUseAiGeneration.value).toBe(true);
  });

  it("canUseAiGeneration is false when ai_generation feature missing", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig([]) as any,
      aiConfig: createMockAiConfig(true) as any,
      getTemplateId: () => null,
    });

    expect(result.canUseAiGeneration.value).toBe(false);
  });

  it("canUseAiGeneration is false when hasAnyMenuFeature is false", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig(["ai_generation"]) as any,
      aiConfig: createMockAiConfig(false) as any,
      getTemplateId: () => null,
    });

    expect(result.canUseAiGeneration.value).toBe(false);
  });

  it("canUseAiGeneration is false when both conditions fail", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig([]) as any,
      aiConfig: createMockAiConfig(false) as any,
      getTemplateId: () => null,
    });

    expect(result.canUseAiGeneration.value).toBe(false);
  });

  it("canSendTestEmail reflects planConfig.hasFeature('test_email')", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig(["test_email"]) as any,
      aiConfig: createMockAiConfig(false) as any,
      getTemplateId: () => null,
    });

    expect(result.canSendTestEmail.value).toBe(true);
  });

  it("canSendTestEmail is false when test_email feature missing", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig([]) as any,
      aiConfig: createMockAiConfig(false) as any,
      getTemplateId: () => null,
    });

    expect(result.canSendTestEmail.value).toBe(false);
  });

  it("hasTemplateSaved is true once a template id exists", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig() as any,
      aiConfig: createMockAiConfig(false) as any,
      getTemplateId: () => "tmpl-123",
    });

    expect(result.hasTemplateSaved.value).toBe(true);
  });

  it("hasTemplateSaved is false when no template", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig() as any,
      aiConfig: createMockAiConfig(false) as any,
      getTemplateId: () => null,
    });

    expect(result.hasTemplateSaved.value).toBe(false);
  });

  it("templateLimit returns max_templates from config", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig([], {
        limits: { max_templates: 50 },
        template_count: 10,
      }) as any,
      aiConfig: createMockAiConfig(false) as any,
      getTemplateId: () => null,
    });

    expect(result.templateLimit.value).toBe(50);
  });

  it("templateLimit returns null when no config", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig([], null) as any,
      aiConfig: createMockAiConfig(false) as any,
      getTemplateId: () => null,
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
      getTemplateId: () => null,
    });

    expect(result.templateCount.value).toBe(7);
  });

  it("templateCount returns 0 when no config", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig([], null) as any,
      aiConfig: createMockAiConfig(false) as any,
      getTemplateId: () => null,
    });

    expect(result.templateCount.value).toBe(0);
  });

  // Three members must not exist here.
  //
  // Footer branding is not an entitlement: `config.branding !== false` decides it
  // on any plan, so an `isWhiteLabeled` flag would gate nothing.
  //
  // `saveStatus` / `saveErrorMessage` / `startSaveStatusClear` belong to
  // `useTemplatesFeature`, which the one shared header reads. They were never
  // entitlements, and a second copy here is how two headers come to show
  // different save states.
  it("carries only the five members that are still entitlement business", () => {
    const result = useCloudFeatureFlags({
      planConfigInstance: createMockPlanConfig() as any,
      aiConfig: createMockAiConfig(false) as any,
      getTemplateId: () => null,
    });

    expect(Object.keys(result).sort()).toEqual([
      "canSendTestEmail",
      "canUseAiGeneration",
      "hasTemplateSaved",
      "templateCount",
      "templateLimit",
    ]);
  });
});
