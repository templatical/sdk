// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { CollaborationConflict, SdkError } from "@templatical/types";
import AiDesignPanel from "../src/components/ai/AiDesignPanel.vue";
import {
  AI_DESIGN_MAX_BYTES,
  type AiChatItem,
  type AiFailure,
} from "../src/composables/useAiFeature";
import { loadTranslations } from "../src/i18n";
import { EDITOR_KEY, TRANSLATIONS_KEY, UI_LOCALE_KEY } from "../src/keys";
import { mountEditor } from "./helpers/mount";

function message(overrides: Partial<AiChatItem> = {}): AiChatItem {
  return {
    id: "m-9",
    role: "assistant",
    kind: "design",
    text: "Built it.",
    operationCount: 4,
    undone: false,
    canUndo: true,
    canRedo: false,
    createdAt: "2026-10-21T12:00:00.000Z",
    status: "done",
    ...overrides,
  };
}

function feature() {
  const messages = ref<AiChatItem[]>([]);
  return {
    isRunning: ref(false),
    messages,
    failure: ref<AiFailure | null>(null),
    design: vi.fn(async () => {
      messages.value = [message()];
      return {
        messageId: "m-9",
        operationCount: 4,
        text: "Built it.",
        failed: false,
      };
    }),
    undoMessage: vi.fn(async () => {
      messages.value = [
        message({ undone: true, canUndo: false, canRedo: true }),
      ];
    }),
    redoMessage: vi.fn(async () => {
      messages.value = [message()];
    }),
  };
}

async function mountPanel(
  ai: ReturnType<typeof feature>,
  blocks: unknown[] = [],
) {
  return mountEditor(AiDesignPanel, {
    props: { feature: ai },
    provides: {
      [TRANSLATIONS_KEY]: await loadTranslations("en"),
      [UI_LOCALE_KEY]: "en",
      [EDITOR_KEY]: { content: ref({ blocks, settings: {} }) },
    },
  });
}

async function choose(
  wrapper: Awaited<ReturnType<typeof mountPanel>>,
  file: File,
) {
  const input = wrapper.get('[data-testid="ai-design-file"]');
  Object.defineProperty(input.element, "files", {
    value: [file],
    configurable: true,
  });
  await input.trigger("change");
}

describe("AiDesignPanel (D24)", () => {
  it("takes PNG, JPEG, WebP, GIF and PDF", async () => {
    const wrapper = await mountPanel(feature());
    expect(
      wrapper.get('[data-testid="ai-design-file"]').attributes("accept"),
    ).toBe("image/png,image/jpeg,image/webp,image/gif,application/pdf");
  });

  it("refuses a file over 5 MB, and a type it can't read", async () => {
    const wrapper = await mountPanel(feature());
    const huge = new File(["x"], "huge.png", { type: "image/png" });
    Object.defineProperty(huge, "size", { value: AI_DESIGN_MAX_BYTES + 1 });

    await choose(wrapper, huge);
    expect(wrapper.get('[data-testid="ai-design-error"]').text()).toBe(
      "This file is larger than 5 MB.",
    );

    await choose(wrapper, new File(["x"], "a.svg", { type: "image/svg+xml" }));
    expect(wrapper.get('[data-testid="ai-design-error"]').text()).toBe(
      "Upload a PNG, JPEG, WebP or GIF image, or a PDF.",
    );
  });

  it("builds from a GIF with notes, then offers Undo and Build another", async () => {
    const ai = feature();
    const wrapper = await mountPanel(ai);
    const gif = new File(["GIF89a"], "shot.gif", { type: "image/gif" });

    await choose(wrapper, gif);
    await wrapper
      .get('[data-testid="ai-design-prompt"]')
      .setValue("Keep it dark");
    await wrapper.get('[data-testid="ai-design-build"]').trigger("click");
    await flushPromises();

    expect(ai.design).toHaveBeenCalledWith({
      file: gif,
      prompt: "Keep it dark",
    });
    expect(wrapper.get('[data-testid="ai-design-built"]').text()).toContain(
      "Template built from your design.",
    );

    await wrapper.get('[data-testid="ai-design-undo"]').trigger("click");
    await flushPromises();
    expect(ai.undoMessage).toHaveBeenCalledWith("m-9");
    expect(wrapper.get('[data-testid="ai-design-undo"]').text()).toBe("Redo");

    await wrapper.get('[data-testid="ai-design-another"]').trigger("click");
    expect(wrapper.find('[data-testid="ai-design-built"]').exists()).toBe(
      false,
    );
  });

  it("asks before replacing a template that has blocks", async () => {
    const ai = feature();
    const wrapper = await mountPanel(ai, [{ id: "t1", type: "title" }]);

    await choose(
      wrapper,
      new File(["%PDF"], "brief.pdf", { type: "application/pdf" }),
    );
    await wrapper.get('[data-testid="ai-design-build"]').trigger("click");
    expect(ai.design).not.toHaveBeenCalled();

    await wrapper.get('[data-testid="ai-design-replace"]').trigger("click");
    await flushPromises();
    expect(ai.design).toHaveBeenCalledTimes(1);
  });

  it.each([
    [1, "Applied 1 change"],
    [4, "Applied 4 changes"],
  ])(
    "shows a partially applied failure with %i changes",
    async (operationCount, count) => {
      const ai = feature();
      ai.design.mockImplementationOnce(async () => {
        ai.messages.value = [
          message({
            operationCount,
            status: "failed",
            failure: {
              error: new SdkError("Provider failed", 502, "ai_provider_error"),
              context: "turn",
            },
          }),
        ];
        return {
          messageId: "m-9",
          operationCount,
          text: "Built it.",
          failed: true,
        };
      });
      const wrapper = await mountPanel(ai);

      await choose(
        wrapper,
        new File(["%PDF"], "brief.pdf", { type: "application/pdf" }),
      );
      await wrapper.get('[data-testid="ai-design-build"]').trigger("click");
      await flushPromises();

      const built = wrapper.get('[data-testid="ai-design-built"]');
      expect(built.get('[role="alert"]').text()).toBe(
        "AI is unavailable right now. Try again later.",
      );
      expect(built.text()).toContain(count);
      expect(built.text()).not.toContain("Template built from your design.");
      expect(built.get('[data-testid="ai-design-undo"]').text()).toBe("Undo");
    },
  );

  it.each([
    ["undo", "Someone changed these blocks since, so this can't be undone."],
    ["redo", "Someone changed these blocks since, so this can't be redone."],
  ] as const)(
    "shows a refused %s in the built view",
    async (direction, expected) => {
      const ai = feature();
      const replay = direction === "undo" ? ai.undoMessage : ai.redoMessage;
      replay.mockImplementationOnce(async () => {
        ai.messages.value = [
          {
            ...ai.messages.value[0]!,
            failure: {
              error: new CollaborationConflict("The template changed.", {
                code: "precondition_failed",
                opIndex: 0,
              }),
              context: direction,
            },
          },
        ];
      });
      const wrapper = await mountPanel(ai);

      await choose(
        wrapper,
        new File(["%PDF"], "brief.pdf", { type: "application/pdf" }),
      );
      await wrapper.get('[data-testid="ai-design-build"]').trigger("click");
      await flushPromises();
      if (direction === "redo") {
        await wrapper.get('[data-testid="ai-design-undo"]').trigger("click");
        await flushPromises();
      }
      await wrapper.get('[data-testid="ai-design-undo"]').trigger("click");
      await flushPromises();

      const built = wrapper.get('[data-testid="ai-design-built"]');
      expect(replay).toHaveBeenCalledWith("m-9");
      expect(built.get('[role="alert"]').text()).toBe(expected);
      expect(built.get('[data-testid="ai-design-undo"]').text()).toBe(
        direction === "undo" ? "Undo" : "Redo",
      );
    },
  );

  it("hides Undo when the built message cannot be undone", async () => {
    const ai = feature();
    ai.design.mockImplementationOnce(async () => {
      ai.messages.value = [message({ canUndo: false })];
      return {
        messageId: "m-9",
        operationCount: 4,
        text: "Built it.",
        failed: false,
      };
    });
    const wrapper = await mountPanel(ai);

    await choose(
      wrapper,
      new File(["%PDF"], "brief.pdf", { type: "application/pdf" }),
    );
    await wrapper.get('[data-testid="ai-design-build"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="ai-design-built"]').text()).toContain(
      "Template built from your design.",
    );
    expect(wrapper.find('[data-testid="ai-design-undo"]').exists()).toBe(false);
    expect(ai.undoMessage).not.toHaveBeenCalled();
  });

  it("hides Redo when Undo leaves no redo available", async () => {
    const ai = feature();
    ai.undoMessage.mockImplementationOnce(async () => {
      ai.messages.value = [
        message({ undone: true, canUndo: false, canRedo: false }),
      ];
    });
    const wrapper = await mountPanel(ai);

    await choose(
      wrapper,
      new File(["%PDF"], "brief.pdf", { type: "application/pdf" }),
    );
    await wrapper.get('[data-testid="ai-design-build"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="ai-design-undo"]').trigger("click");
    await flushPromises();

    expect(ai.undoMessage).toHaveBeenCalledWith("m-9");
    expect(wrapper.find('[data-testid="ai-design-undo"]').exists()).toBe(false);
    expect(ai.redoMessage).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "ignores a stale replay click when undone is %s and replay is unavailable",
    async (undone) => {
      const ai = feature();
      const wrapper = await mountPanel(ai);

      await choose(
        wrapper,
        new File(["%PDF"], "brief.pdf", { type: "application/pdf" }),
      );
      await wrapper.get('[data-testid="ai-design-build"]').trigger("click");
      await flushPromises();
      if (undone) {
        await wrapper.get('[data-testid="ai-design-undo"]').trigger("click");
        await flushPromises();
      }
      const button = wrapper.get('[data-testid="ai-design-undo"]');
      ai.undoMessage.mockClear();
      ai.redoMessage.mockClear();
      ai.messages.value = [message({ undone, canUndo: false, canRedo: false })];
      await button.trigger("click");
      await flushPromises();

      expect(ai.undoMessage).not.toHaveBeenCalled();
      expect(ai.redoMessage).not.toHaveBeenCalled();
    },
  );

  it("opens the file picker through a native dropzone button", async () => {
    const wrapper = await mountPanel(feature());
    const input = wrapper.get<HTMLInputElement>(
      '[data-testid="ai-design-file"]',
    );
    const click = vi.spyOn(input.element, "click");
    const dropzone = wrapper.get('[data-testid="ai-design-dropzone"]');

    expect(dropzone.element.tagName).toBe("BUTTON");
    expect(dropzone.attributes("type")).toBe("button");
    expect(dropzone.text()).toContain(
      "Drop an image or a PDF here, or click to choose one",
    );
    await dropzone.trigger("click");

    expect(click).toHaveBeenCalledOnce();
  });

  it("still builds from a file dropped onto the picker", async () => {
    const ai = feature();
    const wrapper = await mountPanel(ai);
    const pdf = new File(["%PDF"], "dropped.pdf", { type: "application/pdf" });

    await wrapper
      .get('[data-testid="ai-design-dropzone"]')
      .trigger("drop", { dataTransfer: { files: [pdf] } });
    expect(
      wrapper.get('[data-testid="ai-design-build"]').attributes("disabled"),
    ).toBeUndefined();
    await wrapper.get('[data-testid="ai-design-build"]').trigger("click");
    await flushPromises();

    expect(ai.design).toHaveBeenCalledWith({ file: pdf, prompt: null });
    expect(wrapper.get('[data-testid="ai-design-built"]').text()).toContain(
      "Template built from your design.",
    );
  });
});
