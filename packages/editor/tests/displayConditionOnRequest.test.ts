// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import {
  createDefaultTemplateContent,
  createTitleBlock,
  type DisplayCondition,
  type DisplayConditionRequestContext,
  type DisplayConditionsConfig,
} from "@templatical/types";
import type { UseEditorReturn } from "@templatical/core";
import CommonBlockSettings from "../src/components/toolbar/CommonBlockSettings.vue";
import Editor from "../src/Editor.vue";
import Canvas from "../src/components/Canvas.vue";
import { useFonts } from "../src/composables/useFonts";
import { loadTranslations } from "../src/i18n";
import en from "../src/i18n/locales/en";
import {
  ALLOW_CUSTOM_CONDITIONS_KEY,
  DISPLAY_CONDITIONS_KEY,
  EDITOR_KEY,
  HISTORY_KEY,
  ON_REQUEST_DISPLAY_CONDITION_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import { logger } from "../src/utils/logger";
import { mountEditor } from "./helpers/mount";

const IGNORED =
  "displayConditions.onRequest resolved a value without string label, before and after — ignoring it.";

const vip: DisplayCondition = {
  label: "VIP",
  before: "{% if customer.vip %}",
  after: "{% endif %}",
  description: "Paying customers",
  group: "Plan",
  data: { tier: "vip", nested: { n: 1 } },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mountSettings(
  block: ReturnType<typeof createTitleBlock>,
  provides: Record<symbol, unknown> = {},
) {
  return mountEditor(CommonBlockSettings, {
    props: { block },
    provides: {
      [TRANSLATIONS_KEY]: en,
      ...provides,
    },
  });
}

function openCondition(wrapper: VueWrapper) {
  return wrapper
    .get('[data-testid="display-condition-section"]')
    .trigger("click");
}

function editorDouble(location: { index: number } | null = { index: 0 }) {
  return {
    updateBlock: vi.fn(),
    findBlockLocation: vi.fn(() => location),
  };
}

describe("CommonBlockSettings displayConditions.onRequest", () => {
  it("renders Add condition and calls onRequest with a block copy", async () => {
    const block = createTitleBlock({ id: "title", content: "Hello" });
    const paddingTop = block.styles.padding.top;
    let seen: DisplayConditionRequestContext | undefined;
    const onRequest = vi.fn(async (context: DisplayConditionRequestContext) => {
      seen = context;
      context.block.content = "mutated";
      context.block.styles.padding.top = paddingTop + 40;
      return vip;
    });
    const editor = editorDouble();
    const wrapper = mountSettings(block, {
      [ON_REQUEST_DISPLAY_CONDITION_KEY]: onRequest,
      [EDITOR_KEY]: editor,
    });

    await openCondition(wrapper);
    const button = wrapper.get('[data-testid="display-condition-request"]');
    expect(button.text()).toBe("Add condition");
    expect(wrapper.find('[data-testid="display-condition-select"]').exists()).toBe(
      false,
    );

    await button.trigger("click");
    await flushPromises();

    expect(seen).not.toHaveProperty("current");
    expect(seen?.block).not.toBe(block);
    expect(seen?.block.id).toBe("title");
    expect(seen?.block.content).toBe("mutated");
    expect(block.content).toBe("Hello");
    expect(block.styles.padding.top).toBe(paddingTop);
    expect(wrapper.emitted("update")?.[0]?.[0]).toEqual({
      displayCondition: vip,
    });
    expect(editor.updateBlock).not.toHaveBeenCalled();
  });

  it("hides the built-in list when onRequest is set together with conditions", async () => {
    const preset: DisplayCondition = {
      label: "VIP",
      before: "{% if vip %}",
      after: "{% endif %}",
    };
    const wrapper = mountSettings(createTitleBlock({ id: "title", content: "Hello" }), {
      [ON_REQUEST_DISPLAY_CONDITION_KEY]: vi.fn(async () => null),
      [DISPLAY_CONDITIONS_KEY]: [preset],
      [ALLOW_CUSTOM_CONDITIONS_KEY]: true,
    });

    await openCondition(wrapper);

    expect(wrapper.get('[data-testid="display-condition-request"]').text()).toBe(
      "Add condition",
    );
    expect(wrapper.find('[data-testid="display-condition-select"]').exists()).toBe(
      false,
    );
    expect(wrapper.find("textarea").exists()).toBe(false);
  });

  it("edits with a copy of current, including data, and removes the condition", async () => {
    const block = createTitleBlock({
      id: "title",
      content: "Hello",
      displayCondition: vip,
    });
    let seen: DisplayConditionRequestContext | undefined;
    const edited: DisplayCondition = {
      ...vip,
      label: "Edited",
      data: { tier: "gold" },
    };
    const onRequest = vi.fn(async (context: DisplayConditionRequestContext) => {
      seen = context;
      context.block.content = "mutated";
      const current = context.current as DisplayCondition;
      (current.data as { tier: string }).tier = "nope";
      return edited;
    });
    const wrapper = mountSettings(block, {
      [ON_REQUEST_DISPLAY_CONDITION_KEY]: onRequest,
    });

    await openCondition(wrapper);
    expect(wrapper.text()).toContain("VIP");
    expect(wrapper.text()).toContain("Paying customers");
    expect(wrapper.get('[data-testid="display-condition-edit"]').text()).toBe(
      "Edit",
    );
    expect(wrapper.find("pre").exists()).toBe(false);

    await wrapper.get('[data-testid="display-condition-edit"]').trigger("click");
    await flushPromises();

    expect(seen?.current).not.toBe(block.displayCondition);
    expect(seen?.current).toEqual({
      ...vip,
      data: { tier: "nope", nested: { n: 1 } },
    });
    expect(seen?.block).not.toBe(block);
    expect(seen?.block.displayCondition).not.toBe(block.displayCondition);
    expect(block.content).toBe("Hello");
    expect((block.displayCondition?.data as { tier: string }).tier).toBe("vip");
    expect(wrapper.emitted("update")?.[0]?.[0]).toEqual({
      displayCondition: edited,
    });

    await wrapper.get('[data-testid="display-condition-remove"]').trigger("click");
    expect(wrapper.emitted("update")?.[1]?.[0]).toEqual({
      displayCondition: undefined,
    });
  });

  it("keeps the block unchanged when onRequest resolves null", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const wrapper = mountSettings(createTitleBlock({ id: "title", content: "Hello" }), {
      [ON_REQUEST_DISPLAY_CONDITION_KEY]: vi.fn(async () => null),
    });

    await openCondition(wrapper);
    await wrapper.get('[data-testid="display-condition-request"]').trigger("click");
    await flushPromises();

    expect(wrapper.emitted("update")).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    expect(
      (
        wrapper.get('[data-testid="display-condition-request"]')
          .element as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    warn.mockRestore();
  });

  it.each([
    ["string", "nope"],
    ["number", 4],
    ["missing before", { label: "VIP", after: "{% endif %}" }],
    [
      "non-string label",
      { label: 1, before: "{% if vip %}", after: "{% endif %}" },
    ],
    ["array", ["VIP"]],
  ])("ignores an invalid %s result and warns", async (_name, value) => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const wrapper = mountSettings(createTitleBlock({ id: "title", content: "Hello" }), {
      [ON_REQUEST_DISPLAY_CONDITION_KEY]: vi.fn(async () => value),
    });

    await openCondition(wrapper);
    await wrapper.get('[data-testid="display-condition-request"]').trigger("click");
    await flushPromises();

    expect(wrapper.emitted("update")).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(IGNORED);
    warn.mockRestore();
  });

  it("accepts empty strings and ignores an array that carries the three strings", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const empty: DisplayCondition = { label: "", before: "", after: "" };
    const array = Object.assign([], {
      label: "VIP",
      before: "{% if vip %}",
      after: "{% endif %}",
    });
    const onRequest = vi
      .fn<() => Promise<DisplayCondition | null>>()
      .mockResolvedValueOnce(empty)
      .mockResolvedValueOnce(array as unknown as DisplayCondition);
    const wrapper = mountSettings(createTitleBlock({ id: "title", content: "Hello" }), {
      [ON_REQUEST_DISPLAY_CONDITION_KEY]: onRequest,
    });

    try {
      await openCondition(wrapper);
      const button = wrapper.get('[data-testid="display-condition-request"]');
      await button.trigger("click");
      await flushPromises();
      expect(wrapper.emitted("update")?.[0]?.[0]).toEqual({
        displayCondition: empty,
      });
      expect(warn).not.toHaveBeenCalled();

      await wrapper.setProps({
        block: createTitleBlock({
          id: "title",
          content: "Hello",
          displayCondition: empty,
        }),
      });
      await wrapper.get('[data-testid="display-condition-edit"]').trigger("click");
      await flushPromises();
      expect(wrapper.emitted("update")).toHaveLength(1);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(IGNORED);
    } finally {
      warn.mockRestore();
    }
  });

  it("leaves the stored displayCondition unchanged when the resolved object and its nested data are mutated", async () => {
    const resolved: DisplayCondition = {
      label: "VIP",
      before: "{% if vip %}",
      after: "{% endif %}",
      description: "Paying customers",
      data: { tier: "vip", nested: { n: 1 } },
    };
    const storedShape: DisplayCondition = {
      label: "VIP",
      before: "{% if vip %}",
      after: "{% endif %}",
      description: "Paying customers",
      data: { tier: "vip", nested: { n: 1 } },
    };
    const wrapper = mountSettings(createTitleBlock({ id: "title", content: "Hello" }), {
      [ON_REQUEST_DISPLAY_CONDITION_KEY]: vi.fn(async () => resolved),
    });

    await openCondition(wrapper);
    await wrapper.get('[data-testid="display-condition-request"]').trigger("click");
    await flushPromises();

    const stored = (
      wrapper.emitted("update")?.[0]?.[0] as {
        displayCondition: DisplayCondition;
      }
    ).displayCondition;
    resolved.label = "Changed";
    resolved.before = "{% if other %}";
    resolved.after = "{% endother %}";
    const data = resolved.data as { tier: string; nested: { n: number } };
    data.tier = "gold";
    data.nested.n = 9;

    expect(stored).toEqual(storedShape);
    expect(stored).not.toBe(resolved);
    expect(stored.data).not.toBe(resolved.data);
    expect((stored.data as { nested: { n: number } }).nested).not.toBe(
      data.nested,
    );
  });

  it("disables Remove while a request is pending", async () => {
    const gate = deferred<DisplayCondition | null>();
    const wrapper = mountSettings(
      createTitleBlock({
        id: "title",
        content: "Hello",
        displayCondition: vip,
      }),
      {
        [ON_REQUEST_DISPLAY_CONDITION_KEY]: vi.fn(() => gate.promise),
      },
    );
    await openCondition(wrapper);
    const remove = wrapper.get('[data-testid="display-condition-remove"]');
    expect((remove.element as HTMLButtonElement).disabled).toBe(false);

    const pending = wrapper
      .get('[data-testid="display-condition-edit"]')
      .trigger("click");
    await nextTick();
    expect((remove.element as HTMLButtonElement).disabled).toBe(true);

    gate.resolve(null);
    await pending;
    await flushPromises();
    expect((remove.element as HTMLButtonElement).disabled).toBe(false);
    expect(wrapper.emitted("update")).toBeUndefined();
  });

  it("disables Add while a request is in flight and ignores a second click", async () => {
    const gate = deferred<DisplayCondition | null>();
    const onRequest = vi.fn(() => gate.promise);
    const wrapper = mountSettings(createTitleBlock({ id: "title", content: "Hello" }), {
      [ON_REQUEST_DISPLAY_CONDITION_KEY]: onRequest,
    });
    await openCondition(wrapper);
    const button = wrapper.get('[data-testid="display-condition-request"]');

    const pending = button.trigger("click");
    await nextTick();
    expect((button.element as HTMLButtonElement).disabled).toBe(true);
    expect(onRequest).toHaveBeenCalledTimes(1);

    await button.trigger("click");
    expect(onRequest).toHaveBeenCalledTimes(1);

    gate.resolve(vip);
    await pending;
    await flushPromises();
    expect((button.element as HTMLButtonElement).disabled).toBe(false);
    expect(wrapper.emitted("update")).toHaveLength(1);
  });

  it("propagates a rejection, leaves the block unchanged, and enables the button", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const wrapper = mountSettings(createTitleBlock({ id: "title", content: "Hello" }), {
      [ON_REQUEST_DISPLAY_CONDITION_KEY]: vi.fn(async () => {
        throw new Error("User cancelled");
      }),
    });
    await openCondition(wrapper);
    const button = wrapper.get('[data-testid="display-condition-request"]');
    // A rejected click handler is reported through Vue's app error handler.
    // The handler itself does not catch, so the rejection is the reported error.
    const reported: unknown[] = [];
    const app = wrapper.vm.$.appContext.app;
    const previous = app.config.errorHandler;
    app.config.errorHandler = (err) => {
      reported.push(err);
    };

    try {
      await button.trigger("click");
      await flushPromises();

      expect(reported.map((err) => (err as Error).message)).toEqual([
        "User cancelled",
      ]);
      expect(wrapper.emitted("update")).toBeUndefined();
      expect(warn).not.toHaveBeenCalled();
      expect((button.element as HTMLButtonElement).disabled).toBe(false);
    } finally {
      app.config.errorHandler = previous;
      warn.mockRestore();
    }
  });

  it("drops the result when the panel unmounts during the request", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const gate = deferred<DisplayCondition | null>();
    const editor = editorDouble();
    const wrapper = mountSettings(createTitleBlock({ id: "title", content: "Hello" }), {
      [ON_REQUEST_DISPLAY_CONDITION_KEY]: vi.fn(() => gate.promise),
      [EDITOR_KEY]: editor,
    });
    await openCondition(wrapper);
    const pending = wrapper
      .get('[data-testid="display-condition-request"]')
      .trigger("click");
    await nextTick();

    wrapper.unmount();
    gate.resolve({ label: 1, before: "{% if vip %}", after: "{% endif %}" } as never);
    await pending;
    await flushPromises();

    expect(wrapper.emitted("update")).toBeUndefined();
    expect(editor.updateBlock).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("writes a late result onto the original block when the selection changed", async () => {
    const gate = deferred<DisplayCondition | null>();
    const editor = editorDouble({ index: 0 });
    const wrapper = mountSettings(
      createTitleBlock({ id: "title", content: "Hello" }),
      {
        [ON_REQUEST_DISPLAY_CONDITION_KEY]: vi.fn(() => gate.promise),
        [EDITOR_KEY]: editor,
      },
    );
    await openCondition(wrapper);
    const pending = wrapper
      .get('[data-testid="display-condition-request"]')
      .trigger("click");
    await nextTick();
    await wrapper.setProps({
      block: createTitleBlock({ id: "other", content: "Other" }),
    });

    gate.resolve(vip);
    await pending;
    await flushPromises();

    expect(wrapper.emitted("update")).toBeUndefined();
    expect(editor.findBlockLocation).toHaveBeenCalledWith("title");
    expect(editor.updateBlock).toHaveBeenCalledTimes(1);
    expect(editor.updateBlock).toHaveBeenCalledWith("title", {
      displayCondition: vip,
    });
  });

  it("drops a late result when the original block is gone", async () => {
    const gate = deferred<DisplayCondition | null>();
    const editor = editorDouble(null);
    const wrapper = mountSettings(
      createTitleBlock({ id: "title", content: "Hello" }),
      {
        [ON_REQUEST_DISPLAY_CONDITION_KEY]: vi.fn(() => gate.promise),
        [EDITOR_KEY]: editor,
      },
    );
    await openCondition(wrapper);
    const pending = wrapper
      .get('[data-testid="display-condition-request"]')
      .trigger("click");
    await nextTick();
    await wrapper.setProps({
      block: createTitleBlock({ id: "other", content: "Other" }),
    });

    gate.resolve(vip);
    await pending;
    await flushPromises();

    expect(wrapper.emitted("update")).toBeUndefined();
    expect(editor.findBlockLocation).toHaveBeenCalledWith("title");
    expect(editor.updateBlock).not.toHaveBeenCalled();
  });

  it("drops a late result when the selection changed and no editor is injected", async () => {
    const gate = deferred<DisplayCondition | null>();
    const wrapper = mountSettings(
      createTitleBlock({ id: "title", content: "Hello" }),
      {
        [ON_REQUEST_DISPLAY_CONDITION_KEY]: vi.fn(() => gate.promise),
      },
    );
    await openCondition(wrapper);
    const pending = wrapper
      .get('[data-testid="display-condition-request"]')
      .trigger("click");
    await nextTick();
    await wrapper.setProps({
      block: createTitleBlock({ id: "other", content: "Other" }),
    });

    gate.resolve(vip);
    await pending;
    await flushPromises();

    expect(wrapper.emitted("update")).toBeUndefined();
  });
});

describe("Editor.vue displayConditions.onRequest", () => {
  const mounted: VueWrapper[] = [];

  afterEach(() => {
    for (const wrapper of mounted.splice(0)) wrapper.unmount();
    document.body.innerHTML = "";
  });

  async function mountRealEditor(
    displayConditions: DisplayConditionsConfig,
    options?: {
      localization?: { locales: string[] };
      contentLocales?: string[];
    },
  ) {
    const content = createDefaultTemplateContent();
    content.blocks = [
      createTitleBlock({ id: "title", content: "Hello" }),
      createTitleBlock({ id: "other", content: "Other" }),
    ];
    if (options?.contentLocales)
      content.settings.locales = options.contentLocales;
    const wrapper = mount(Editor, {
      attachTo: document.body,
      props: {
        config: {
          container: document.createElement("div"),
          content,
          displayConditions,
          ...(options?.localization
            ? { localization: options.localization }
            : {}),
        },
        translations: await loadTranslations("en"),
        fontsManager: useFonts(undefined),
      } as never,
      global: { stubs: { teleport: true, "hex-color-picker": true } },
    });
    mounted.push(wrapper);
    await vi.dynamicImportSettled();
    await flushPromises();
    const provides = (
      wrapper.findComponent(Canvas).vm as {
        $: { provides: Record<symbol, unknown> };
      }
    ).$.provides;
    return {
      wrapper,
      editor: provides[EDITOR_KEY] as UseEditorReturn,
      history: provides[HISTORY_KEY] as { undo: () => void },
    };
  }

  async function openTitle(wrapper: VueWrapper, editor: UseEditorReturn) {
    editor.selectBlock("title");
    await vi.dynamicImportSettled();
    await flushPromises();
    await wrapper
      .get('[data-testid="display-condition-section"]')
      .trigger("click");
  }

  function blockById(editor: UseEditorReturn, id: string) {
    const block = editor.content.value.blocks.find((item) => item.id === id);
    if (!block) throw new Error(`missing block ${id}`);
    return block;
  }

  it("renders Add condition from a real config and no condition select", async () => {
    const { wrapper, editor } = await mountRealEditor({
      onRequest: async () => null,
      conditions: [
        { label: "VIP", before: "{% if vip %}", after: "{% endif %}" },
      ],
    });
    await openTitle(wrapper, editor);

    expect(wrapper.get('[data-testid="display-condition-request"]').text()).toBe(
      "Add condition",
    );
    expect(wrapper.find('[data-testid="display-condition-select"]').exists()).toBe(
      false,
    );
  });

  it("undo removes a condition added through onRequest", async () => {
    const condition: DisplayCondition = {
      label: "VIP",
      before: "{% if vip %}",
      after: "{% endif %}",
      data: { tier: "vip" },
    };
    const { wrapper, editor, history } = await mountRealEditor({
      onRequest: async () => condition,
    });
    await openTitle(wrapper, editor);

    await wrapper.get('[data-testid="display-condition-request"]').trigger("click");
    await flushPromises();

    expect(blockById(editor, "title").displayCondition).toEqual(condition);
    expect(blockById(editor, "title").displayCondition?.data).toEqual({
      tier: "vip",
    });

    history.undo();
    await nextTick();

    expect(blockById(editor, "title").displayCondition).toBeUndefined();
  });

  it("lands a late result on the block that was selected when the request started", async () => {
    const gate = deferred<DisplayCondition | null>();
    const condition: DisplayCondition = {
      label: "VIP",
      before: "{% if vip %}",
      after: "{% endif %}",
      data: { tier: "vip" },
    };
    const { wrapper, editor } = await mountRealEditor({
      onRequest: () => gate.promise,
    });
    await openTitle(wrapper, editor);
    const pending = wrapper
      .get('[data-testid="display-condition-request"]')
      .trigger("click");
    await nextTick();

    editor.selectBlock("other");
    await nextTick();
    gate.resolve(condition);
    await pending;
    await flushPromises();

    expect(blockById(editor, "title").displayCondition).toEqual(condition);
    expect(blockById(editor, "other").displayCondition).toBeUndefined();
  });

  it("does not apply a late result to the block insertBlock selects before props flush", async () => {
    const gate = deferred<DisplayCondition | null>();
    const condition: DisplayCondition = {
      label: "VIP",
      before: "{% if vip %}",
      after: "{% endif %}",
      data: { tier: "vip" },
    };
    const { wrapper, editor } = await mountRealEditor({
      onRequest: () => gate.promise,
    });
    await openTitle(wrapper, editor);
    const pending = wrapper
      .get('[data-testid="display-condition-request"]')
      .trigger("click");
    await nextTick();

    // Queue the insert ahead of the resolution so selectBlock runs, and Vue's
    // prop flush is still pending, when writeCondition reads props.block.
    const inserted = Promise.resolve().then(() =>
      (
        wrapper.vm as unknown as {
          insertBlock: (
            block: ReturnType<typeof createTitleBlock>,
          ) => string | null;
        }
      ).insertBlock(createTitleBlock({ content: "Inserted" })),
    );
    gate.resolve(condition);
    const insertedId = await inserted;
    await pending;
    await flushPromises();

    expect(insertedId).not.toBeNull();
    expect(editor.state.selectedBlockId).toBe(insertedId);
    expect(blockById(editor, "title").displayCondition).toEqual(condition);
    expect(blockById(editor, insertedId!).displayCondition).toBeUndefined();
  });

  it("stores a display condition on the active locale layer", async () => {
    const condition: DisplayCondition = {
      label: "VIP",
      before: "{% if vip %}",
      after: "{% endif %}",
      data: { tier: "vip" },
    };
    const { wrapper, editor } = await mountRealEditor(
      { onRequest: async () => condition },
      {
        localization: { locales: ["en", "de"] },
        contentLocales: ["de"],
      },
    );
    editor.setActiveLocale?.("de");
    await openTitle(wrapper, editor);

    await wrapper.get('[data-testid="display-condition-request"]').trigger("click");
    await flushPromises();

    const title = blockById(editor, "title");
    expect(editor.activeLocale?.value).toBe("de");
    expect(title.displayCondition).toBeUndefined();
    expect(title.l10n?.de?.set?.displayCondition).toEqual(condition);
    expect(blockById(editor, "other").l10n?.de?.set?.displayCondition).toBeUndefined();
  });

  it("drops a late result when the active locale changed during the request", async () => {
    const gate = deferred<DisplayCondition | null>();
    const condition: DisplayCondition = {
      label: "VIP",
      before: "{% if vip %}",
      after: "{% endif %}",
      data: { tier: "vip" },
    };
    const { wrapper, editor } = await mountRealEditor(
      { onRequest: () => gate.promise },
      {
        localization: { locales: ["en", "de"] },
        contentLocales: ["de"],
      },
    );
    await openTitle(wrapper, editor);
    const pending = wrapper
      .get('[data-testid="display-condition-request"]')
      .trigger("click");
    await nextTick();

    editor.setActiveLocale?.("de");
    await nextTick();
    gate.resolve(condition);
    await pending;
    await flushPromises();

    const title = blockById(editor, "title");
    expect(editor.activeLocale?.value).toBe("de");
    expect(title.displayCondition).toBeUndefined();
    expect(title.l10n?.de?.set?.displayCondition).toBeUndefined();
    expect(blockById(editor, "other").displayCondition).toBeUndefined();
  });
});
