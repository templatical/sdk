// @vitest-environment happy-dom
import "./dom-stubs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import type { MergeTag } from "@templatical/types";
import MergeTagPickerModal from "../src/components/MergeTagPickerModal.vue";
import {
  MERGE_TAG_PICKER_KEY,
  POPOVER_ROOT_KEY,
  TRANSLATIONS_KEY,
} from "../src/keys";
import { useMergeTagPicker } from "../src/composables/useMergeTagPicker";
import enTranslations from "../src/i18n/locales/en";
import { mountEditor } from "./helpers/mount";

let popoverRootEl: HTMLElement;

beforeEach(() => {
  popoverRootEl = document.createElement("div");
  popoverRootEl.className = "tpl-popover-root";
  document.body.appendChild(popoverRootEl);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  popoverRootEl.remove();
  vi.useRealTimers();
});

const flatTags: MergeTag[] = [
  { label: "First Name", value: "{{first_name}}" },
  { label: "Last Name", value: "{{last_name}}" },
  { label: "Email Address", value: "{{email}}", description: "Primary contact" },
];

const groupedTags: MergeTag[] = [
  { label: "First Name", value: "{{first_name}}", group: "Recipient" },
  {
    label: "Last Name",
    value: "{{last_name}}",
    group: "Recipient",
    description: "Family name",
  },
  { label: "Company", value: "{{company.name}}", group: "Account" },
  { label: "Unsubscribe URL", value: "{{unsubscribe_url}}" }, // ungrouped → "Other"
];

function mountPicker(initialTags: MergeTag[] = []) {
  const picker = useMergeTagPicker();
  const wrapper = mountEditor(MergeTagPickerModal, {
    attachTo: document.body,
    provides: {
      [POPOVER_ROOT_KEY]: ref<HTMLElement | null>(popoverRootEl),
      [MERGE_TAG_PICKER_KEY]: picker,
      [TRANSLATIONS_KEY]: enTranslations,
    },
  });
  let openPromise: Promise<MergeTag | null> | null = null;
  if (initialTags.length > 0) {
    openPromise = picker.open(initialTags);
  }
  return { picker, wrapper, openPromise };
}

function findDialog(): HTMLElement | null {
  return popoverRootEl.querySelector<HTMLElement>(
    '[data-testid="merge-tag-picker-modal"]',
  );
}

function findItems(): HTMLElement[] {
  return Array.from(
    popoverRootEl.querySelectorAll<HTMLElement>(
      '[data-testid="merge-tag-picker-item"]',
    ),
  );
}

function findHeaders(): HTMLElement[] {
  return Array.from(
    popoverRootEl.querySelectorAll<HTMLElement>(
      '[data-testid="merge-tag-picker-group-header"]',
    ),
  );
}

function findPills(): HTMLElement[] {
  return Array.from(
    popoverRootEl.querySelectorAll<HTMLElement>(
      '[data-testid="merge-tag-picker-group-pill"]',
    ),
  );
}

function findPillRow(): HTMLElement | null {
  return popoverRootEl.querySelector<HTMLElement>(
    '[data-testid="merge-tag-picker-group-pills"]',
  );
}

function findHeaderByGroup(group: string): HTMLElement | null {
  return popoverRootEl.querySelector<HTMLElement>(
    `[data-testid="merge-tag-picker-group-header"][data-group-name="${group}"]`,
  );
}

function findEmpty(): HTMLElement | null {
  return popoverRootEl.querySelector<HTMLElement>(
    '[data-testid="merge-tag-picker-empty"]',
  );
}

async function typeInSearch(value: string): Promise<void> {
  const input = popoverRootEl.querySelector<HTMLInputElement>(
    '[data-testid="merge-tag-picker-search"]',
  );
  if (!input) throw new Error("Search input not mounted");
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await nextTick();
}

describe("MergeTagPickerModal — render lifecycle", () => {
  it("renders nothing when picker.isOpen is false", async () => {
    mountPicker();
    await nextTick();
    expect(findDialog()).toBe(null);
  });

  it("renders modal shell when picker.isOpen flips to true", async () => {
    const { picker } = mountPicker();
    picker.open(flatTags);
    await nextTick();
    expect(findDialog()).not.toBe(null);
  });

  it("disappears when picker.isOpen flips back to false", async () => {
    const { picker } = mountPicker(flatTags);
    await nextTick();
    expect(findDialog()).not.toBe(null);
    picker.resolve(null);
    await nextTick();
    expect(findDialog()).toBe(null);
  });

  it("search input is auto-focused on open", async () => {
    const { picker } = mountPicker();
    picker.open(flatTags);
    await nextTick();
    await nextTick();
    const input = popoverRootEl.querySelector<HTMLInputElement>(
      '[data-testid="merge-tag-picker-search"]',
    );
    expect(input).not.toBe(null);
    expect(document.activeElement === input).toBe(true);
  });
});

describe("MergeTagPickerModal — flat-list mode (no tag has group)", () => {
  it("renders a flat list with no group headers anywhere", async () => {
    mountPicker(flatTags);
    await nextTick();
    expect(findHeaders()).toHaveLength(0);
  });

  it("does not render an Other header in flat mode", async () => {
    mountPicker(flatTags);
    await nextTick();
    const headers = findHeaders();
    expect(headers).toHaveLength(0);
  });

  it("item count in DOM matches tags.length", async () => {
    mountPicker(flatTags);
    await nextTick();
    expect(findItems()).toHaveLength(flatTags.length);
  });
});

describe("MergeTagPickerModal — grouped mode (≥1 tag has group)", () => {
  it("renders headers including translated Other for ungrouped items", async () => {
    mountPicker(groupedTags);
    await nextTick();
    const headers = findHeaders();
    const headerTexts = headers.map((h) => h.textContent?.trim() ?? "");
    expect(headers).toHaveLength(3);
    expect(headerTexts[0]).toContain("Recipient");
    expect(headerTexts[1]).toContain("Account");
    expect(headerTexts[2]).toContain("Other");
  });

  it("group order follows first-appearance in the tags array", async () => {
    mountPicker(groupedTags);
    await nextTick();
    const headers = findHeaders();
    const labels = headers.map((h) =>
      h.textContent?.replace(/\s+/g, " ").trim().split(" ")[0],
    );
    expect(labels).toEqual(["Recipient", "Account", "Other"]);
  });

  it("each header displays its count", async () => {
    mountPicker(groupedTags);
    await nextTick();
    const headers = findHeaders();
    expect(headers[0]!.textContent).toContain("(2)");
    expect(headers[1]!.textContent).toContain("(1)");
    expect(headers[2]!.textContent).toContain("(1)");
  });

  it("a tag without group does NOT trigger Other when zero other tags have a group", async () => {
    const tags: MergeTag[] = [
      { label: "A", value: "{{a}}" },
      { label: "B", value: "{{b}}" },
    ];
    mountPicker(tags);
    await nextTick();
    expect(findHeaders()).toHaveLength(0);
  });
});

describe("MergeTagPickerModal — row content", () => {
  it("each row shows its label", async () => {
    mountPicker(flatTags);
    await nextTick();
    const items = findItems();
    expect(items[0]!.textContent).toContain("First Name");
    expect(items[1]!.textContent).toContain("Last Name");
    expect(items[2]!.textContent).toContain("Email Address");
  });

  it("each row shows the raw value in mono styling", async () => {
    mountPicker(flatTags);
    await nextTick();
    const items = findItems();
    expect(items[0]!.textContent).toContain("{{first_name}}");
  });

  it("renders description only when set", async () => {
    mountPicker(flatTags);
    await nextTick();
    const items = findItems();
    expect(items[0]!.textContent).not.toContain("Primary contact");
    expect(items[2]!.textContent).toContain("Primary contact");
  });

  it("value element has line-clamp-2 + text-ellipsis classes for truncation", async () => {
    mountPicker(flatTags);
    await nextTick();
    const valueEls = popoverRootEl.querySelectorAll<HTMLElement>(
      '[data-testid="merge-tag-picker-item"] .tpl\\:font-mono',
    );
    expect(valueEls.length).toBeGreaterThan(0);
    const cls = valueEls[0]!.className;
    expect(cls).toContain("line-clamp-2");
    expect(cls).toContain("text-ellipsis");
  });

  it("each row carries a title attribute with full value/description for hover reveal", async () => {
    mountPicker(flatTags);
    await nextTick();
    const items = findItems();
    expect(items[2]!.getAttribute("title")).toContain("{{email}}");
    expect(items[2]!.getAttribute("title")).toContain("Primary contact");
    // Item without description: title is just the value.
    expect(items[0]!.getAttribute("title")).toBe("{{first_name}}");
  });
});

describe("MergeTagPickerModal — search filtering", () => {
  it("filters by label (case-insensitive substring)", async () => {
    mountPicker(flatTags);
    await nextTick();
    await typeInSearch("email");
    vi.advanceTimersByTime(250);
    await nextTick();
    const items = findItems();
    expect(items).toHaveLength(1);
    expect(items[0]!.getAttribute("data-merge-tag-value")).toBe("{{email}}");
  });

  it("filters by value", async () => {
    mountPicker(flatTags);
    await nextTick();
    await typeInSearch("last_name");
    vi.advanceTimersByTime(250);
    await nextTick();
    const items = findItems();
    expect(items).toHaveLength(1);
    expect(items[0]!.getAttribute("data-merge-tag-value")).toBe("{{last_name}}");
  });

  it("filters by description", async () => {
    mountPicker(flatTags);
    await nextTick();
    await typeInSearch("primary");
    vi.advanceTimersByTime(250);
    await nextTick();
    const items = findItems();
    expect(items).toHaveLength(1);
    expect(items[0]!.getAttribute("data-merge-tag-value")).toBe("{{email}}");
  });

  it("cleared search restores the full list", async () => {
    mountPicker(flatTags);
    await nextTick();
    await typeInSearch("email");
    vi.advanceTimersByTime(250);
    await nextTick();
    expect(findItems()).toHaveLength(1);
    await typeInSearch("");
    vi.advanceTimersByTime(250);
    await nextTick();
    expect(findItems()).toHaveLength(flatTags.length);
  });

  it("active search hides ALL group headers", async () => {
    mountPicker(groupedTags);
    await nextTick();
    expect(findHeaders().length).toBeGreaterThan(0);
    await typeInSearch("name");
    vi.advanceTimersByTime(250);
    await nextTick();
    expect(findHeaders()).toHaveLength(0);
  });

  it("zero matches renders the no-results empty state", async () => {
    mountPicker(flatTags);
    await nextTick();
    await typeInSearch("zzznomatch");
    vi.advanceTimersByTime(250);
    await nextTick();
    const empty = findEmpty();
    expect(empty).not.toBe(null);
    expect(empty!.textContent).toContain(enTranslations.mergeTag.picker.noResults);
  });

  it("empty state disappears as soon as one match exists", async () => {
    mountPicker(flatTags);
    await nextTick();
    await typeInSearch("zzz");
    vi.advanceTimersByTime(250);
    await nextTick();
    expect(findEmpty()).not.toBe(null);
    await typeInSearch("email");
    vi.advanceTimersByTime(250);
    await nextTick();
    expect(findEmpty()).toBe(null);
  });

  it("debounces: filter does not recompute until 200ms after the last keystroke", async () => {
    mountPicker(flatTags);
    await nextTick();
    await typeInSearch("email");
    // Before 200ms — still showing full list.
    vi.advanceTimersByTime(100);
    await nextTick();
    expect(findItems().length).toBe(flatTags.length);
    // After full 200ms — filter applied.
    vi.advanceTimersByTime(150);
    await nextTick();
    expect(findItems().length).toBe(1);
  });
});

describe("MergeTagPickerModal — single-step insert", () => {
  it("mouse click on a row resolves picker with that tag and closes modal", async () => {
    const { picker, openPromise } = mountPicker(flatTags);
    await nextTick();
    const items = findItems();
    items[1]!.click();
    const resolved = await openPromise!;
    expect(resolved).toEqual(flatTags[1]);
    await nextTick();
    expect(picker.isOpen.value).toBe(false);
  });

  it("Enter on the highlighted row resolves picker with that tag and closes modal", async () => {
    const { picker, openPromise } = mountPicker(flatTags);
    await nextTick();
    const dialog = findDialog()!;
    // Move highlight to second item, then Enter.
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    await nextTick();
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    const resolved = await openPromise!;
    expect(resolved).toEqual(flatTags[1]);
    await nextTick();
    expect(picker.isOpen.value).toBe(false);
  });
});

describe("MergeTagPickerModal — keyboard navigation", () => {
  it("initial highlight is the first item", async () => {
    mountPicker(flatTags);
    await nextTick();
    const first = findItems()[0]!;
    expect(first.getAttribute("aria-selected")).toBe("true");
  });

  it("ArrowDown moves highlight down", async () => {
    mountPicker(flatTags);
    await nextTick();
    const dialog = findDialog()!;
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    await nextTick();
    const items = findItems();
    expect(items[0]!.getAttribute("aria-selected")).toBe("false");
    expect(items[1]!.getAttribute("aria-selected")).toBe("true");
  });

  it("ArrowUp moves highlight up", async () => {
    mountPicker(flatTags);
    await nextTick();
    const dialog = findDialog()!;
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    await nextTick();
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
    );
    await nextTick();
    expect(findItems()[0]!.getAttribute("aria-selected")).toBe("true");
  });

  it("ArrowDown past last item stops at last", async () => {
    mountPicker(flatTags);
    await nextTick();
    const dialog = findDialog()!;
    for (let i = 0; i < flatTags.length + 5; i++) {
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
    }
    await nextTick();
    const items = findItems();
    expect(items[items.length - 1]!.getAttribute("aria-selected")).toBe("true");
  });

  it("ArrowUp past first item stops at first", async () => {
    mountPicker(flatTags);
    await nextTick();
    const dialog = findDialog()!;
    for (let i = 0; i < 10; i++) {
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
      );
    }
    await nextTick();
    expect(findItems()[0]!.getAttribute("aria-selected")).toBe("true");
  });

  it("highlight skips group headers (headers not selectable)", async () => {
    // Three groups: Recipient (2), Account (1), Other (1) — 4 tag rows total.
    // Pressing ArrowDown 4× should land on the last tag, not on any header.
    mountPicker(groupedTags);
    await nextTick();
    const dialog = findDialog()!;
    for (let i = 0; i < 3; i++) {
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      );
    }
    await nextTick();
    const items = findItems();
    expect(items[3]!.getAttribute("aria-selected")).toBe("true");
  });
});

describe("MergeTagPickerModal — cancel paths", () => {
  it("does not render an explicit Cancel button — Esc/backdrop/× are the dismiss affordances", async () => {
    // Regression for the design pass that dropped the Cancel footer to
    // align the picker with the editor's other popups (autocomplete +
    // link dialog), which all dismiss via Esc / outside-click / × only.
    mountPicker(flatTags);
    await nextTick();
    expect(
      popoverRootEl.querySelector('[data-testid="merge-tag-picker-cancel"]'),
    ).toBe(null);
  });

  it("Header close (×) button resolves with null and closes", async () => {
    const { picker, openPromise } = mountPicker(flatTags);
    await nextTick();
    const closeBtn = popoverRootEl.querySelector<HTMLButtonElement>(
      '[data-testid="merge-tag-picker-close"]',
    );
    closeBtn!.click();
    expect(await openPromise!).toBeNull();
    await nextTick();
    expect(picker.isOpen.value).toBe(false);
  });
});

describe("MergeTagPickerModal — a11y", () => {
  it("dialog has role=dialog and aria-modal=true", async () => {
    mountPicker(flatTags);
    await nextTick();
    const dialog = findDialog()!;
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("search input has aria-controls referencing the list id", async () => {
    mountPicker(flatTags);
    await nextTick();
    const input = popoverRootEl.querySelector<HTMLInputElement>(
      '[data-testid="merge-tag-picker-search"]',
    );
    const list = popoverRootEl.querySelector<HTMLElement>(
      '[data-testid="merge-tag-picker-list"]',
    );
    expect(input!.getAttribute("aria-controls")).toBe(list!.id);
  });

  it("list items have role=option", async () => {
    mountPicker(flatTags);
    await nextTick();
    const items = findItems();
    for (const item of items) {
      expect(item.getAttribute("role")).toBe("option");
    }
  });
});

describe("MergeTagPickerModal — theming", () => {
  it("panel carries data-tpl-theme so dark-mode + theme-config tokens resolve locally", async () => {
    // Regression: the panel has the `tpl` token class, which re-declares
    // every design token with LIGHT defaults via the base `.tpl` rule.
    // Without `data-tpl-theme` on the same element, the
    // `.tpl[data-tpl-theme="dark"]` block never matches the panel and the
    // picker ignores dark mode + the consumer's `theme` overrides. The
    // mount helper provides UI_THEME_KEY = "light".
    mountPicker(flatTags);
    await nextTick();
    const panel = findDialog()!;
    expect(panel.getAttribute("data-tpl-theme")).toBe("light");
    // It still carries the token class (the reason the attribute is needed).
    expect(panel.classList.contains("tpl")).toBe(true);
  });
});

describe("MergeTagPickerModal — i18n", () => {
  it("renders strings from t.mergeTag.picker.*", async () => {
    mountPicker(flatTags);
    await nextTick();
    expect(popoverRootEl.textContent).toContain(
      enTranslations.mergeTag.picker.title,
    );
    // Close button aria-label exposes the localized close string —
    // assert against attribute rather than visible text since the X icon
    // is graphic-only.
    const closeBtn = popoverRootEl.querySelector<HTMLButtonElement>(
      '[data-testid="merge-tag-picker-close"]',
    );
    expect(closeBtn!.getAttribute("aria-label")).toBe(
      enTranslations.mergeTag.picker.close,
    );
  });

  it("search placeholder comes from t.mergeTag.picker.searchPlaceholder", async () => {
    mountPicker(flatTags);
    await nextTick();
    const input = popoverRootEl.querySelector<HTMLInputElement>(
      '[data-testid="merge-tag-picker-search"]',
    );
    expect(input!.placeholder).toBe(
      enTranslations.mergeTag.picker.searchPlaceholder,
    );
  });
});

describe("MergeTagPickerModal — empty tags edge", () => {
  it("open([]) renders the configured-empty state via t.mergeTag.picker.empty", async () => {
    const { picker } = mountPicker();
    picker.open([]);
    await nextTick();
    const empty = findEmpty();
    expect(empty).not.toBe(null);
    expect(empty!.textContent).toContain(enTranslations.mergeTag.picker.empty);
  });
});

describe("MergeTagPickerModal — collapsible groups", () => {
  it("group headers render as interactive buttons with aria-expanded=true initially", async () => {
    mountPicker(groupedTags);
    await nextTick();
    const headers = findHeaders();
    expect(headers.length).toBeGreaterThan(0);
    for (const header of headers) {
      expect(header.tagName).toBe("BUTTON");
      expect(header.getAttribute("aria-expanded")).toBe("true");
      expect(header.getAttribute("data-group-collapsed")).toBe("false");
    }
  });

  it("clicking a header collapses that group — its tag rows disappear from the DOM", async () => {
    mountPicker(groupedTags);
    await nextTick();
    const countBefore = findItems().length;
    const recipientHeader = findHeaderByGroup("Recipient");
    expect(recipientHeader).not.toBe(null);
    // groupedTags fixture: Recipient holds 2 tags.
    recipientHeader!.click();
    await nextTick();
    expect(findItems().length).toBe(countBefore - 2);
    expect(recipientHeader!.getAttribute("aria-expanded")).toBe("false");
    expect(recipientHeader!.getAttribute("data-group-collapsed")).toBe("true");
  });

  it("clicking a collapsed header re-expands it (tags reappear)", async () => {
    mountPicker(groupedTags);
    await nextTick();
    const original = findItems().length;
    const header = findHeaderByGroup("Recipient")!;
    header.click();
    await nextTick();
    expect(findItems().length).toBeLessThan(original);
    header.click();
    await nextTick();
    expect(findItems().length).toBe(original);
    expect(header.getAttribute("aria-expanded")).toBe("true");
  });

  it("collapse state is independent per group", async () => {
    mountPicker(groupedTags);
    await nextTick();
    findHeaderByGroup("Recipient")!.click();
    await nextTick();
    expect(findHeaderByGroup("Recipient")!.getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(findHeaderByGroup("Account")!.getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  it("collapsed groups are excluded from keyboard navigation", async () => {
    // Layout: Recipient (2 tags), Account (1 tag), Other (1 tag) — total 4.
    // Collapsing Recipient removes its 2 tags from visibleTags, leaving 2.
    // Pressing ArrowDown should land on the second visible tag (now Other),
    // never on a Recipient tag.
    mountPicker(groupedTags);
    await nextTick();
    findHeaderByGroup("Recipient")!.click();
    await nextTick();
    expect(findItems().length).toBe(2);
    const dialog = findDialog()!;
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    await nextTick();
    const items = findItems();
    expect(items[1]!.getAttribute("aria-selected")).toBe("true");
    // Neither item should be a Recipient-group tag.
    const values = items.map((i) => i.getAttribute("data-merge-tag-value"));
    expect(values).not.toContain("{{first_name}}");
    expect(values).not.toContain("{{last_name}}");
  });

  it("collapsing every group keeps headers visible — does NOT fall into the no-results empty state", async () => {
    mountPicker(groupedTags);
    await nextTick();
    // Collapse every group present in the fixture (Recipient, Account, Other).
    for (const header of findHeaders()) {
      header.click();
    }
    await nextTick();
    // No tag rows are rendered (everything is collapsed)…
    expect(findItems()).toHaveLength(0);
    // …but the headers themselves still render, and the no-results empty
    // state must NOT show (there ARE matching tags, just hidden).
    expect(findEmpty()).toBe(null);
    expect(findHeaders().length).toBeGreaterThan(0);
  });

  it("collapse state resets each time the modal reopens", async () => {
    const { picker } = mountPicker(groupedTags);
    await nextTick();
    findHeaderByGroup("Recipient")!.click();
    await nextTick();
    expect(findHeaderByGroup("Recipient")!.getAttribute("aria-expanded")).toBe(
      "false",
    );
    picker.resolve(null);
    await nextTick();
    picker.open(groupedTags);
    await nextTick();
    expect(findHeaderByGroup("Recipient")!.getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  it("header has a chevron icon that rotates when collapsed", async () => {
    mountPicker(groupedTags);
    await nextTick();
    const header = findHeaderByGroup("Recipient")!;
    const chevron = header.querySelector("svg");
    expect(chevron).not.toBe(null);
    expect(chevron!.classList.contains("tpl:-rotate-90")).toBe(false);
    header.click();
    await nextTick();
    expect(chevron!.classList.contains("tpl:-rotate-90")).toBe(true);
  });
});

describe("MergeTagPickerModal — group pill row", () => {
  it("renders one pill per group when grouping is active (>1 groups)", async () => {
    mountPicker(groupedTags);
    await nextTick();
    const pills = findPills();
    // groupedTags fixture: Recipient, Account, Other → 3 groups.
    expect(pills).toHaveLength(3);
    const labels = pills.map((p) => p.textContent?.trim());
    expect(labels).toEqual(["Recipient", "Account", "Other"]);
  });

  it("pill row is hidden in flat mode (no tag has group)", async () => {
    mountPicker(flatTags);
    await nextTick();
    expect(findPillRow()).toBe(null);
  });

  it("pill row is hidden during active search (the list flattens)", async () => {
    mountPicker(groupedTags);
    await nextTick();
    expect(findPillRow()).not.toBe(null);
    await typeInSearch("name");
    vi.advanceTimersByTime(250);
    await nextTick();
    expect(findPillRow()).toBe(null);
  });

  it("clicking a pill scrolls the list to the matching group's natural top position", async () => {
    mountPicker(groupedTags);
    await nextTick();
    const list = popoverRootEl.querySelector<HTMLElement>(
      '[data-testid="merge-tag-picker-list"]',
    )!;
    const spy = vi.spyOn(list, "scrollTo");
    findPills()
      .find((p) => p.dataset.groupName === "Account")!
      .click();
    await nextTick();
    expect(spy).toHaveBeenCalled();
    const callArg = spy.mock.calls[0]![0] as ScrollToOptions;
    expect(callArg.behavior).toBe("smooth");
    expect(typeof callArg.top).toBe("number");
  });

  it("clicking a pill for a collapsed group expands it first", async () => {
    mountPicker(groupedTags);
    await nextTick();
    findHeaderByGroup("Account")!.click();
    await nextTick();
    expect(findHeaderByGroup("Account")!.getAttribute("aria-expanded")).toBe(
      "false",
    );
    findPills()
      .find((p) => p.dataset.groupName === "Account")!
      .click();
    await nextTick();
    expect(findHeaderByGroup("Account")!.getAttribute("aria-expanded")).toBe(
      "true",
    );
  });

  it("pill row is hidden when there is exactly one group (no jump benefit)", async () => {
    const oneGroupTags = [
      { label: "A", value: "{{a}}", group: "Recipient" },
      { label: "B", value: "{{b}}", group: "Recipient" },
    ];
    mountPicker(oneGroupTags);
    await nextTick();
    expect(findPillRow()).toBe(null);
  });
});
