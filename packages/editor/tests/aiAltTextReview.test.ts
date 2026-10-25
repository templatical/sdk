// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { useEditor, useHistory } from "@templatical/core";
import {
  createDefaultTemplateContent,
  createImageBlock,
  createSectionBlock,
  type AiProvider,
} from "@templatical/types";
import { lintAccessibility, type LintIssue } from "@templatical/quality";
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
  vi.restoreAllMocks();
});

function deferredProvider() {
  const calls: Array<{
    blockId: string;
    signal: AbortSignal;
    resolve: (answer: { alt: string }) => void;
    reject: (error: Error) => void;
  }> = [];
  let active = 0;
  let maximum = 0;
  const provider: AiProvider["altText"] = (request, signal) => {
    active++;
    maximum = Math.max(maximum, active);
    return new Promise<{ alt: string }>((resolve, reject) => {
      let settled = false;
      const finish = () => {
        if (!settled) active--;
        settled = true;
      };
      signal.addEventListener("abort", finish, { once: true });
      calls.push({
        blockId: request.blockId,
        signal,
        resolve: (answer) => {
          finish();
          resolve(answer);
        },
        reject: (error) => {
          finish();
          reject(error);
        },
      });
    });
  };
  return { calls, provider, maximum: () => maximum };
}

async function setup(
  altText: AiProvider["altText"] = async (request) => ({
    alt: `Draft ${request.blockId}`,
  }),
  count = 5,
) {
  const content = createDefaultTemplateContent();
  const images = Array.from({ length: count }, (_, index) =>
    createImageBlock({
      id: `i${index + 1}`,
      src: `https://example.com/i${index + 1}.png`,
      alt: "",
    }),
  );
  // Include both root blocks and section columns: lint order and severity order
  // are deliberately different from this hand-checked document order.
  content.blocks = [
    ...images.slice(0, 1),
    createSectionBlock({
      id: "section",
      columns: "2",
      children: [images.slice(1, 3), images.slice(3)],
    }),
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
        fixFinding: false,
        altText,
      },
      editor,
      history: () => history,
      collaboration: null,
      reload: null,
      mergeTags: () => ({ syntax: "liquid", tags: [] }),
      normalize: (ops) => [...ops],
      commentsOpen: null,
    });
    return { editor, ai, history };
  })!;
  await state.editor.load("t");
  const issues = ref<LintIssue[]>(
    [...images].reverse().flatMap((image, index) => [
      {
        blockId: image.id,
        ruleId: "a11y.img-missing-alt",
        severity: index % 2 ? "error" : "warning",
        message: "Missing alt",
        suggestion: "Write alt",
        reference: "https://example.com/rule",
      },
      {
        blockId: image.id,
        ruleId: "a11y.img-linked-no-context",
        severity: "warning",
        message: "Missing context",
        suggestion: "Write alt",
        reference: "https://example.com/rule",
      },
    ]),
  );
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
    state.history.destroy,
    state.ai.destroy,
    () => wrapper.unmount(),
  );
  return { ...state, wrapper, issues };
}

type Panel = Awaited<ReturnType<typeof setup>>["wrapper"];
const review = (wrapper: Panel) =>
  wrapper.find('[data-testid="ai-alt-text-review"]');
const rows = (wrapper: Panel) =>
  review(wrapper).findAll('[data-testid="ai-alt-text-row"]');
const button = (wrapper: Panel, name: string) =>
  wrapper.findAll("button").find((item) => item.text() === name)!;
async function open(wrapper: Panel, count = 5) {
  const entry = wrapper.find('[data-testid="issue-ai-alt-text-bulk"]');
  expect(entry.exists()).toBe(true);
  expect(entry.text()).toBe(`Write missing alt text (${count})`);
  entry.element.focus();
  await entry.trigger("click");
  await vi.waitFor(() => expect(review(wrapper).exists()).toBe(true));
  await flushPromises();
  return entry;
}

// Each case catches a consumer-visible regression: excess provider calls,
// reordered drafts, leaked work, invalid acceptance, extra writes, or stale UI.
describe("bulk alt text review in IssuesPanel", () => {
  it("drops a target deleted after opening but before the lazy review mounts, without drafting it", async () => {
    const pool = deferredProvider();
    const { wrapper, editor } = await setup(pool.provider);
    wrapper.get('[data-testid="issue-ai-alt-text-bulk"]').element.click();
    // Keep the opening snapshot, then delete before Vue can mount the async
    // component. This is the first review opened in this test file.
    expect(review(wrapper).exists()).toBe(false);
    expect(pool.calls).toHaveLength(0);
    editor.removeBlock("i2");
    await vi.waitFor(() => expect(review(wrapper).exists()).toBe(true));
    await flushPromises();
    expect(
      rows(wrapper).map((row) => row.get("img").attributes("src")),
    ).toEqual([
      "https://example.com/i1.png",
      "https://example.com/i3.png",
      "https://example.com/i4.png",
      "https://example.com/i5.png",
    ]);
    expect(pool.calls.map((call) => call.blockId)).toEqual(["i1", "i3", "i4"]);
    pool.calls[0].resolve({ alt: "First surviving image" });
    await flushPromises();
    expect(pool.calls.map((call) => call.blockId)).toEqual([
      "i1",
      "i3",
      "i4",
      "i5",
    ]);
    expect(wrapper.text()).not.toContain(en.ai.altText.failed);
  });

  it("protects a queued row from edits and acceptance until its draft arrives", async () => {
    const pool = deferredProvider();
    const { wrapper } = await setup(pool.provider);
    await open(wrapper);
    expect(pool.calls.map((call) => call.blockId)).toEqual(["i1", "i2", "i3"]);
    const fourth = rows(wrapper)[3];
    const textarea = fourth.get("textarea");
    const accept = fourth.get('[role="switch"][aria-label="Accept"]');
    expect(textarea.element.readOnly).toBe(true);
    textarea.element.value = "Author text before drafting";
    await textarea.trigger("input");
    expect(textarea.element.value).toBe("");
    expect(accept.element.disabled).toBe(true);
    expect(accept.attributes("aria-checked")).toBe("false");
    // Decorative text is valid, but a queued draft must still block acceptance.
    const decorative = fourth.get(
      '[role="switch"][aria-label="Mark decorative"]',
    );
    await decorative.trigger("click");
    expect(accept.element.disabled).toBe(true);
    await accept.trigger("click");
    expect(accept.attributes("aria-checked")).toBe("false");
    await decorative.trigger("click");
    pool.calls[0].resolve({ alt: "First draft" });
    await flushPromises();
    expect(pool.calls.map((call) => call.blockId)).toEqual([
      "i1",
      "i2",
      "i3",
      "i4",
    ]);
    expect(textarea.element.readOnly).toBe(true);
    pool.calls[3].resolve({ alt: "Fourth draft" });
    await flushPromises();
    expect(textarea.element.readOnly).toBe(false);
    expect(textarea.element.value).toBe("Fourth draft");
    expect(accept.attributes("aria-checked")).toBe("true");
    await textarea.setValue("Author edit after drafting");
    expect(textarea.element.value).toBe("Author edit after drafting");
  });

  it("Stop releases still-queued rows as empty editable drafts with acceptance off", async () => {
    const pool = deferredProvider();
    const { wrapper } = await setup(pool.provider);
    await open(wrapper);
    const queued = rows(wrapper).slice(3);
    expect(pool.calls).toHaveLength(3);
    for (const row of queued)
      expect(row.get("textarea").element.readOnly).toBe(true);
    await button(wrapper, "Stop").trigger("click");
    await flushPromises();
    expect(pool.calls.map((call) => call.signal.aborted)).toEqual([
      true,
      true,
      true,
    ]);
    expect(pool.calls).toHaveLength(3);
    for (const row of queued) {
      const textarea = row.get("textarea");
      const accept = row.get('[role="switch"][aria-label="Accept"]');
      expect(textarea.element.readOnly).toBe(false);
      expect(textarea.element.disabled).toBe(false);
      expect(textarea.element.value).toBe("");
      expect(accept.attributes("aria-checked")).toBe("false");
      expect(accept.element.disabled).toBe(true);
      await textarea.setValue("Author text after Stop");
      expect(textarea.element.value).toBe("Author text after Stop");
      expect(accept.element.disabled).toBe(false);
      expect(accept.attributes("aria-checked")).toBe("false");
    }
  });

  it("limits concurrency to three, starts in document order and renders out-of-order results in their own rows", async () => {
    const pool = deferredProvider();
    const { wrapper, editor, history } = await setup(pool.provider);
    const before = JSON.stringify(editor.content.value);
    await open(wrapper);
    expect(pool.calls.map((call) => call.blockId)).toEqual(["i1", "i2", "i3"]);
    expect(review(wrapper).text()).toContain("Writing alt text… 0 of 5");
    expect(
      rows(wrapper).map((row) => row.get("img").attributes("src")),
    ).toEqual([
      "https://example.com/i1.png",
      "https://example.com/i2.png",
      "https://example.com/i3.png",
      "https://example.com/i4.png",
      "https://example.com/i5.png",
    ]);
    const thumbnail = rows(wrapper)[0].get("img");
    expect(thumbnail.attributes()).toMatchObject({
      alt: "",
      loading: "lazy",
      referrerpolicy: "no-referrer",
    });
    expect(thumbnail.element.style.maxWidth).toBe("64px");
    expect(thumbnail.element.style.maxHeight).toBe("64px");
    const pending = rows(wrapper)[0].get("textarea");
    expect(pending.element.readOnly).toBe(true);
    pending.element.value = "Premature author input";
    await pending.trigger("input");
    expect(pending.element.value).toBe("");
    pool.calls[2].resolve({ alt: "Third image" });
    await flushPromises();
    expect(pool.calls.map((call) => call.blockId)).toEqual([
      "i1",
      "i2",
      "i3",
      "i4",
    ]);
    expect(
      rows(wrapper).map((row) => row.get("textarea").element.value),
    ).toEqual(["", "", "Third image", "", ""]);
    expect(review(wrapper).text()).toContain("Writing alt text… 1 of 5");
    pool.calls[0].resolve({ alt: "First image" });
    await flushPromises();
    expect(pool.calls.map((call) => call.blockId)).toEqual([
      "i1",
      "i2",
      "i3",
      "i4",
      "i5",
    ]);
    pool.calls[4].resolve({ alt: "Fifth image" });
    pool.calls[1].resolve({ alt: "Second image" });
    pool.calls[3].resolve({ alt: "Fourth image" });
    await flushPromises();
    expect(pool.maximum()).toBe(3);
    expect(
      rows(wrapper).map((row) => row.get("textarea").element.value),
    ).toEqual([
      "First image",
      "Second image",
      "Third image",
      "Fourth image",
      "Fifth image",
    ]);
    expect(
      rows(wrapper).every((row) => !row.get("textarea").element.readOnly),
    ).toBe(true);
    expect(
      rows(wrapper).every(
        (row) =>
          row
            .get('[role="switch"][aria-label="Accept"]')
            .attributes("aria-checked") === "true",
      ),
    ).toBe(true);
    expect(button(wrapper, "Stop")).toBeUndefined();
    expect(JSON.stringify(editor.content.value)).toBe(before);
    expect(history.canUndo.value).toBe(false);
  });

  it("Stop aborts every in-flight call, starts no queued ones, and preserves later author edits", async () => {
    const pool = deferredProvider();
    const { wrapper } = await setup(pool.provider);
    await open(wrapper);
    await button(wrapper, "Stop").trigger("click");
    await flushPromises();
    expect(pool.calls.map((call) => call.signal.aborted)).toEqual([
      true,
      true,
      true,
    ]);
    expect(pool.calls).toHaveLength(3);
    expect(rows(wrapper)).toHaveLength(5);
    for (const row of rows(wrapper)) {
      expect(row.get("textarea").element.value).toBe("");
      expect(row.get("textarea").element.readOnly).toBe(false);
      const accept = row.get('[role="switch"][aria-label="Accept"]');
      expect(accept.attributes("aria-checked")).toBe("false");
      expect(accept.element.disabled).toBe(true);
    }
    await rows(wrapper)[0].get("textarea").setValue("Author replacement");
    pool.calls[0].resolve({ alt: "Late provider text" });
    await flushPromises();
    expect(rows(wrapper)[0].get("textarea").element.value).toBe(
      "Author replacement",
    );
    expect(pool.calls).toHaveLength(3);
    expect(wrapper.text()).not.toContain(en.ai.altText.failed);
  });

  it("applies the accepted set once, trims descriptions, clears decorative findings and leaves exactly one undo step", async () => {
    const { wrapper, ai, editor, history, issues } = await setup();
    const apply = vi.spyOn(ai, "applyAltTexts");
    const before = JSON.stringify(editor.content.value);
    await open(wrapper);
    const row = rows(wrapper);
    await row[0].get("textarea").setValue("  Shop spring arrivals  ");
    await row[1]
      .get('[role="switch"][aria-label="Mark decorative"]')
      .trigger("click");
    expect(row[1].get("textarea").element.value).toBe("");
    expect(row[1].get("textarea").element.disabled).toBe(true);
    await row[2].get('[role="switch"][aria-label="Accept"]').trigger("click");
    await row[3].get('[role="switch"][aria-label="Accept"]').trigger("click");
    await row[4].get('[role="switch"][aria-label="Accept"]').trigger("click");
    expect(JSON.stringify(editor.content.value)).toBe(before);
    await button(wrapper, "Apply accepted (2)").trigger("click");
    await flushPromises();
    expect(apply).toHaveBeenCalledExactlyOnceWith([
      { blockId: "i1", alt: "Shop spring arrivals", decorative: false, expect: { src: "https://example.com/i1.png", alt: "", decorative: null } },
      { blockId: "i2", alt: "", decorative: true, expect: { src: "https://example.com/i2.png", alt: "", decorative: null } },
    ]);
    expect(review(wrapper).exists()).toBe(false);
    issues.value = lintAccessibility(editor.content.value);
    await nextTick();
    expect(
      issues.value
        .filter((issue) => issue.ruleId === "a11y.img-missing-alt")
        .map((issue) => issue.blockId),
    ).toEqual(["i3", "i4", "i5"]);
    expect(history.canUndo.value).toBe(true);
    history.undo();
    expect(JSON.stringify(editor.content.value)).toBe(before);
    expect(history.canUndo.value).toBe(false);
    expect(ai.messages.value).toEqual([]);
  });

  it("cannot accept empty non-decorative text, including after clearing a checked draft or turning Decorative off", async () => {
    const { wrapper } = await setup();
    await open(wrapper);
    const row = rows(wrapper)[0];
    const accept = row.get('[role="switch"][aria-label="Accept"]');
    await row.get("textarea").setValue("   ");
    expect(accept.element.disabled).toBe(true);
    expect(accept.attributes("aria-checked")).toBe("false");
    await row
      .get('[role="switch"][aria-label="Mark decorative"]')
      .trigger("click");
    expect(accept.element.disabled).toBe(false);
    await accept.trigger("click");
    await row
      .get('[role="switch"][aria-label="Mark decorative"]')
      .trigger("click");
    expect(accept.element.disabled).toBe(true);
    expect(accept.attributes("aria-checked")).toBe("false");
  });

  it("leaves failed acceptance off and editable so an author can supply and accept a description", async () => {
    const { wrapper } = await setup(async (request) => {
      if (request.blockId === "i2") throw new Error("Provider unavailable");
      return { alt: "Working draft" };
    });
    await open(wrapper);
    const row = rows(wrapper)[1];
    expect(row.text()).toContain(en.ai.altText.failed);
    expect(row.get("textarea").element.readOnly).toBe(false);
    const accept = row.get('[role="switch"][aria-label="Accept"]');
    expect(accept.attributes("aria-checked")).toBe("false");
    expect(accept.element.disabled).toBe(true);
    await row.get("textarea").setValue("Author description");
    expect(accept.element.disabled).toBe(false);
    expect(accept.attributes("aria-checked")).toBe("false");
    await accept.trigger("click");
    expect(button(wrapper, "Apply accepted (5)").exists()).toBe(true);
  });

  it("drops a deleted row, aborts its draft and skips it when applying", async () => {
    const pool = deferredProvider();
    const { wrapper, editor, ai } = await setup(pool.provider);
    const apply = vi.spyOn(ai, "applyAltTexts");
    await open(wrapper);
    editor.removeBlock("i2");
    await flushPromises();
    expect(pool.calls[1].signal.aborted).toBe(true);
    expect(rows(wrapper)).toHaveLength(4);
    expect(
      rows(wrapper).map((row) => row.get("img").attributes("src")),
    ).not.toContain("https://example.com/i2.png");
    await button(wrapper, "Stop").trigger("click");
    await rows(wrapper)[0].get("textarea").setValue("Remaining image");
    await rows(wrapper)[0]
      .get('[role="switch"][aria-label="Accept"]')
      .trigger("click");
    await button(wrapper, "Apply accepted (1)").trigger("click");
    await flushPromises();
    expect(apply).toHaveBeenCalledExactlyOnceWith([
      { blockId: "i1", alt: "Remaining image", decorative: false, expect: { src: "https://example.com/i1.png", alt: "", decorative: null } },
    ]);
    expect(review(wrapper).exists()).toBe(false);
  });

  it("skips an accepted block deleted immediately before Apply", async () => {
    const { wrapper, editor, ai } = await setup();
    const apply = vi.spyOn(ai, "applyAltTexts");
    await open(wrapper);
    editor.removeBlock("i2");
    await button(wrapper, "Apply accepted (5)").trigger("click");
    await flushPromises();
    expect(apply).toHaveBeenCalledExactlyOnceWith([
      { blockId: "i1", alt: "Draft i1", decorative: false, expect: { src: "https://example.com/i1.png", alt: "", decorative: null } },
      { blockId: "i3", alt: "Draft i3", decorative: false, expect: { src: "https://example.com/i3.png", alt: "", decorative: null } },
      { blockId: "i4", alt: "Draft i4", decorative: false, expect: { src: "https://example.com/i4.png", alt: "", decorative: null } },
      { blockId: "i5", alt: "Draft i5", decorative: false, expect: { src: "https://example.com/i5.png", alt: "", decorative: null } },
    ]);
    expect(review(wrapper).exists()).toBe(false);
  });

  it("keeps the opening snapshot when findings resolve or new targets appear", async () => {
    const { wrapper, issues, editor } = await setup();
    await open(wrapper);
    editor.addBlock(
      createImageBlock({ id: "new", src: "https://example.com/new.png" }),
    );
    issues.value = [{ ...issues.value[0], blockId: "new" }];
    await flushPromises();
    expect(rows(wrapper)).toHaveLength(5);
    expect(
      rows(wrapper).map((row) => row.get("textarea").element.value),
    ).toEqual(["Draft i1", "Draft i2", "Draft i3", "Draft i4", "Draft i5"]);
  });

  it.each(["Cancel", "Escape"])(
    "%s aborts drafts, writes nothing and returns focus to the entry",
    async (action) => {
      const pool = deferredProvider();
      const { wrapper, editor, ai, history } = await setup(pool.provider);
      const apply = vi.spyOn(ai, "applyAltTexts");
      const before = JSON.stringify(editor.content.value);
      const entry = await open(wrapper);
      expect(review(wrapper).element.contains(document.activeElement)).toBe(
        true,
      );
      if (action === "Escape")
        await review(wrapper).trigger("keydown", { key: "Escape" });
      else await button(wrapper, "Cancel").trigger("click");
      await flushPromises();
      expect(pool.calls.map((call) => call.signal.aborted)).toEqual([
        true,
        true,
        true,
      ]);
      expect(review(wrapper).exists()).toBe(false);
      expect(apply).not.toHaveBeenCalled();
      expect(JSON.stringify(editor.content.value)).toBe(before);
      expect(history.canUndo.value).toBe(false);
      expect(document.activeElement).toBe(entry.element);
    },
  );

  it("single and bulk reviews close and abort each other without stealing the new review's focus", async () => {
    const pool = deferredProvider();
    const { wrapper } = await setup(pool.provider);
    await wrapper.get('[data-testid="issue-ai-alt-text"]').trigger("click");
    await vi.waitFor(() =>
      expect(wrapper.find("textarea").exists()).toBe(true),
    );
    expect(pool.calls).toHaveLength(1);
    await open(wrapper);
    expect(pool.calls[0].signal.aborted).toBe(true);
    expect(wrapper.findAll("textarea")).toHaveLength(5);
    expect(review(wrapper).element.contains(document.activeElement)).toBe(true);
    await wrapper.get('[data-testid="issue-ai-alt-text"]').trigger("click");
    await flushPromises();
    expect(review(wrapper).exists()).toBe(false);
    expect(pool.calls.slice(1, 4).every((call) => call.signal.aborted)).toBe(
      true,
    );
    expect(wrapper.findAll("textarea")).toHaveLength(1);
    expect(pool.calls).toHaveLength(5);
    expect(pool.calls[4].signal.aborted).toBe(false);
  });

  it.each(["switch", "reload", "destroy", "unmount"])(
    "%s closes the review and aborts all pending drafts",
    async (action) => {
      const pool = deferredProvider();
      const { wrapper, editor, ai } = await setup(pool.provider);
      const apply = vi.spyOn(ai, "applyAltTexts");
      await open(wrapper);
      if (action === "switch") await editor.load("other");
      else if (action === "reload") await editor.load("t");
      else if (action === "destroy") ai.destroy();
      else wrapper.unmount();
      await flushPromises();
      // Vue Test Utils retains detached wrapper DOM after unmount.
      if (action === "unmount") expect(wrapper.element.isConnected).toBe(false);
      else expect(review(wrapper).exists()).toBe(false);
      expect(pool.calls.map((call) => call.signal.aborted)).toEqual([
        true,
        true,
        true,
      ]);
      expect(pool.calls).toHaveLength(3);
      expect(apply).not.toHaveBeenCalled();
    },
  );

  it.each(["destroy", "switch", "reload"])(
    "%s before the lazy review mounts cannot open a stale review",
    async (action) => {
      const pool = deferredProvider();
      const { wrapper, ai, editor } = await setup(pool.provider);
      const load =
        action === "destroy"
          ? null
          : editor.load(action === "switch" ? "other" : "t");
      wrapper.get('[data-testid="issue-ai-alt-text-bulk"]').element.click();
      if (action === "destroy") ai.destroy();
      else await load;
      await flushPromises();
      expect(review(wrapper).exists()).toBe(false);
      expect(pool.calls).toHaveLength(0);
    },
  );

  it("hides the entry for duplicate findings on one image or altText false, and disables it while busy", async () => {
    const single = await setup(undefined, 1);
    expect(
      single.wrapper.find('[data-testid="issue-ai-alt-text-bulk"]').exists(),
    ).toBe(false);
    const unavailable = await setup(false);
    expect(
      unavailable.wrapper
        .find('[data-testid="issue-ai-alt-text-bulk"]')
        .exists(),
    ).toBe(false);
    const available = await setup();
    expect(
      available.wrapper.get('[data-testid="issue-ai-alt-text-bulk"]').element
        .disabled,
    ).toBe(false);
    available.ai.busy.value = true;
    await nextTick();
    expect(
      available.wrapper.get('[data-testid="issue-ai-alt-text-bulk"]').element
        .disabled,
    ).toBe(true);
    available.ai.busy.value = false;
    available.ai.destroy();
    await nextTick();
    expect(
      available.wrapper.find('[data-testid="issue-ai-alt-text-bulk"]').exists(),
    ).toBe(false);
  });
});

it.each(["src", "alt", "decorative"] as const)("excludes a bulk row after captured image %s changes", async (field) => {
  const { wrapper, editor } = await setup(undefined, 2);
  await open(wrapper, 2);
  const change = field === "src" ? { src: "https://example.com/replaced.png" } : field === "alt" ? { alt: "Author alt" } : { decorative: true };
  editor.updateBlock("i1", change);
  await nextTick();
  const before = JSON.stringify(editor.content.value.blocks[0]);
  expect(rows(wrapper)[0].text()).toContain("The image changed. Write the alt text again.");
  await button(wrapper, "Apply accepted (1)").trigger("click");
  await flushPromises();
  expect(JSON.stringify(editor.content.value.blocks[0])).toBe(before);
  expect(editor.content.value.blocks[1]).toMatchObject({ children: [[{ id: "i2", alt: "Draft i2" }], []] });
});

it("does not request a queued draft for a changed image", async () => {
  const pool = deferredProvider();
  const { wrapper, editor } = await setup(pool.provider, 4);
  await open(wrapper, 4);
  editor.updateBlock("i4", { src: "https://example.com/new.png" });
  pool.calls[0].resolve({ alt: "First" });
  await flushPromises();
  expect(pool.calls.map((call) => call.blockId)).toEqual(["i1", "i2", "i3"]);
  expect(rows(wrapper)[3].text()).toContain("The image changed. Write the alt text again.");
});
