// @vitest-environment happy-dom
import "./dom-stubs";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import type { LogicPair, LogicTag } from "@templatical/types";
import LogicTagPickerModal from "../src/components/LogicTagPickerModal.vue";
import { LOGIC_TAG_PICKER_KEY, POPOVER_ROOT_KEY, TRANSLATIONS_KEY } from "../src/keys";
import { useLogicTagPicker } from "../src/composables/useLogicTagPicker";
import enTranslations from "../src/i18n/locales/en";
import { mountEditor } from "./helpers/mount";

let popoverRootEl: HTMLElement;

beforeEach(() => {
  popoverRootEl = document.createElement("div");
  popoverRootEl.className = "tpl-popover-root";
  document.body.appendChild(popoverRootEl);
});

afterEach(() => {
  popoverRootEl.remove();
});

const tags: LogicTag[] = [
  { label: "Else", value: "{% else %}", group: "Conditions" },
];
const pairs: LogicPair[] = [
  {
    label: "If VIP",
    before: "{% if customer.vip %}",
    after: "{% endif %}",
    group: "Conditions",
  },
  {
    label: "Loop items",
    before: "{% for item in items %}",
    after: "{% endfor %}",
    group: "Loops",
  },
];

function mountLogicPicker() {
  const picker = useLogicTagPicker();
  const wrapper = mountEditor(LogicTagPickerModal, {
    attachTo: document.body,
    provides: {
      [POPOVER_ROOT_KEY]: ref<HTMLElement | null>(popoverRootEl),
      [LOGIC_TAG_PICKER_KEY]: picker,
      [TRANSLATIONS_KEY]: enTranslations,
    },
  });
  return { picker, wrapper };
}

function items(): HTMLElement[] {
  return Array.from(
    popoverRootEl.querySelectorAll<HTMLElement>(
      '[data-testid="logic-picker-item"]',
    ),
  );
}
function headers(): string[] {
  return Array.from(
    popoverRootEl.querySelectorAll<HTMLElement>(
      '[data-testid="logic-picker-header"]',
    ),
  ).map((el) => el.textContent?.trim() ?? "");
}
function badges(): string[] {
  return Array.from(
    popoverRootEl.querySelectorAll<HTMLElement>(
      '[data-testid="merge-tag-logic-badge"]',
    ),
  ).map((el) => el.getAttribute("data-logic-keyword") ?? "");
}
// Headers (prefixed "# ") and item labels in DOM order — locks the combined
// grouping (which group each tag/pair lands under, and the order within it).
function sequence(): string[] {
  const list = popoverRootEl.querySelector('[data-testid="logic-picker-list"]');
  if (!list) return [];
  return Array.from(list.children).map((el) => {
    const testid = (el as HTMLElement).dataset.testid;
    if (testid === "logic-picker-header") return `# ${el.textContent?.trim()}`;
    // Item button: the first nested span is the label span.
    return el.querySelector("span span")?.textContent?.trim() ?? "";
  });
}

describe("LogicTagPickerModal", () => {
  it("renders nothing until the picker opens", async () => {
    mountLogicPicker();
    await nextTick();
    expect(
      popoverRootEl.querySelector('[data-testid="logic-picker-modal"]'),
    ).toBe(null);
  });

  it("renders one item per tag and pair once open", async () => {
    const { picker } = mountLogicPicker();
    picker.open(tags, pairs);
    await nextTick();
    expect(items()).toHaveLength(3);
  });

  it("groups tags and pairs together under a shared group header", async () => {
    const { picker } = mountLogicPicker();
    picker.open(tags, pairs);
    await nextTick();
    // A shared group ("Conditions") renders once and holds both its pair
    // (If VIP) and its standalone tag (Else); "Loops" holds the loop pair.
    // No separate "Blocks" section, no duplicated header.
    expect(headers()).toEqual(["Conditions", "Loops"]);
    // Airtight order: pairs sort ahead of standalone tags within a group,
    // so If VIP precedes Else under Conditions, then the Loops group.
    expect(sequence()).toEqual([
      "# Conditions",
      "If VIP",
      "Else",
      "# Loops",
      "Loop items",
    ]);
  });

  it("shows one badge per standalone tag and two per pair", async () => {
    const { picker } = mountLogicPicker();
    picker.open(tags, pairs);
    await nextTick();
    // Pairs first: If VIP (IF/ENDIF), then Else (ELSE) under Conditions,
    // then the Loop pair (FOR/ENDFOR).
    expect(badges()).toEqual(["IF", "ENDIF", "ELSE", "FOR", "ENDFOR"]);
  });

  it("resolves the picker with the clicked pair", async () => {
    const { picker } = mountLogicPicker();
    const promise = picker.open(tags, pairs);
    await nextTick();
    // Item order: [If VIP pair, Else tag, Loop items pair] (pairs first).
    items()[0].click();
    const result = await promise;
    // The picker stores tags/pairs in a ref, so the resolved item is a Vue
    // reactive proxy of the original — same content, different reference.
    expect(result).toStrictEqual(pairs[0]);
    expect(picker.isOpen.value).toBe(false);
  });

  it("shows the empty state when nothing is configured", async () => {
    const { picker } = mountLogicPicker();
    picker.open([], []);
    await nextTick();
    const empty = popoverRootEl.querySelector(
      '[data-testid="logic-picker-empty"]',
    );
    expect(empty?.textContent?.trim()).toBe(
      enTranslations.logicTag.picker.empty,
    );
  });
});
