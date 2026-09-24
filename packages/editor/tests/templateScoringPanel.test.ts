// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import type { ScoringFinding, ScoringResult } from "@templatical/types";
import {
  CLOUD_TRANSLATIONS_KEY,
  EDITOR_KEY,
  MERGE_TAGS_KEY,
  SCORING_KEY,
} from "../src/keys";
import cloudEn from "../src/i18n/locales/cloud/en";
import TemplateScoringPanel from "../src/cloud/components/TemplateScoringPanel.vue";

function emptyCategories(): ScoringResult["categories"] {
  return {
    spam: { score: 90, findings: [] },
    readability: { score: 80, findings: [] },
    accessibility: { score: 70, findings: [] },
    bestPractices: { score: 60, findings: [] },
  };
}

function finding(overrides: Partial<ScoringFinding> = {}): ScoringFinding {
  return {
    id: "f1",
    severity: "high",
    message: "Alt text is missing",
    blockId: "b1",
    category: "accessibility",
    suggestion: "Describe the image",
    ...overrides,
  };
}

function createScoring(result: ScoringResult | null = null) {
  return {
    isScoring: ref(false),
    scoringResult: ref<ScoringResult | null>(result),
    error: ref<string | null>(null),
    fixingFindingId: ref<string | null>(null),
    fixStreamingText: ref(""),
    fixError: ref<string | null>(null),
    score: vi.fn(async () => result),
    fixFinding: vi.fn(async () => "<p>fixed</p>"),
    removeFinding: vi.fn(),
    reset: vi.fn(),
  };
}

const editor = {
  content: ref({
    blocks: [{ id: "b1", type: "paragraph", content: "<p>hi</p>" }],
    settings: {},
  }),
  updateBlock: vi.fn(),
};

function mountPanel(
  scoring: ReturnType<typeof createScoring>,
  visible = false,
) {
  return mount(TemplateScoringPanel, {
    props: { visible },
    global: {
      provide: {
        [CLOUD_TRANSLATIONS_KEY as symbol]: cloudEn,
        [EDITOR_KEY as symbol]: editor,
        [SCORING_KEY as symbol]: scoring,
        [MERGE_TAGS_KEY as symbol]: ref([]),
      },
      stubs: { Transition: false },
    },
  });
}

describe("TemplateScoringPanel", () => {
  it("scores on first open when there is no result yet", async () => {
    const scoring = createScoring(null);
    const wrapper = mountPanel(scoring, false);
    expect(scoring.score).not.toHaveBeenCalled();

    await wrapper.setProps({ visible: true });
    await flushPromises();
    expect(scoring.score).toHaveBeenCalledTimes(1);
    expect(scoring.score).toHaveBeenCalledWith(editor.content.value, []);
  });

  it("does not auto-score when a result is already on the panel", async () => {
    const scoring = createScoring({
      score: 88,
      categories: emptyCategories(),
    });
    const wrapper = mountPanel(scoring, false);
    await wrapper.setProps({ visible: true });
    await flushPromises();
    expect(scoring.score).not.toHaveBeenCalled();
  });

  it("does not auto-score while a run is already in flight", async () => {
    const scoring = createScoring(null);
    scoring.isScoring.value = true;
    const wrapper = mountPanel(scoring, false);
    await wrapper.setProps({ visible: true });
    await flushPromises();
    expect(scoring.score).not.toHaveBeenCalled();
  });

  it("rescores from the header once a result is showing", async () => {
    const scoring = createScoring({
      score: 88,
      categories: emptyCategories(),
    });
    const wrapper = mountPanel(scoring, false);
    await wrapper.setProps({ visible: true });
    await nextTick();

    await wrapper
      .get(`button[aria-label="${cloudEn.scoring.rescore}"]`)
      .trigger("click");
    expect(scoring.score).toHaveBeenCalledTimes(1);
  });

  it("retries from the error state", async () => {
    const scoring = createScoring(null);
    scoring.error.value = "failed";
    const wrapper = mountPanel(scoring, false);
    await wrapper.setProps({ visible: true });
    await nextTick();
    expect(wrapper.text()).toContain("Failed to analyze template");

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Re-score"))!
      .trigger("click");
    expect(scoring.score).toHaveBeenCalled();
  });

  it("collapses a category and counts findings", async () => {
    const hit = finding();
    const scoring = createScoring({
      score: 72,
      categories: {
        ...emptyCategories(),
        accessibility: { score: 40, findings: [hit] },
      },
    });
    const wrapper = mountPanel(scoring, false);
    await wrapper.setProps({ visible: true });
    await nextTick();

    expect(wrapper.text()).toContain("72");
    expect(wrapper.text()).toContain("1");
    expect(wrapper.text()).toContain("Alt text is missing");
    expect(wrapper.text()).toContain("Describe the image");

    const a11y = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Accessibility"))!;
    await a11y.trigger("click");
    await nextTick();
    expect(wrapper.text()).not.toContain("Alt text is missing");
  });

  it("applies a fix to the named block and drops the finding", async () => {
    const hit = finding();
    const scoring = createScoring({
      score: 40,
      categories: {
        ...emptyCategories(),
        accessibility: { score: 40, findings: [hit] },
      },
    });
    const wrapper = mountPanel(scoring, false);
    await wrapper.setProps({ visible: true });
    await nextTick();

    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Fix with AI")!
      .trigger("click");
    await flushPromises();

    expect(scoring.fixFinding).toHaveBeenCalledWith("<p>hi</p>", hit, []);
    expect(editor.updateBlock).toHaveBeenCalledWith("b1", {
      content: "<p>fixed</p>",
    });
    expect(scoring.removeFinding).toHaveBeenCalledWith("accessibility", "f1");
  });

  it("skips a fix with no block, a missing block, or no content", async () => {
    const scoring = createScoring({
      score: 40,
      categories: {
        ...emptyCategories(),
        accessibility: {
          score: 40,
          findings: [
            finding({ id: "none", blockId: null, message: "whole template" }),
          ],
        },
      },
    });
    const wrapper = mountPanel(scoring, false);
    await wrapper.setProps({ visible: true });
    await nextTick();
    expect(
      wrapper.findAll("button").some((b) => b.text() === "Fix with AI"),
    ).toBe(false);

    scoring.scoringResult.value = {
      score: 40,
      categories: {
        ...emptyCategories(),
        accessibility: {
          score: 40,
          findings: [finding({ blockId: "missing" })],
        },
      },
    };
    await nextTick();
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Fix with AI")!
      .trigger("click");
    await flushPromises();
    expect(scoring.fixFinding).not.toHaveBeenCalled();
    expect(editor.updateBlock).not.toHaveBeenCalled();
  });

  it("closes from the header", async () => {
    const scoring = createScoring(null);
    const wrapper = mountPanel(scoring, false);
    await wrapper.setProps({ visible: true });
    await nextTick();
    await wrapper
      .get(`button[aria-label="${cloudEn.scoring.close}"]`)
      .trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
