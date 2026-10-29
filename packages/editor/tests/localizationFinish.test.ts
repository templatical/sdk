// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nextTick, ref } from "vue";
import { createTitleBlock } from "@templatical/types";
import { mountEditor } from "./helpers/mount";
import { languageContent, openLanguages } from "./helpers/localization";
import Canvas from "../src/components/Canvas.vue";
import BlockIssueBadge from "../src/components/canvas/BlockIssueBadge.vue";
import { EDITOR_KEY, TEMPLATE_LINT_KEY } from "../src/keys";
import * as styles from "../src/constants/styleConstants";

const source = (name: string) =>
  readFileSync(join(import.meta.dirname, "../src", name), "utf8");
const chip = '[data-block-id="title"] [data-testid="locale-chip"]';

describe("localization finish review", () => {
  it("keeps the original condition indicator in the left gutter when a block is selected", async () => {
    const content = languageContent();
    content.blocks[0].displayCondition = {
      label: "VIP",
      before: "",
      after: "",
    };
    const { wrapper, editor } = await openLanguages({ content });
    editor.setActiveLocale("de");
    await nextTick();
    const toggle = wrapper.get('[data-testid="condition-toggle"]');
    expect(
      toggle.element.parentElement!.classList.contains("tpl:-translate-x-full"),
    ).toBe(true);
    editor.selectBlock("title");
    await nextTick();
    expect(wrapper.findAll('[data-testid="condition-toggle"]')).toHaveLength(1);
    expect(
      wrapper
        .get(".tpl-block-actions")
        .find('[data-testid="condition-toggle"]')
        .exists(),
    ).toBe(false);
    expect(
      toggle.element.parentElement!.classList.contains("tpl:-left-1"),
    ).toBe(true);
  });
  it("puts the status badge in the block's corner slot with lint issues inward", async () => {
    const { wrapper, editor } = await openLanguages();
    editor.setActiveLocale("de");
    const lint = (wrapper.findComponent(Canvas).vm as any).$.provides[
      TEMPLATE_LINT_KEY as symbol
    ];
    await nextTick();
    await vi.dynamicImportSettled();
    lint.issues.value = [
      {
        ruleId: "a11y.image-missing-alt",
        blockId: "title",
        severity: "warning",
        message: "Missing alt",
      },
    ];
    await nextTick();
    await vi.dynamicImportSettled();
    const slot = wrapper.get('[data-block-id="title"] > .tpl-block-badges');
    for (const token of [
      "tpl:absolute",
      "tpl:top-1",
      "tpl:inset-e-1",
      "tpl:flex",
    ])
      expect(slot.classes()).toContain(token);
    // Inline order puts the last badge at the corner in either direction.
    const [inward, corner] = [...slot.element.children] as HTMLElement[];
    expect(corner.dataset.testid).toBe("locale-chip");
    expect(inward.classList).toContain("tpl-block-issue-badge");
    expect(inward.getAttribute("tabindex")).toBeNull();
    for (const token of [
      "tpl:size-5",
      "tpl:rounded-full",
      "tpl:bg-[var(--tpl-bg)]",
      "tpl:shadow-[var(--tpl-shadow-sm)]",
      "tpl:ring-1",
      "tpl:ring-[var(--tpl-border)]",
    ]) {
      expect(corner.classList).toContain(token);
      expect(inward.classList).toContain(token);
    }
    const chipButton = wrapper.get(chip);
    expect(chipButton.attributes("aria-label")).toBe("Out of date");
    expect(chipButton.attributes("title")).toBe("Out of date");
    expect(chipButton.text()).toBe("");
  });

  it("draws one icon per state in the badge", async () => {
    const { wrapper, editor } = await openLanguages();
    const icon = (id: string) =>
      wrapper
        .get(`[data-block-id="${id}"] [data-testid="locale-chip"] svg`)
        .classes();
    expect(icon("title")).toContain("lucide-languages");
    editor.setActiveLocale("de");
    await nextTick();
    expect(icon("title")).toContain("lucide-clock");
    expect(icon("image")).toContain("lucide-triangle-alert");
    editor.keepTranslations("title", ["content"]);
    editor.setBlockHidden("image", true);
    await nextTick();
    expect(icon("title")).toContain("lucide-pencil");
    expect(icon("image")).toContain("lucide-eye-off");
  });

  it.each([true, false])(
    "ranks stale actions with provider=%s and keeps Use English last",
    async (provider) => {
      const { wrapper, editor } = await openLanguages(
        provider
          ? {
              translation: { translate: vi.fn(async () => ({ fields: [] })) },
            }
          : {},
      );
      editor.setActiveLocale("de");
      await nextTick();
      await wrapper.get(chip).trigger("click");
      const actions = wrapper
        .get('[data-testid="locale-popover"]')
        .findAll("button");
      expect(actions[0].attributes("class")).toContain(
        styles.secondaryBtnCompactClass,
      );
      expect(actions[0].attributes("data-testid")).toBe(
        provider ? "locale-retranslate" : "locale-keep",
      );
      expect(actions.at(-1)!.attributes("data-testid")).toBe(
        "locale-use-default",
      );
      expect(actions.at(-1)!.classes()).toContain("tpl:bg-transparent");
      // The row keeps the popover's padding: a bordered action never touches
      // the popover's edge.
      const row = actions[0].element.parentElement!;
      expect([...row.classList]).toEqual([
        "tpl:mt-2",
        "tpl:flex",
        "tpl:flex-wrap",
        "tpl:gap-1",
      ]);
    },
  );

  it("keeps localization issues in the panel and opens the selected block chip from Jump", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(
      () => {},
    );
    const { wrapper, editor } = await openLanguages();
    editor.setActiveLocale("de");
    await wrapper.get("#tpl-tab-issues").trigger("click");
    await vi.dynamicImportSettled();
    const lint = (wrapper.findComponent(Canvas).vm as any).$.provides[
      TEMPLATE_LINT_KEY as symbol
    ];
    lint.issues.value = [
      {
        ruleId: "localization.stale",
        blockId: "title",
        severity: "warning",
        message: "Translation is out of date",
      },
    ];
    await nextTick();
    expect(wrapper.text()).toContain("Translation is out of date");
    await wrapper.get('[data-testid="issue-jump"]').trigger("click");
    await nextTick();
    await nextTick();
    expect(wrapper.find('[data-testid="locale-popover"]').exists()).toBe(true);
    expect(editor.state.selectedBlockId).toBe("title");
  });

  it("filters only localization rules from canvas badges in a language view", async () => {
    const activeLocale = ref<string | null>("de");
    const issues = ref([
      {
        ruleId: "localization.stale",
        blockId: "title",
        severity: "warning",
        message: "m",
      },
    ]);
    const wrapper = mountEditor(BlockIssueBadge, {
      props: { blockId: "title" },
      provides: {
        [EDITOR_KEY]: { activeLocale },
        [TEMPLATE_LINT_KEY]: { issues },
      },
    });
    try {
      expect(wrapper.find('[role="img"]').exists()).toBe(false);
      issues.value.push({
        ruleId: "a11y.image-missing-alt",
        blockId: "title",
        severity: "warning",
        message: "m",
      });
      await nextTick();
      expect(wrapper.find('[role="img"]').exists()).toBe(true);
      issues.value.pop();
      activeLocale.value = null;
      await nextTick();
      expect(wrapper.find('[role="img"]').exists()).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });

  it.each([1, 2])(
    "shows the plural-aware promotion reason for %s hidden blocks on a focusable item",
    async (count) => {
      const content = languageContent();
      content.blocks = Array.from({ length: count }, (_, index) =>
        createTitleBlock({
          id: `hidden-${index}`,
          l10n: { de: { hidden: true } },
        }),
      );
      const { wrapper } = await openLanguages({ content });
      await wrapper.get('[data-testid="language-menu"]').trigger("click");
      await wrapper.get('[data-testid="language-actions-de"]').trigger("click");
      const action = wrapper.get('[data-testid="language-make-default-de"]');
      expect(action.attributes("disabled")).toBeUndefined();
      expect(action.attributes("aria-disabled")).toBe("true");
      const reason = wrapper.get(`#${action.attributes("aria-describedby")}`);
      expect(reason.text()).toBe(
        `Show the ${count} ${count === 1 ? "block" : "blocks"} hidden in Deutsch first`,
      );
      expect(reason.classes()).toContain("tpl:text-[10px]");
      expect(document.activeElement).toBe(action.element);
      expect(action.find(".lucide-check").exists()).toBe(false);
      await action.trigger("click");
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    },
  );

  it("marks menu warnings and completion with semantic icon colours across the full row", async () => {
    const { wrapper, editor } = await openLanguages();
    await wrapper.get('[data-testid="language-menu"]').trigger("click");
    const status = wrapper.get('[data-testid="language-status-de"]');
    expect(status.get("svg").classes()).toContain(
      "tpl:text-[var(--tpl-warning)]",
    );
    editor.setActiveLocale("de");
    editor.keepTranslations("title", ["content"]);
    editor.removeBlock("image");
    await nextTick();
    expect(
      wrapper.get('[data-testid="language-status-de"] svg').classes(),
    ).toContain("tpl:text-[var(--tpl-success)]");
    const css = source("components/localization/LanguageMenu.vue").split(
      "<style scoped>",
    )[1];
    expect(css).toContain(".tpl-language-row:hover");
    expect(css).toContain(".tpl-language-row[data-active");
  });

  it("uses one borderless chrome pill recipe and compact ghost actions", async () => {
    expect(styles).toHaveProperty("ghostBtnCompactClass");
    expect(styles).toHaveProperty("chromePillClass");
    const pill = (styles as any).chromePillClass as string;
    for (const token of [
      "tpl:text-[10px]",
      "tpl:font-medium",
      "tpl:bg-[var(--tpl-bg-active)]",
      "tpl:rounded-[var(--tpl-radius-sm)]",
    ])
      expect(pill).toContain(token);
    expect(pill).not.toMatch(/tpl:border/);
    for (const file of [
      "components/localization/LanguageMenu.vue",
      "components/toolbar/FieldRow.vue",
      "components/CommentsSidebar.vue",
    ])
      expect(source(file)).toContain(':class="chromePillClass"');
    const { wrapper, editor } = await openLanguages({
      translation: { translate: async () => ({ fields: [] }) },
    });
    editor.setActiveLocale("de");
    await nextTick();
    for (const id of ["translate-all-again", "language-back-default"])
      expect(
        wrapper.get(`[data-testid="${id}"]`).attributes("class"),
      ).toContain((styles as any).ghostBtnCompactClass);
  });
});
