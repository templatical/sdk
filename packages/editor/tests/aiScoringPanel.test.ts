// @vitest-environment happy-dom
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { computed, effectScope, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { useEditor, useHistory } from "@templatical/core";
import type { AiProvider, ScoringResult, Template } from "@templatical/types";
import { createDefaultTemplateContent, SdkError } from "@templatical/types";
import AiScoringPanel from "../src/components/ai/AiScoringPanel.vue";
import AiPanels from "../src/components/ai/AiPanels.vue";
import {
  type AiChatItem,
  type AiTurnOutcome,
  useAiFeature,
} from "../src/composables/useAiFeature";
import { loadTranslations } from "../src/i18n";
import {
  CAPABILITIES_KEY,
  TEMPLATE_LINT_KEY,
  TRANSLATIONS_KEY,
  UI_LOCALE_KEY,
} from "../src/keys";
import { mountEditor } from "./helpers/mount";

const RESULT: ScoringResult = {
  score: 78,
  categories: {
    spam: { score: 92, findings: [] },
    readability: {
      score: 70,
      findings: [
        {
          id: "r1",
          severity: "medium",
          message: "The intro is long.",
          blockId: "p1",
          suggestion: "Cut it.",
        },
      ],
    },
    bestPractices: {
      score: 74,
      findings: [
        {
          id: "b1",
          severity: "low",
          message: "No preheader.",
          blockId: null,
          suggestion: "Add one.",
        },
      ],
    },
  },
};

function fakeFeature(overrides: Record<string, unknown> = {}) {
  const messages = ref<AiChatItem[]>([
    {
      id: "m-1",
      role: "assistant",
      kind: "fix",
      text: "Shortened it.",
      operationCount: 1,
      undone: false,
      canUndo: true,
      canRedo: false,
      createdAt: "2026-10-21T12:00:00Z",
      status: "done",
    },
  ]);
  return {
    templateId: ref("tpl-1"),
    isAvailable: computed(() => true),
    isRunning: ref(false),
    has: (name: string) => name === "score" || name === "fixFinding",
    score: vi.fn(async () => RESULT),
    fix: vi.fn(async () => ({
      messageId: "m-1",
      operationCount: 1,
      text: "Shortened it.",
      failed: false,
    })),
    undoMessage: vi.fn(async (id: string) => {
      const message = messages.value.find((item) => item.id === id);
      if (message) {
        message.undone = true;
        message.canUndo = false;
      }
    }),
    messages,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function mountPanels(provider: Partial<AiProvider>) {
  const scope = effectScope();
  const { editor, feature } = scope.run(() => {
    const editor = useEditor({
      content: createDefaultTemplateContent(),
      templates: {
        load: async (id: string): Promise<Template> => ({
          id,
          content: {
            ...createDefaultTemplateContent(),
            blocks: [{ id: "p1", type: "paragraph", content: "<p>Intro.</p>" }],
          },
        }),
        create: false,
        save: false,
      },
    });
    const history = useHistory({
      content: editor.content,
      setContent: editor.setContent,
    });
    const feature = useAiFeature({
      provider: {
        chat: false,
        fixFinding: false,
        design: false,
        rewrite: false,
        score: false,
        suggestions: false,
        ...provider,
      } as AiProvider,
      editor,
      collaboration: null,
      history: () => history,
      reload: null,
      mergeTags: () => null,
      normalize: (ops) => [...ops],
      lintFindings: () => [],
      commentsOpen: null,
    });
    return { editor, feature };
  })!;
  await editor.load("tpl-1");
  feature.open("scoring");
  const wrapper = mountEditor(AiPanels, {
    props: { feature },
    provides: {
      [TRANSLATIONS_KEY]: await loadTranslations("en"),
      [UI_LOCALE_KEY]: "en",
    },
  });
  onTestFinished(() => {
    wrapper.unmount();
    feature.destroy();
    scope.stop();
  });
  await vi.waitFor(() =>
    expect(wrapper.findComponent(AiScoringPanel).exists()).toBe(true),
  );
  await flushPromises();
  return { wrapper, feature, editor };
}

async function mountPanel(
  feature: ReturnType<typeof fakeFeature>,
  issuesOpen = vi.fn(),
) {
  const wrapper = mountEditor(AiScoringPanel, {
    props: { feature },
    provides: {
      [TRANSLATIONS_KEY]: await loadTranslations("en"),
      [UI_LOCALE_KEY]: "en",
      [CAPABILITIES_KEY]: { issues: { open: issuesOpen } },
      [TEMPLATE_LINT_KEY]: {
        issues: ref([
          {
            ruleId: "img-alt",
            blockId: "i1",
            severity: "warning",
            message: "No alt.",
          },
          { ruleId: "x", blockId: null, severity: "error", message: "y" },
        ]),
        ready: ref(true),
        unavailable: ref(false),
        applyFix: () => {},
        destroy: () => {},
      },
    },
  });
  await flushPromises();
  return wrapper;
}

describe("AiScoringPanel (D23)", () => {
  it("scores when it opens, in three categories, and says accessibility is the linter's", async () => {
    const feature = fakeFeature();
    const issuesOpen = vi.fn();
    const wrapper = await mountPanel(feature, issuesOpen);

    expect(feature.score).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-testid="scoring-overall"]').text()).toContain(
      "78",
    );
    expect(
      wrapper
        .findAll('[data-testid="scoring-category"]')
        .map((c) => c.get("span").text().split(/\s/)[0]),
    ).toEqual(["Spam", "Readability", "Best"]);
    expect(
      wrapper.get('[data-testid="scoring-accessibility-note"]').text(),
    ).toContain("Accessibility is checked in the Issues panel.");

    await wrapper.get('[data-testid="scoring-open-issues"]').trigger("click");
    expect(wrapper.get('[data-testid="scoring-open-issues"]').text()).toBe(
      "Open Issues (2)",
    );
    expect(issuesOpen).toHaveBeenCalledTimes(1);
  });

  it("fixes any finding, the template-level one included, and offers Undo", async () => {
    const feature = fakeFeature();
    const wrapper = await mountPanel(feature);

    const fixes = wrapper.findAll('[data-testid="scoring-fix"]');
    expect(fixes).toHaveLength(2);
    await fixes[1].trigger("click");
    await flushPromises();

    expect(feature.fix).toHaveBeenCalledWith({
      id: "b1",
      message: "No preheader.",
      suggestion: "Add one.",
      category: "bestPractices",
      blockId: null,
    });
    expect(wrapper.get('[data-testid="scoring-fixed"]').text()).toContain(
      "Fixed",
    );

    await wrapper.get('[data-testid="scoring-undo-fix"]').trigger("click");
    await flushPromises();

    expect(feature.undoMessage).toHaveBeenCalledWith("m-1");
    expect(wrapper.find('[data-testid="scoring-fixed"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="scoring-fix"]')).toHaveLength(2);
  });

  it("shows the reply of a fix that changed nothing", async () => {
    const feature = fakeFeature({
      fix: vi.fn(async () => ({
        messageId: "m-2",
        operationCount: 0,
        text: "That already looks fine.",
        failed: false,
      })),
    });
    const wrapper = await mountPanel(feature);

    await wrapper.findAll('[data-testid="scoring-fix"]')[0].trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="scoring-fix-reply"]').text()).toBe(
      "That already looks fine.",
    );
  });

  it("shows why scoring failed, with a way to try again", async () => {
    const feature = fakeFeature({
      score: vi.fn(async () => {
        throw new SdkError("x", 413, "content_too_large");
      }),
    });
    const wrapper = await mountPanel(feature);

    expect(wrapper.get('[data-testid="scoring-error"]').text()).toContain(
      "This template is too large for AI.",
    );
  });

  it("hides Fix when the provider doesn't fix findings", async () => {
    const wrapper = await mountPanel(
      fakeFeature({ has: (name: string) => name === "score" }),
    );
    expect(wrapper.find('[data-testid="scoring-fix"]').exists()).toBe(false);
  });

  it("scores again after closing during the first score and reopening through AiPanels", async () => {
    let firstSignal: AbortSignal | undefined;
    const score = vi
      .fn<Exclude<AiProvider["score"], false | undefined>>()
      .mockImplementationOnce(async (_request, signal) => {
        firstSignal = signal;
        return new Promise<ScoringResult>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Stopped", "AbortError")),
            { once: true },
          );
        });
      })
      .mockResolvedValue(RESULT);
    const { wrapper, feature } = await mountPanels({ score });
    expect(score).toHaveBeenCalledTimes(1);

    await wrapper.get('[data-testid="ai-panel-close"]').trigger("click");
    await flushPromises();
    expect(firstSignal?.aborted).toBe(true);
    expect(wrapper.find('[data-testid="ai-panel-scoring"]').exists()).toBe(
      false,
    );

    feature.open("scoring");
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="scoring-overall"]').text()).toContain(
        "78",
      ),
    );
    expect(score).toHaveBeenCalledTimes(2);
  });

  it("keeps a completed score on reopening and waits until activation to score another template", async () => {
    const score = vi
      .fn<Exclude<AiProvider["score"], false | undefined>>()
      .mockResolvedValueOnce(RESULT)
      .mockResolvedValue({ ...RESULT, score: 65 });
    const { wrapper, feature, editor } = await mountPanels({ score });
    expect(wrapper.get('[data-testid="scoring-overall"]').text()).toContain(
      "78",
    );
    await wrapper.get('[data-testid="ai-panel-close"]').trigger("click");
    await flushPromises();
    feature.open("scoring");
    await flushPromises();
    expect(wrapper.get('[data-testid="scoring-overall"]').text()).toContain(
      "78",
    );
    expect(score).toHaveBeenCalledTimes(1);

    await wrapper.get('[data-testid="ai-panel-close"]').trigger("click");
    await flushPromises();
    await editor.load("tpl-2");
    await flushPromises();
    expect(score).toHaveBeenCalledTimes(1);
    feature.open("scoring");
    await vi.waitFor(() =>
      expect(wrapper.get('[data-testid="scoring-overall"]').text()).toContain(
        "65",
      ),
    );
    expect(score).toHaveBeenCalledTimes(2);
    expect(score.mock.calls[1][0].templateId).toBe("tpl-2");
  });

  it("ignores an applied fix from A after B starts its own fix, including the old cleanup", async () => {
    const { wrapper, feature, editor } = await mountPanels({
      conversation: {
        settleReplay: async () => {},
        list: async () => [],
        clear: false,
        redo: false,
        undo: async () => ({
          replayId: "replay",
          operations: [
            {
              op: "updateBlock",
              blockId: "p1",
              set: { content: "<p>Intro.</p>" },
            },
          ],
        }),
      },
      score: async () => RESULT,
      fixFinding: async (request, handlers) => {
        await handlers.onOperations([
          {
            op: "updateBlock",
            blockId: "p1",
            set: { content: "<p>Fixed.</p>" },
          },
        ]);
        return {
          messageId: request.templateId === "tpl-1" ? "fix-A" : "fix-B",
          text: "Shortened it.",
        };
      },
    });
    const appliedA = deferred<void>();
    const appliedB = deferred<void>();
    const releaseA = deferred<void>();
    const releaseB = deferred<void>();
    const runFix = feature.fix;
    let calls = 0;
    vi.spyOn(feature, "fix").mockImplementation(async (finding) => {
      const first = calls++ === 0;
      const outcome = await runFix(finding);
      (first ? appliedA : appliedB).resolve();
      // Delay delivery to the panel after the real feature applies operations.
      await (first ? releaseA : releaseB).promise;
      return outcome;
    });
    const undo = vi.spyOn(feature, "undoMessage");
    await wrapper.findAll('[data-testid="scoring-fix"]')[0].trigger("click");
    await appliedA.promise;
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Fixed.</p>",
    });
    await editor.load("tpl-2");
    await flushPromises();
    expect(feature.messages.value).toEqual([]);
    expect(wrapper.findAll('[data-testid="scoring-fix"]')).toHaveLength(2);
    expect(
      wrapper
        .findAll('[data-testid="scoring-fix"]')
        .every((button) => button.attributes("disabled") === undefined),
    ).toBe(true);

    await wrapper.findAll('[data-testid="scoring-fix"]')[0].trigger("click");
    await appliedB.promise;
    releaseA.resolve();
    await flushPromises();
    expect(wrapper.find('[data-testid="scoring-fixed"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="scoring-undo-fix"]').exists()).toBe(
      false,
    );
    expect(wrapper.findAll('[data-testid="scoring-fix"]')[0].text()).toBe(
      "Fixing...",
    );
    expect(
      wrapper.findAll('[data-testid="scoring-fix"]')[0].attributes("disabled"),
    ).toBeDefined();

    releaseB.resolve();
    await flushPromises();
    expect(wrapper.get('[data-testid="scoring-fixed"]').text()).toContain(
      "Fixed",
    );
    await wrapper.get('[data-testid="scoring-undo-fix"]').trigger("click");
    await flushPromises();
    expect(undo).toHaveBeenCalledWith("fix-B");
    expect(undo).not.toHaveBeenCalledWith("fix-A");
  });

  it("does not let an old score replace B or clear B's loading state", async () => {
    const first = deferred<ScoringResult>();
    const second = deferred<ScoringResult>();
    const feature = fakeFeature({
      score: vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise),
    });
    const wrapper = await mountPanel(feature);
    feature.templateId.value = "tpl-2";
    await flushPromises();
    expect(feature.score).toHaveBeenCalledTimes(2);
    first.resolve(RESULT);
    await flushPromises();
    expect(wrapper.find('[data-testid="scoring-overall"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).toContain("Scoring the template...");
    second.resolve({ ...RESULT, score: 65 });
    await flushPromises();
    expect(wrapper.get('[data-testid="scoring-overall"]').text()).toContain(
      "65",
    );
  });

  it.each([1, 0])(
    "ignores a fix with %i operations after scoring restarts",
    async (operationCount) => {
      const pending = deferred<AiTurnOutcome>();
      const feature = fakeFeature({ fix: vi.fn(() => pending.promise) });
      const wrapper = await mountPanel(feature);
      await wrapper.findAll('[data-testid="scoring-fix"]')[0].trigger("click");
      await wrapper.get('[data-testid="scoring-rescore"]').trigger("click");
      await flushPromises();
      pending.resolve({
        messageId: "m-1",
        operationCount,
        text: "Old reply.",
        failed: false,
      });
      await flushPromises();
      expect(wrapper.find('[data-testid="scoring-fixed"]').exists()).toBe(
        false,
      );
      expect(wrapper.find('[data-testid="scoring-fix-reply"]').exists()).toBe(
        false,
      );
      expect(wrapper.findAll('[data-testid="scoring-fix"]')).toHaveLength(2);
    },
  );

  it("does not let an old Undo remove a newer fix after scoring restarts", async () => {
    const pendingUndo = deferred<void>();
    const feature = fakeFeature({
      undoMessage: vi.fn(() => pendingUndo.promise),
    });
    const wrapper = await mountPanel(feature);
    await wrapper.findAll('[data-testid="scoring-fix"]')[0].trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="scoring-undo-fix"]').trigger("click");
    await wrapper.get('[data-testid="scoring-rescore"]').trigger("click");
    await flushPromises();
    feature.messages.value.push({ ...feature.messages.value[0], id: "m-2" });
    feature.fix.mockResolvedValue({
      messageId: "m-2",
      operationCount: 1,
      text: "New fix.",
      failed: false,
    });
    await wrapper.findAll('[data-testid="scoring-fix"]')[0].trigger("click");
    await flushPromises();
    feature.messages.value[0].undone = true;
    pendingUndo.resolve();
    await flushPromises();
    expect(wrapper.get('[data-testid="scoring-fixed"]').text()).toContain(
      "Fixed",
    );
    expect(wrapper.findAll('[data-testid="scoring-fix"]')).toHaveLength(1);
  });

  it("keeps Fixed but hides Undo when the fix's assistant message cannot undo", async () => {
    const feature = fakeFeature();
    feature.messages.value[0].canUndo = false;
    const wrapper = await mountPanel(feature);
    await wrapper.findAll('[data-testid="scoring-fix"]')[0].trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="scoring-fixed"]').text()).toContain(
      "Fixed",
    );
    expect(wrapper.find('[data-testid="scoring-undo-fix"]').exists()).toBe(
      false,
    );
    expect(feature.undoMessage).not.toHaveBeenCalled();
  });

  it("restores Fix when the associated message is undone from chat", async () => {
    const feature = fakeFeature();
    const wrapper = await mountPanel(feature);
    await wrapper.findAll('[data-testid="scoring-fix"]')[0].trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="scoring-fixed"]').exists()).toBe(true);
    feature.messages.value[0].undone = true;
    feature.messages.value[0].canUndo = false;
    await flushPromises();
    expect(wrapper.find('[data-testid="scoring-fixed"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="scoring-fix"]')).toHaveLength(2);
    expect(feature.undoMessage).not.toHaveBeenCalled();
  });
});


it.each([1, 0])("keeps fix state and replies separate for shared ids across categories (%i operations)", async (operationCount) => {
  const result = structuredClone(RESULT);
  result.categories.bestPractices.findings[0].id = "r1";
  const feature = fakeFeature({ score: vi.fn(async () => result), fix: vi.fn(async () => ({ messageId: "m-1", operationCount, text: "One finding's reply", failed: false })) });
  const wrapper = await mountPanel(feature);
  await wrapper.findAll('[data-testid="scoring-fix"]')[0].trigger("click");
  await flushPromises();
  if (operationCount > 0) {
    expect(wrapper.findAll('[data-testid="scoring-fixed"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-testid="scoring-fix"]')).toHaveLength(1);
  } else expect(wrapper.findAll('[data-testid="scoring-fix-reply"]')).toHaveLength(1);
  wrapper.unmount();
});
