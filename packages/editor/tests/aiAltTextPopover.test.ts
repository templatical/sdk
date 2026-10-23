// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { useEditor, useHistory } from "@templatical/core";
import {
  createDefaultTemplateContent,
  createImageBlock,
  SdkError,
  type AiProvider,
} from "@templatical/types";
import { lintAccessibility } from "@templatical/quality";
import IssuesPanel from "../src/components/sidebar/IssuesPanel.vue";
import { useAiFeature } from "../src/composables/useAiFeature";
import {
  AI_FEATURE_KEY,
  EDITOR_KEY,
  TEMPLATE_LINT_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import en from "../src/i18n/locales/en";
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});
async function setup(
  altText: AiProvider["altText"] = async () => ({ alt: "Shop new arrivals" }),
) {
  const content = createDefaultTemplateContent();
  content.blocks = [
    createImageBlock({ id: "i", src: "https://example.com/i.png", alt: "" }),
  ];
  const scope = effectScope();
  const state = scope.run(() => {
    const editor = useEditor({
      content,
      templates: {
        load: async (id) => ({ id, content }),
        create: false,
        save: false,
      },
    });
    const history = useHistory({
      content: editor.content,
      setContent: editor.setContent,
    });
    const ai = useAiFeature({
      provider: {
        chat: false,
        rewrite: false,
        chatAttachments: false,
        fixFinding: async () => ({ messageId: null, text: "" }),
        altText,
      },
      editor,
      history: () => history,
      collaboration: null,
      reload: null,
      mergeTags: () => null,
      normalize: (ops) => [...ops],
      commentsOpen: null,
    });
    return { editor, ai, history };
  })!;
  await state.editor.load("t");
  const base = {
    blockId: "i",
    severity: "warning" as const,
    message: "Missing alt",
    suggestion: "Write alt",
    reference: "https://example.com/rule",
  };
  const issues = ref([
    { ...base, ruleId: "a11y.img-missing-alt" },
    { ...base, ruleId: "a11y.img-linked-no-context" },
    { ...base, blockId: "p", ruleId: "a11y.text-all-caps" },
  ]);
  const wrapper = mount(IssuesPanel, {
    attachTo: document.body,
    global: {
      provide: {
        [EDITOR_KEY as symbol]: state.editor,
        [AI_FEATURE_KEY as symbol]: state.ai,
        [TRANSLATIONS_KEY as symbol]: en,
        [TEMPLATE_LINT_KEY as symbol]: {
          issues,
          unavailable: ref(false),
          applyFix: vi.fn(),
        },
      },
    },
  });
  cleanups.push(
    () => scope.stop(),
    state.ai.destroy,
    () => wrapper.unmount(),
  );
  return { ...state, wrapper, issues };
}
const button = (
  wrapper: Awaited<ReturnType<typeof setup>>["wrapper"],
  name: string,
) => wrapper.findAll("button").find((b) => b.text() === name)!;
async function open(wrapper: Awaited<ReturnType<typeof setup>>["wrapper"]) {
  const entry = button(wrapper, "Write alt text");
  expect(entry).toBeDefined();
  await entry.trigger("click");
  await flushPromises();
  await vi.waitFor(() => expect(wrapper.find("textarea").exists()).toBe(true));
  return entry;
}
describe("AiAltTextPopover in IssuesPanel", () => {
  it("refuses input while a deferred draft is busy, then enables its result for editing", async () => {
    let finish!: (answer: { alt: string }) => void;
    const { wrapper } = await setup(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await open(wrapper);
    const textarea = wrapper.get("textarea");
    expect(textarea.element.disabled).toBe(true);
    expect(textarea.element.readOnly).toBe(true);
    expect(textarea.attributes("aria-busy")).toBe("true");
    // happy-dom has no native keyboard text insertion. Deliver an input attempt
    // directly as well as checking the browser's disabled/read-only contract.
    textarea.element.value = "Author's attempt while drafting";
    textarea.element.dispatchEvent(new Event("input", { bubbles: true }));
    await nextTick();
    expect(textarea.element.value).toBe("");
    finish({ alt: "The completed draft" });
    await flushPromises();
    expect(textarea.element.value).toBe("The completed draft");
    expect(textarea.element.disabled).toBe(false);
    expect(textarea.element.readOnly).toBe(false);
    expect(textarea.attributes("aria-busy")).toBe("false");
    await textarea.setValue("The author's edit");
    expect(textarea.element.value).toBe("The author's edit");
  });

  it("keeps an author's edit after Stop even when the stopped provider later resolves", async () => {
    let finish!: (answer: { alt: string }) => void;
    const { wrapper } = await setup(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await open(wrapper);
    await button(wrapper, "Stop").trigger("click");
    await flushPromises();
    const textarea = wrapper.get("textarea");
    expect(textarea.element.disabled).toBe(false);
    expect(textarea.element.readOnly).toBe(false);
    expect(textarea.attributes("aria-busy")).toBe("false");
    await textarea.setValue("The author's replacement");
    finish({ alt: "Late provider text" });
    await flushPromises();
    expect(textarea.element.value).toBe("The author's replacement");
  });

  it.each(["remove and restore", "replace rule", "delete block"] as const)(
    "closes the owned row on %s, aborts, and requires a fresh click to draft again",
    async (change) => {
      const drafts: Array<{
        signal: AbortSignal;
        finish: (answer: { alt: string }) => void;
      }> = [];
      const { wrapper, editor, issues } = await setup(
        (_r, signal) =>
          new Promise((resolve) => {
            drafts.push({ signal, finish: resolve });
          }),
      );
      const originalIssues = issues.value.map((issue) => ({ ...issue }));
      const originalImage = editor.content.value.blocks[0];
      await open(wrapper);
      expect(drafts).toHaveLength(1);
      if (change === "remove and restore")
        issues.value = issues.value.filter((issue) => issue.blockId !== "i");
      else if (change === "replace rule")
        issues.value = issues.value.map((issue, index) =>
          index === 0 ? { ...issue, ruleId: "a11y.img-alt-too-long" } : issue,
        );
      else editor.removeBlock("i");
      await flushPromises();
      expect(drafts[0].signal.aborted).toBe(true);
      expect(wrapper.find("textarea").exists()).toBe(false);
      expect(wrapper.find('[data-testid="issue-ai-status"]').exists()).toBe(
        false,
      );
      expect(document.activeElement).toBe(wrapper.get("h3").element);
      expect(drafts).toHaveLength(1);
      // The author can focus another action. Restored findings and late answers
      // must not mount a new review or take that focus away.
      const otherAction = button(wrapper, "Fix with AI");
      otherAction.element.focus();
      if (change === "delete block") editor.addBlock(originalImage);
      issues.value = originalIssues;
      await flushPromises();
      drafts[0].finish({ alt: "Late draft for the old row" });
      await flushPromises();
      expect(wrapper.find("textarea").exists()).toBe(false);
      expect(drafts).toHaveLength(1);
      expect(document.activeElement).toBe(otherAction.element);
      await button(wrapper, "Write alt text").trigger("click");
      await flushPromises();
      expect(drafts).toHaveLength(2);
      expect(drafts[1].signal.aborted).toBe(false);
      expect(wrapper.get("textarea").element.disabled).toBe(true);
    },
  );

  it("offers one action per image and accepts the edited draft with decorative false", async () => {
    const { wrapper, editor, ai } = await setup();
    expect(
      wrapper.findAll("button").filter((b) => b.text() === "Write alt text"),
    ).toHaveLength(1);
    const entry = await open(wrapper);
    const textarea = wrapper.get("textarea");
    expect(textarea.element.value).toBe("Shop new arrivals");
    expect(textarea.attributes("aria-label")).toBe("Alt text");
    expect(document.activeElement).toBe(textarea.element);
    expect(wrapper.text()).toContain(
      "Drafted by AI. Check that it says what the image is for.",
    );
    await textarea.setValue("Edited purpose");
    await button(wrapper, "Accept").trigger("click");
    await flushPromises();
    expect(editor.content.value.blocks[0]).toMatchObject({
      alt: "Edited purpose",
      decorative: false,
    });
    expect(ai.messages.value).toEqual([]);
    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(document.activeElement).toBe(entry.element);
  });
  it("marks decorative and clears missing-alt while empty alt alone remains flagged", async () => {
    const { wrapper, editor } = await setup();
    expect(
      lintAccessibility(editor.content.value).some(
        (i) => i.ruleId === "a11y.img-missing-alt",
      ),
    ).toBe(true);
    await open(wrapper);
    await button(wrapper, "Mark decorative").trigger("click");
    await flushPromises();
    expect(editor.content.value.blocks[0]).toMatchObject({
      alt: "",
      decorative: true,
    });
    expect(
      lintAccessibility(editor.content.value).some(
        (i) => i.ruleId === "a11y.img-missing-alt",
      ),
    ).toBe(false);
  });
  it.each(["Cancel", "Escape"])(
    "%s writes nothing and returns focus",
    async (action) => {
      const { wrapper, editor } = await setup();
      const before = JSON.stringify(editor.content.value);
      const entry = await open(wrapper);
      if (action === "Escape")
        await wrapper.get("textarea").trigger("keydown", { key: "Escape" });
      else await button(wrapper, "Cancel").trigger("click");
      await flushPromises();
      expect(JSON.stringify(editor.content.value)).toBe(before);
      expect(wrapper.find("textarea").exists()).toBe(false);
      expect(document.activeElement).toBe(entry.element);
    },
  );
  it("shows panel drafting status and Stop, without blocking Fix with AI", async () => {
    let signal!: AbortSignal;
    const { wrapper, ai } = await setup(async (_r, received) => {
      signal = received;
      return new Promise(() => {});
    });
    await open(wrapper);
    expect(wrapper.get('[data-testid="issue-ai-status"]').text()).toContain(
      "Writing alt text…",
    );
    expect(ai.busy.value).toBe(false);
    expect(
      button(wrapper, "Fix with AI").attributes("disabled"),
    ).toBeUndefined();
    await button(wrapper, "Stop").trigger("click");
    await flushPromises();
    expect(signal.aborted).toBe(true);
    expect(wrapper.find('[data-testid="issue-ai-status"]').exists()).toBe(
      false,
    );
    expect(wrapper.get("textarea").attributes("disabled")).toBeUndefined();
  });
  it("leaves a failed draft editable and shows the localized failure", async () => {
    const { wrapper, editor } = await setup(async () => {
      throw new SdkError("Unavailable", 502, "ai_provider_error");
    });
    await open(wrapper);
    expect(wrapper.text()).toContain(
      "Couldn't write alt text for this image. Write it yourself.",
    );
    expect(wrapper.get("textarea").attributes("disabled")).toBeUndefined();
    await wrapper.get("textarea").setValue("Written by hand");
    await button(wrapper, "Accept").trigger("click");
    await flushPromises();
    expect(editor.content.value.blocks[0]).toMatchObject({
      alt: "Written by hand",
      decorative: false,
    });
  });
  it("hides an unavailable member and disables during an editing turn", async () => {
    const { wrapper } = await setup(false);
    expect(button(wrapper, "Write alt text")).toBeUndefined();
    const second = await setup();
    second.ai.busy.value = true;
    await flushPromises();
    expect(
      button(second.wrapper, "Write alt text").attributes("disabled"),
    ).toBeDefined();
  });
});
