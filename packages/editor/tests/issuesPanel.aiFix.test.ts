// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { useEditor, useHistory } from "@templatical/core";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  SdkError,
  type AiProvider,
  type AiFixRequest,
  type AiTurnHandlers,
  type Template,
} from "@templatical/types";
import type { LintIssue } from "@templatical/quality";
import IssuesPanel from "../src/components/sidebar/IssuesPanel.vue";
import {
  AI_FEATURE_KEY,
  EDITOR_KEY,
  TEMPLATE_LINT_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import {
  useAiFeature,
  type UseAiFeatureOptions,
} from "../src/composables/useAiFeature";
import { useTemplateLint } from "../src/composables/useTemplateLint";
import en from "../src/i18n/locales/en";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});
const issue = (patch: Partial<LintIssue> = {}): LintIssue => ({
  ruleId: "a11y.text-all-caps",
  blockId: "p1",
  severity: "warning",
  message: "All caps.",
  suggestion: "Use sentence case.",
  reference: "https://docs.templatical.com/quality/",
  ...patch,
});
const fixed = '[data-testid="issue-ai-fix"]';
const flagged = "Still flagged after the fix";

async function setup(
  findings = [issue()],
  options: {
    absent?: boolean;
    disabled?: boolean;
    unloaded?: boolean;
    liveLint?: boolean;
    load?: (id: string) => Promise<Template>;
    reload?: UseAiFeatureOptions["reload"];
    run?: (
      request: AiFixRequest,
      on: AiTurnHandlers,
      signal: AbortSignal,
    ) => Promise<{ messageId: string | null; text: string }>;
  } = {},
) {
  const content = createDefaultTemplateContent();
  content.blocks = [
    createParagraphBlock({
      id: "p1",
      content: "<p>THIS IS A LONG ALL CAPS SENTENCE</p>",
    }),
  ];
  const scope = effectScope();
  cleanups.push(() => scope.stop());
  const requests: AiFixRequest[] = [];
  const state = scope.run(() => {
    const editor = useEditor({
      content,
      templates: {
        load: options.load ?? (async (id) => ({ id, content })),
        create: false,
        save: false,
      },
    });
    const history = useHistory({
      content: editor.content,
      setContent: editor.setContent,
    });
    const fixFinding: AiProvider["fixFinding"] = options.disabled
      ? false
      : async (request, on, signal) => {
          requests.push(request);
          if (options.run) return options.run(request, on, signal);
          await on.onOperations([
            {
              op: "updateBlock",
              blockId: "p1",
              set: { content: "<p>Sentence case.</p>" },
            },
          ]);
          await on.onOperations([
            {
              op: "updateSettings",
              set: { preheaderText: "A useful opening" },
            },
          ]);
          return { messageId: null, text: "Fixed." };
        };
    const ai = useAiFeature({
      provider: {
        chat: false,
        fixFinding,
        rewrite: false,
        chatAttachments: false,
      },
      editor,
      history: () => history,
      collaboration: null,
      reload: options.reload ?? null,
      mergeTags: () => ({ syntax: "liquid", tags: [] }),
      normalize: (ops) => [...ops],
      commentsOpen: null,
    });
    const lint = options.liveLint
      ? useTemplateLint({
          content: editor.content,
          options: {
            structure: false,
            links: false,
            deliverability: false,
            compatibility: false,
          },
          updateBlock: editor.updateBlock,
          updateSettings: editor.updateSettings,
          removeBlock: editor.removeBlock,
        })
      : {
          issues: ref(findings),
          ready: ref(true),
          unavailable: ref(false),
          applyFix: vi.fn(),
          destroy: () => {},
        };
    return { editor, history, ai, lint };
  })!;
  cleanups.push(state.lint.destroy);
  if (!options.unloaded) await state.editor.load("tpl-1");
  if (options.liveLint)
    await vi.waitFor(() => expect(state.lint.ready.value).toBe(true));
  const wrapper = mount(IssuesPanel, {
    global: {
      provide: {
        [EDITOR_KEY as symbol]: state.editor,
        [TEMPLATE_LINT_KEY as symbol]: state.lint,
        [TRANSLATIONS_KEY as symbol]: en,
        ...(options.absent ? {} : { [AI_FEATURE_KEY as symbol]: state.ai }),
      },
    },
  });
  cleanups.push(() => wrapper.unmount());
  return { ...state, wrapper, requests };
}

describe("IssuesPanel Fix with AI", () => {
  it("gates by allowlist and deterministic fix, preserving Learn more and Fix", async () => {
    const { wrapper } = await setup([
      issue(),
      issue({ blockId: "p2", ruleId: "link.relative-url" }),
      issue({
        blockId: "p3",
        fix: { description: "Local fix", apply: vi.fn() },
      }),
      issue({ blockId: "p4", ruleId: "a11y.img-missing-alt" }),
    ]);
    expect(wrapper.findAll(fixed)).toHaveLength(1);
    expect(wrapper.findAll("a")).toHaveLength(4);
    expect(
      wrapper.findAll("button").filter((b) => b.text() === "Fix"),
    ).toHaveLength(1);
  });
  it.each(["absent", "disabled", "unloaded"] as const)(
    "hides the button when AI is %s",
    async (key) => {
      const { wrapper } = await setup([issue()], { [key]: true });
      expect(wrapper.find(fixed).exists()).toBe(false);
    },
  );
  it.each(["error", "warning", "info"] as const)(
    "offers the button for severity %s and sends exactly the lint projection",
    async (severity) => {
      const { wrapper, requests } = await setup([
        issue({ severity, clients: [], excerpt: "CAPS" }),
      ]);
      await wrapper.get(fixed).trigger("click");
      await flushPromises();
      expect(requests).toHaveLength(1);
      expect(requests[0].finding).toEqual({
        ruleId: "a11y.text-all-caps",
        blockId: "p1",
        message: "All caps.",
        suggestion: "Use sentence case.",
        reference: "https://docs.templatical.com/quality/",
        excerpt: "CAPS",
      });
    },
  );
  it("waits for the real 500ms debounced lint update before marking an unfixed pair", async () => {
    const { wrapper, lint } = await setup([], {
      liveLint: true,
      run: async (_request, on) => {
        await on.onOperations([
          { op: "updateSettings", set: { backgroundColor: "#123456" } },
        ]);
        return { messageId: null, text: "Done." };
      },
    });
    vi.useFakeTimers();
    expect(
      lint.issues.value.some((i) => i.ruleId === "a11y.text-all-caps"),
    ).toBe(true);
    await wrapper.get(fixed).trigger("click");
    await flushPromises();
    expect(wrapper.text()).not.toContain(flagged);
    await vi.advanceTimersByTimeAsync(499);
    expect(wrapper.text()).not.toContain(flagged);
    await vi.advanceTimersByTimeAsync(1);
    expect(wrapper.text()).toContain(flagged);
  });
  it("removes a resolved row only after re-lint and clears a later recurrence's status", async () => {
    const { wrapper, lint } = await setup();
    await wrapper.get(fixed).trigger("click");
    await flushPromises();
    expect(wrapper.text()).not.toContain(flagged);
    lint.issues.value = [issue()];
    await nextTick();
    expect(wrapper.text()).toContain(flagged);
    lint.issues.value = [];
    await nextTick();
    expect(wrapper.find(fixed).exists()).toBe(false);
    lint.issues.value = [issue()];
    await nextTick();
    expect(wrapper.text()).not.toContain(flagged);
    await wrapper.get(fixed).trigger("click");
    await flushPromises();
    lint.issues.value = [];
    await nextTick();
    expect(wrapper.text()).not.toContain(flagged);
    expect(wrapper.find(fixed).exists()).toBe(false);
  });
  it("offers one button per repeated domain-mismatch pair and stays honest when one hit remains", async () => {
    const first = issue({
      ruleId: "deliverability.link-text-domain-mismatch",
      excerpt: "one.example",
    });
    const second = { ...first, excerpt: "two.example" };
    const { wrapper, lint } = await setup([first, second]);
    expect(wrapper.findAll(fixed)).toHaveLength(1);
    await wrapper.get(fixed).trigger("click");
    await flushPromises();
    lint.issues.value = [second];
    await nextTick();
    expect(wrapper.text()).toContain(flagged);
    expect(wrapper.findAll(fixed)).toHaveLength(1);
  });
  it("sends template-level low-text findings with blockId null", async () => {
    const { wrapper, requests } = await setup([
      issue({ ruleId: "deliverability.low-text", blockId: null }),
    ]);
    await wrapper.get(fixed).trigger("click");
    await flushPromises();
    expect(requests[0].finding).toEqual({
      ruleId: "deliverability.low-text",
      blockId: null,
      message: "All caps.",
      suggestion: "Use sentence case.",
      reference: "https://docs.templatical.com/quality/",
    });
  });
  it("disables every fix while busy, labels the running one and stops through the turn path", async () => {
    const { wrapper, ai, lint } = await setup(
      [issue(), issue({ blockId: "p2" })],
      {
        run: async (_request, _on, signal) =>
          new Promise((_resolve, reject) =>
            signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            ),
          ),
      },
    );
    await wrapper.get(fixed).trigger("click");
    await flushPromises();
    expect(ai.busy.value).toBe(true);
    expect(
      wrapper
        .findAll(fixed)
        .every((b) => b.attributes("disabled") !== undefined),
    ).toBe(true);
    expect(wrapper.get(fixed).text()).toBe("Fix with AI");
    expect(wrapper.get('[data-testid="issue-ai-status"]').text()).toContain(
      "Fixing…",
    );
    expect(wrapper.find('li [data-testid="issue-ai-stop"]').exists()).toBe(
      false,
    );
    await wrapper.get('[data-testid="issue-ai-stop"]').trigger("click");
    await flushPromises();
    expect(ai.busy.value).toBe(false);
    lint.issues.value = [issue()];
    await nextTick();
    expect(wrapper.text()).not.toContain(flagged);
  });
  it("keeps one panel-level Stop after re-lint removes the active finding", async () => {
    let aborted = false;
    const { wrapper, ai, editor, lint } = await setup([], {
      liveLint: true,
      run: async (_request, on, signal) => {
        await on.onOperations([
          {
            op: "updateBlock",
            blockId: "p1",
            set: { content: "<p>Sentence case.</p>" },
          },
        ]);
        return new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(new DOMException("Stopped", "AbortError"));
          }),
        );
      },
    });
    const stop = vi.spyOn(ai, "stop");
    const fix = vi.spyOn(ai, "fix");
    vi.useFakeTimers();
    const row = wrapper
      .findAll("li")
      .find((row) => row.text().includes("a11y.text-all-caps"))!;
    await row.get(fixed).trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(500);
    expect(
      lint.issues.value.some((issue) => issue.ruleId === "a11y.text-all-caps"),
    ).toBe(false);
    expect(
      wrapper
        .findAll("li")
        .some((row) => row.text().includes("a11y.text-all-caps")),
    ).toBe(false);
    expect(ai.busy.value).toBe(true);
    expect(wrapper.findAll('[data-testid="issue-ai-status"]')).toHaveLength(1);
    expect(wrapper.get('[data-testid="issue-ai-status"]').text()).toContain(
      "Fixing…",
    );
    expect(wrapper.find('li [data-testid="issue-ai-status"]').exists()).toBe(
      false,
    );
    await wrapper
      .get('[data-testid="issue-ai-status"] [data-testid="issue-ai-stop"]')
      .trigger("click");
    await flushPromises();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(aborted).toBe(true);
    expect(await fix.mock.results[0].value).toMatchObject({ failed: true });
    expect(wrapper.find('[data-testid="issue-ai-status"]').exists()).toBe(
      false,
    );
    editor.updateBlock("p1", {
      content: "<p>THIS IS A LONG ALL CAPS SENTENCE</p>",
    });
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);
    expect(wrapper.text()).not.toContain(flagged);
  });
  it("does not verify a fix stopped through the shared AI lane", async () => {
    const { wrapper, ai, lint } = await setup([issue()], {
      run: async (_request, on, signal) => {
        await on.onOperations([
          { op: "updateSettings", set: { preheaderText: "Partial edit" } },
        ]);
        return new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          ),
        );
      },
    });
    await wrapper.get(fixed).trigger("click");
    await flushPromises();
    ai.stop();
    await flushPromises();
    lint.issues.value = [issue()];
    await nextTick();
    expect(wrapper.text()).not.toContain(flagged);
  });
  it("does not verify a server-applied fix stopped during its deferred final reload", async () => {
    let finishReload!: () => void;
    const reloaded = new Promise<void>((resolve) => {
      finishReload = resolve;
    });
    const reload = vi.fn(() => reloaded);
    const { wrapper, ai, lint } = await setup([issue()], {
      reload,
      run: async (_request, on) => {
        on.onApplied({ batchId: "server-fix", revision: 2, operationCount: 1 });
        return { messageId: null, text: "Fixed on the server." };
      },
    });
    const fix = vi.spyOn(ai, "fix");
    await wrapper.get(fixed).trigger("click");
    await flushPromises();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(ai.busy.value).toBe(true);
    await wrapper.get('[data-testid="issue-ai-stop"]').trigger("click");
    finishReload();
    const outcome = await fix.mock.results[0].value;
    await flushPromises();
    lint.issues.value = [issue()];
    await nextTick();
    expect(wrapper.text()).not.toContain(flagged);
    expect(outcome).toMatchObject({ failed: true, operationCount: 1 });
    expect(wrapper.find('[data-testid="issue-ai-status"]').exists()).toBe(
      false,
    );
  });
  it("clears verification status when a different template uses the same block and rule ids", async () => {
    const { wrapper, editor, lint } = await setup();
    await wrapper.get(fixed).trigger("click");
    await flushPromises();
    lint.issues.value = [issue()];
    await nextTick();
    expect(wrapper.text()).toContain(flagged);
    await editor.load("tpl-2");
    lint.issues.value = [issue()];
    await nextTick();
    expect(wrapper.text()).not.toContain(flagged);
  });
  it("disables fixes during other AI work", async () => {
    const { wrapper, ai } = await setup();
    ai.busy.value = true;
    await nextTick();
    expect(wrapper.get(fixed).attributes("disabled")).toBeDefined();
    expect(wrapper.find('[data-testid="issue-ai-stop"]').exists()).toBe(false);
  });
  it("does not verify a failed turn", async () => {
    const { wrapper, lint } = await setup([issue()], {
      run: async () => {
        throw new SdkError("Unavailable", 503, "ai_provider_error");
      },
    });
    await wrapper.get(fixed).trigger("click");
    await flushPromises();
    lint.issues.value = [issue()];
    await nextTick();
    expect(wrapper.text()).not.toContain(flagged);
  });
  it("reverts all fix batches in one undo step", async () => {
    const { wrapper, editor, history, ai } = await setup();
    const before = JSON.stringify(editor.content.value);
    await wrapper.get(fixed).trigger("click");
    await flushPromises();
    expect(editor.content.value.blocks[0]).toMatchObject({
      content: "<p>Sentence case.</p>",
    });
    expect(editor.content.value.settings.preheaderText).toBe(
      "A useful opening",
    );
    expect(ai.messages.value.at(-1)).toMatchObject({
      kind: "fix",
      operationCount: 2,
    });
    history.undo();
    expect(JSON.stringify(editor.content.value)).toBe(before);
    expect(history.canUndo.value).toBe(false);
  });
});

it.each(["streaming", "no-op"])("verifies remaining finding after %s fix using the covered lint result", async (mode) => {
  let finish!: () => void;
  const { wrapper, lint } = await setup([], {
    liveLint: true,
    run: async (_request, on) => {
      if (mode === "streaming") {
        await on.onOperations([{ op: "updateSettings", set: { backgroundColor: "#123456" } }]);
        await new Promise<void>((resolve) => { finish = resolve; });
      }
      return { messageId: null, text: "Done" };
    },
  });
  vi.useFakeTimers();
  try {
    await wrapper.get(fixed).trigger("click");
    await flushPromises();
    if (mode === "streaming") {
      await vi.advanceTimersByTimeAsync(500);
      expect(lint.issues.value.some((hit) => hit.ruleId === "a11y.text-all-caps")).toBe(true);
      finish();
      await flushPromises();
    }
    expect(wrapper.text()).toContain(flagged);
  } finally { vi.useRealTimers(); }
});


it.each([true, false])("verifies a server-applied fix after its own reload (remaining hit: %s)", async (remains) => {
  let loads = 0;
  const reload = vi.fn((id: string, guard?: () => boolean) => editor.load(id, guard));
  const { wrapper, editor, ai, lint } = await setup([], {
    liveLint: true,
    reload,
    load: async (id) => {
      const content = createDefaultTemplateContent();
      content.settings.preheaderText = "A useful preview";
      content.blocks = [createParagraphBlock({ id: "p1", content: ++loads === 1 || remains ? "<p>THIS IS A LONG ALL CAPS SENTENCE</p>" : "<p>Sentence case.</p>" })];
      return { id, content };
    },
    run: async (_request, on) => {
      on.onApplied({ batchId: "server-fix", revision: 2, operationCount: 1 });
      return { messageId: null, text: "Fixed on server" };
    },
  });
  const loadVersion = editor.loadVersion.value;
  const fix = vi.spyOn(ai, "fix");
  vi.useFakeTimers();
  try {
    await wrapper.get(fixed).trigger("click");
    await flushPromises();
    expect(await fix.mock.results[0].value).toMatchObject({ failed: false, operationCount: 1 });
    expect(reload).toHaveBeenCalledExactlyOnceWith("tpl-1", expect.any(Function));
    expect(editor.loadVersion.value).toBe(loadVersion + 1);
    await vi.advanceTimersByTimeAsync(500);
    expect(lint.issues.value.some((hit) => hit.ruleId === "a11y.text-all-caps")).toBe(remains);
    expect(wrapper.text().includes(flagged)).toBe(remains);
    if (!remains) {
      expect(wrapper.findAll("li")).toHaveLength(0);
      expect(wrapper.text()).toContain(en.issues.emptyState);
    }
  } finally { vi.useRealTimers(); }
});

it.each(["tpl-1", "tpl-2"])("rejects verification after an external committed load of %s", async (id) => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const { wrapper, editor, lint } = await setup([issue()], {
    run: async (_r, on) => {
      await on.onOperations([{ op: "updateSettings", set: { preheaderText: "AI edit" } }]);
      await pending;
      return { messageId: null, text: "Done" };
    },
  });
  await wrapper.get(fixed).trigger("click");
  await flushPromises();
  await editor.load(id);
  finish();
  await flushPromises();
  lint.issues.value = [issue()];
  await nextTick();
  expect(wrapper.text()).not.toContain(flagged);
  expect(editor.state.template?.id).toBe(id);
});


it("clears completed fix verification when the author reloads the same template", async () => {
  const { wrapper, editor, lint } = await setup();
  await wrapper.get(fixed).trigger("click");
  await flushPromises();
  lint.issues.value = [issue()];
  await nextTick();
  expect(wrapper.text()).toContain(flagged);
  await editor.load("tpl-1");
  lint.issues.value = [issue()];
  await nextTick();
  expect(wrapper.text()).not.toContain(flagged);
});
