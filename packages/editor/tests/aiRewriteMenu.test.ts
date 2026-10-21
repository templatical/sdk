// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { shallowRef } from "vue";
import { SdkError, SYNTAX_PRESETS } from "@templatical/types";
import AiRewriteMenu from "../src/components/ai/AiRewriteMenu.vue";
import { loadTranslations } from "../src/i18n";
import {
  AI_FEATURE_KEY,
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  TRANSLATIONS_KEY,
  UI_LOCALE_KEY,
} from "../src/keys";
import { mountEditor } from "./helpers/mount";

const PARAGRAPH =
  '<p>Hello <span data-merge-tag="{{first_name}}" data-label="First name">First name</span>, welcome aboard.</p>';

function fakeTiptap() {
  const chain = {
    focus: vi.fn(() => chain),
    setContent: vi.fn(() => chain),
    run: vi.fn(() => true),
  };
  return {
    getHTML: vi.fn(() => PARAGRAPH),
    chain: vi.fn(() => chain),
    steps: chain,
  };
}

let answer: (
  input: unknown,
  onText: (text: string) => void,
  signal: AbortSignal,
) => Promise<{ html: string }>;
const feature = {
  rewrite: vi.fn(
    (input: unknown, onText: (text: string) => void, signal: AbortSignal) =>
      answer(input, onText, signal),
  ),
};

async function mountMenu() {
  const tiptap = fakeTiptap();
  const wrapper = mountEditor(AiRewriteMenu, {
    props: { editor: tiptap as never },
    provides: {
      [TRANSLATIONS_KEY]: await loadTranslations("en"),
      [AI_FEATURE_KEY]: feature,
      [MERGE_TAGS_KEY]: shallowRef([
        { value: "{{first_name}}", label: "First name" },
      ]),
      [MERGE_TAG_SYNTAX_KEY]: SYNTAX_PRESETS.liquid,
      [UI_LOCALE_KEY]: "en",
    },
  });
  await wrapper.get('[data-testid="ai-rewrite-trigger"]').trigger("click");
  return { wrapper, tiptap };
}

afterEach(() => vi.clearAllMocks());

describe("AiRewriteMenu (D22)", () => {
  it("opens from the toolbar, named as an AI rewrite", async () => {
    answer = async () => ({ html: "" });
    const { wrapper } = await mountMenu();
    expect(
      wrapper
        .get('[data-testid="ai-rewrite-trigger"]')
        .attributes("aria-label"),
    ).toBe("Rewrite with AI");
    expect(wrapper.get('[data-testid="ai-rewrite-panel"]').text()).toContain(
      "Shorten",
    );
  });

  it("runs a preset on the whole paragraph", async () => {
    answer = async () => ({ html: "<p>Hi.</p>" });
    const { wrapper } = await mountMenu();

    await wrapper
      .get('[data-testid="ai-rewrite-preset-shorten"]')
      .trigger("click");

    expect(feature.rewrite).toHaveBeenCalledWith(
      { html: PARAGRAPH, preset: "shorten", language: null, instruction: null },
      expect.any(Function),
      expect.any(AbortSignal),
    );
  });

  it("translates into the picked language", async () => {
    answer = async () => ({ html: "<p>Hallo.</p>" });
    const { wrapper } = await mountMenu();

    await wrapper.get('[data-testid="ai-rewrite-panel"] select').setValue("de");
    await wrapper
      .get('[data-testid="ai-rewrite-preset-translate"]')
      .trigger("click");

    expect(feature.rewrite).toHaveBeenCalledWith(
      {
        html: PARAGRAPH,
        preset: "translate",
        language: "de",
        instruction: null,
      },
      expect.any(Function),
      expect.any(AbortSignal),
    );
  });

  it("sends a free instruction on its own, and needs one", async () => {
    answer = async () => ({ html: "<p>Punchy.</p>" });
    const { wrapper } = await mountMenu();
    expect(
      wrapper.get('[data-testid="ai-rewrite-run"]').attributes("disabled"),
    ).toBeDefined();

    await wrapper
      .get('[data-testid="ai-rewrite-instruction"]')
      .setValue("  Make it punchy ");
    await wrapper.get('[data-testid="ai-rewrite-run"]').trigger("click");

    expect(feature.rewrite).toHaveBeenCalledWith(
      {
        html: PARAGRAPH,
        preset: null,
        language: null,
        instruction: "Make it punchy",
      },
      expect.any(Function),
      expect.any(AbortSignal),
    );
  });

  it("streams as plain text, labelled as an AI suggestion, never as markup", async () => {
    let finish!: () => void;
    answer = (_input, onText) =>
      new Promise((resolve) => {
        onText('<p><img src="x" onerror="alert(1)">Hello th');
        finish = () => resolve({ html: "<p>Hello there</p>" });
      });
    const { wrapper } = await mountMenu();

    await wrapper
      .get('[data-testid="ai-rewrite-preset-friendlier"]')
      .trigger("click");
    await flushPromises();

    const preview = wrapper.get('[data-testid="ai-rewrite-preview"]');
    expect(preview.text()).toBe("Hello th");
    expect(preview.find("img").exists()).toBe(false);
    expect(wrapper.get('[data-testid="ai-rewrite-label"]').text()).toBe(
      "AI suggestion",
    );
    finish();
  });

  it("shows the result with merge tags as tags and the markup sanitized, and Replace makes it the user's edit", async () => {
    answer = async () => ({
      html: '<p>Hi {{first_name}}! <a href="javascript:alert(1)">Shop</a></p>',
    });
    const { wrapper, tiptap } = await mountMenu();

    await wrapper
      .get('[data-testid="ai-rewrite-preset-shorten"]')
      .trigger("click");
    await flushPromises();

    const preview = wrapper.get('[data-testid="ai-rewrite-preview"]');
    expect(preview.find('span[data-merge-tag="{{first_name}}"]').exists()).toBe(
      true,
    );
    expect(preview.get("a").attributes("href")).toBeUndefined();

    await wrapper.get('[data-testid="ai-rewrite-replace"]').trigger("click");

    const [html, options] = tiptap.steps.setContent.mock
      .calls[0] as unknown as [string, { emitUpdate: boolean }];
    expect(html).toContain('data-merge-tag="{{first_name}}"');
    expect(html).not.toContain("javascript:");
    expect(options).toEqual({ emitUpdate: true });
    expect(wrapper.find('[data-testid="ai-rewrite-panel"]').exists()).toBe(
      false,
    );
  });

  it("discards the result and leaves the paragraph alone", async () => {
    answer = async () => ({ html: "<p>Hi</p>" });
    const { wrapper, tiptap } = await mountMenu();
    await wrapper
      .get('[data-testid="ai-rewrite-preset-shorten"]')
      .trigger("click");
    await flushPromises();

    await wrapper.get('[data-testid="ai-rewrite-discard"]').trigger("click");

    expect(tiptap.chain).not.toHaveBeenCalled();
    expect(
      wrapper.find('[data-testid="ai-rewrite-preset-shorten"]').exists(),
    ).toBe(true);
  });

  it("says a refusal in words", async () => {
    answer = async () => {
      throw new SdkError("x", 422, "ai_output_invalid");
    };
    const { wrapper } = await mountMenu();
    await wrapper
      .get('[data-testid="ai-rewrite-preset-shorten"]')
      .trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="ai-rewrite-error"]').text()).toBe(
      "The AI couldn't produce a valid result. Try again.",
    );
  });

  it("stops a running rewrite when it closes or unmounts", async () => {
    const signals: AbortSignal[] = [];
    answer = (_input, _onText, signal) => {
      signals.push(signal);
      return new Promise(() => {});
    };
    const { wrapper } = await mountMenu();
    await wrapper
      .get('[data-testid="ai-rewrite-preset-shorten"]')
      .trigger("click");

    await wrapper.get('[data-testid="ai-rewrite-trigger"]').trigger("click");
    expect(signals[0].aborted).toBe(true);
  });
});

describe("AiRewriteMenu validation and cancellation regressions", () => {
  it("does not translate without a language, even if the disabled button is enabled externally", async () => {
    answer = async () => ({ html: "<p>Hallo.</p>" });
    const { wrapper } = await mountMenu();
    await wrapper.get('[data-testid="ai-rewrite-panel"] select').setValue("");
    const translate = wrapper.get(
      '[data-testid="ai-rewrite-preset-translate"]',
    );

    await translate.trigger("click");

    expect(feature.rewrite).not.toHaveBeenCalled();
    expect(translate.attributes("disabled")).toBeDefined();

    // Exercise the run guard independently of the native disabled control.
    translate.element.removeAttribute("disabled");
    await translate.trigger("click");
    expect(feature.rewrite).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("stops showing a queued rewrite as busy immediately on Stop", async () => {
    let signal!: AbortSignal;
    answer = (_input, _onText, nextSignal) => {
      signal = nextSignal;
      return new Promise(() => {});
    };
    const { wrapper } = await mountMenu();
    await wrapper
      .get('[data-testid="ai-rewrite-preset-shorten"]')
      .trigger("click");

    await wrapper.get('[data-testid="ai-rewrite-stop"]').trigger("click");

    expect(signal.aborted).toBe(true);
    expect(wrapper.find('[data-testid="ai-rewrite-stop"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="ai-rewrite-preview"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-testid="ai-rewrite-preset-shorten"]').exists(),
    ).toBe(true);
    wrapper.unmount();
  });

  it("keeps B busy and abortable when cancelled A settles behind another AI job", async () => {
    let releaseLane!: () => void;
    const occupiedLane = new Promise<void>((resolve) => {
      releaseLane = resolve;
    });
    const signals: AbortSignal[] = [];
    answer = async (_input, _onText, signal) => {
      signals.push(signal);
      // Match the feature queue: an occupied lane delays checking cancellation.
      await occupiedLane;
      signal.throwIfAborted();
      return new Promise(() => {});
    };
    const { wrapper } = await mountMenu();
    await wrapper
      .get('[data-testid="ai-rewrite-preset-shorten"]')
      .trigger("click");
    await wrapper.get('[data-testid="ai-rewrite-trigger"]').trigger("click");
    expect(signals[0].aborted).toBe(true);
    await wrapper.get('[data-testid="ai-rewrite-trigger"]').trigger("click");
    await wrapper
      .get('[data-testid="ai-rewrite-preset-expand"]')
      .trigger("click");

    releaseLane();
    await flushPromises();

    expect(wrapper.find('[data-testid="ai-rewrite-stop"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="ai-rewrite-preview"]').text()).toBe(
      "Rewriting…",
    );
    expect(signals[1].aborted).toBe(false);
    await wrapper.get('[data-testid="ai-rewrite-trigger"]').trigger("click");
    expect(signals[1].aborted).toBe(true);
    wrapper.unmount();
  });

  async function mountRestartedRewrite() {
    const requests: {
      onText: (text: string) => void;
      resolve: (value: { html: string }) => void;
      reject: (error: unknown) => void;
    }[] = [];
    answer = (_input, onText) =>
      new Promise((resolve, reject) => {
        requests.push({ onText, resolve, reject });
      });
    const { wrapper } = await mountMenu();
    await wrapper
      .get('[data-testid="ai-rewrite-preset-shorten"]')
      .trigger("click");
    await wrapper.get('[data-testid="ai-rewrite-trigger"]').trigger("click");
    await wrapper.get('[data-testid="ai-rewrite-trigger"]').trigger("click");
    await wrapper
      .get('[data-testid="ai-rewrite-preset-expand"]')
      .trigger("click");
    return { wrapper, requests };
  }

  it("ignores obsolete streamed text after a newer rewrite starts", async () => {
    const { wrapper, requests } = await mountRestartedRewrite();

    requests[1].onText("<p>Current");
    requests[0].onText("<p>Obsolete");
    await flushPromises();

    expect(wrapper.get('[data-testid="ai-rewrite-preview"]').text()).toBe(
      "Current",
    );
    wrapper.unmount();
  });

  it("ignores obsolete success after the newer rewrite finishes", async () => {
    const { wrapper, requests } = await mountRestartedRewrite();
    requests[1].resolve({ html: "<p>Current</p>" });
    await flushPromises();

    requests[0].resolve({ html: "<p>Obsolete</p>" });
    await flushPromises();

    expect(wrapper.get('[data-testid="ai-rewrite-preview"]').text()).toBe(
      "Current",
    );
    wrapper.unmount();
  });

  it("ignores an obsolete error even when the newer rewrite is stopped", async () => {
    const { wrapper, requests } = await mountRestartedRewrite();

    requests[0].reject(
      new SdkError("Old request failed", 422, "ai_output_invalid"),
    );
    await flushPromises();

    expect(wrapper.find('[data-testid="ai-rewrite-stop"]').exists()).toBe(true);
    await wrapper.get('[data-testid="ai-rewrite-stop"]').trigger("click");
    expect(wrapper.find('[data-testid="ai-rewrite-error"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-testid="ai-rewrite-preset-shorten"]').exists(),
    ).toBe(true);
    wrapper.unmount();
  });
});


it("refuses oversized paragraph HTML before calling rewrite and shows a localized reason", async () => {
  answer = async () => ({ html: "<p>Hi</p>" });
  const { wrapper, tiptap } = await mountMenu();
  tiptap.getHTML.mockReturnValue("x".repeat(20_001));
  await wrapper.get('[data-testid="ai-rewrite-preset-shorten"]').trigger("click");
  await flushPromises();
  expect(feature.rewrite).not.toHaveBeenCalled();
  expect(wrapper.get('[data-testid="ai-rewrite-error"]').text()).toBe("This paragraph is too long for AI. Select a paragraph with at most 20,000 characters.");
  wrapper.unmount();
});
