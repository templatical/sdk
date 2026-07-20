// @vitest-environment happy-dom
//
// Behavior tests for the merge-tag suggestion popup lifecycle. The render
// factory (`createMergeTagSuggestionRenderer`) returns the
// `@tiptap/suggestion` handler object — we drive onStart/onUpdate/onKeyDown/
// onExit directly with mocked `SuggestionProps`, asserting the real DOM,
// ARIA, positioning, scroll-listener, and cleanup effects — asserting real
// runtime behavior rather than source-text patterns.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import type { MergeTag } from "@templatical/types";
import { createMergeTagSuggestionRenderer } from "../src/extensions/MergeTagSuggestion";

// Stub the list component so we exercise the popup lifecycle, not the SFC.
vi.mock("../src/components/MergeTagSuggestionList.vue", () => ({
  default: { name: "MergeTagSuggestionListStub", render: () => null },
}));

const TAGS: MergeTag[] = [
  { label: "First Name", value: "first_name" },
  { label: "Last Name", value: "last_name" },
  { label: "Email", value: "email" },
];

type MutableRect = { left: number; top: number; bottom: number };

function makeRect(r: MutableRect): DOMRect {
  return {
    left: r.left,
    top: r.top,
    bottom: r.bottom,
    right: r.left,
    width: 0,
    height: r.bottom - r.top,
    x: r.left,
    y: r.top,
    toJSON: () => ({}),
  } as DOMRect;
}

function makeProps(opts: {
  items?: MergeTag[];
  command?: (item: MergeTag) => void;
  editable?: HTMLElement;
  rect?: MutableRect;
}) {
  const editable =
    opts.editable ?? (() => {
      const el = document.createElement("div");
      document.body.appendChild(el);
      return el;
    })();
  const rect = opts.rect ?? { left: 10, top: 5, bottom: 20 };
  return {
    props: {
      items: opts.items ?? TAGS,
      command: opts.command ?? vi.fn(),
      clientRect: () => makeRect(rect),
      editor: { view: { dom: editable } },
    } as never,
    editable,
    rect,
  };
}

let rafCb: FrameRequestCallback | null = null;
const cancelSpy = vi.fn();

beforeEach(() => {
  document.body.innerHTML = "";
  rafCb = null;
  cancelSpy.mockClear();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafCb = cb;
    return 7;
  });
  vi.stubGlobal("cancelAnimationFrame", cancelSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function popup(): HTMLElement | null {
  return document.querySelector('[data-testid="merge-tag-suggestion-popup"]');
}

describe("merge-tag suggestion popup — onStart", () => {
  it("mounts the popup into document.body and wires combobox ARIA", () => {
    const handlers = createMergeTagSuggestionRenderer("No matches", null)();
    const { props, editable } = makeProps({});

    handlers.onStart!(props);

    const el = popup();
    expect(el).not.toBeNull();
    expect(el!.parentNode).toBe(document.body);

    expect(editable.getAttribute("role")).toBe("combobox");
    expect(editable.getAttribute("aria-haspopup")).toBe("listbox");
    expect(editable.getAttribute("aria-expanded")).toBe("true");

    const listId = editable.getAttribute("aria-controls");
    expect(listId).toMatch(/^tpl-merge-tag-suggestion-\d+$/);
    expect(editable.getAttribute("aria-activedescendant")).toBe(`${listId}-opt-0`);

    // repositionAfterPaint scheduled a frame.
    expect(typeof rafCb).toBe("function");
  });

  it("omits aria-activedescendant when there are no items", () => {
    const handlers = createMergeTagSuggestionRenderer("No matches", null)();
    const { props, editable } = makeProps({ items: [] });

    handlers.onStart!(props);

    expect(editable.getAttribute("role")).toBe("combobox");
    expect(editable.getAttribute("aria-activedescendant")).toBeNull();
  });

  it("mounts into the popoverRoot element when provided (shadow-aware path)", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const handlers = createMergeTagSuggestionRenderer(
      "No matches",
      ref(root),
    )();
    const { props } = makeProps({});

    handlers.onStart!(props);

    const el = popup();
    expect(el).not.toBeNull();
    expect(el!.parentNode).toBe(root);
  });

  it("copies the theme attribute from the editor's [data-tpl-theme] root", () => {
    const themeRoot = document.createElement("div");
    themeRoot.setAttribute("data-tpl-theme", "dark");
    const editable = document.createElement("div");
    themeRoot.appendChild(editable);
    document.body.appendChild(themeRoot);

    const handlers = createMergeTagSuggestionRenderer("No matches", null)();
    const { props } = makeProps({ editable });

    handlers.onStart!(props);

    expect(popup()!.getAttribute("data-tpl-theme")).toBe("dark");
  });
});

describe("merge-tag suggestion popup — positioning", () => {
  it("positions absolute at the caret rect (offset parent at origin) when on-screen", () => {
    const handlers = createMergeTagSuggestionRenderer("No matches", null)();
    const { props } = makeProps({ rect: { left: 42, top: 100, bottom: 118 } });

    handlers.onStart!(props);

    const el = popup()!;
    // `absolute` (not `fixed`) so a transformed ancestor of the editor can't
    // offset the popup; coords are viewport minus the offset parent's rect,
    // which is the origin here (no layout in the test env), so they match the
    // caret rect.
    expect(el.style.position).toBe("absolute");
    expect(el.style.left).toBe("42px");
    expect(el.style.top).toBe("118px");
    expect(el.style.zIndex).toBe("9999");
  });

  it("freezes (does not set position) when the caret has scrolled off-screen", () => {
    const handlers = createMergeTagSuggestionRenderer("No matches", null)();
    const { props } = makeProps({ rect: { left: 10, top: -80, bottom: -50 } });

    handlers.onStart!(props);

    const el = popup()!;
    expect(el.style.left).toBe("");
    expect(el.style.position).toBe("");
  });

  it("repositions on window resize and stops after exit", () => {
    const handlers = createMergeTagSuggestionRenderer("No matches", null)();
    const rect = { left: 10, top: 5, bottom: 20 };
    const { props } = makeProps({ rect });

    handlers.onStart!(props);
    expect(popup()!.style.left).toBe("10px");

    rect.left = 99;
    window.dispatchEvent(new Event("resize"));
    expect(popup()!.style.left).toBe("99px");

    handlers.onExit!();
    // After exit the listener is detached — a further resize is a no-op
    // (and must not throw now that the container is gone).
    rect.left = 5;
    window.dispatchEvent(new Event("resize"));
    expect(popup()).toBeNull();
  });
});

describe("merge-tag suggestion popup — keyboard", () => {
  it("ArrowDown / ArrowUp cycle the active descendant", () => {
    const handlers = createMergeTagSuggestionRenderer("No matches", null)();
    const { props, editable } = makeProps({});
    handlers.onStart!(props);
    const listId = editable.getAttribute("aria-controls")!;

    const press = (key: string) =>
      handlers.onKeyDown!({
        event: new KeyboardEvent("keydown", { key }),
      } as never);

    expect(press("ArrowDown")).toBe(true);
    expect(editable.getAttribute("aria-activedescendant")).toBe(`${listId}-opt-1`);

    expect(press("ArrowDown")).toBe(true);
    expect(editable.getAttribute("aria-activedescendant")).toBe(`${listId}-opt-2`);

    // wraps back to 0
    expect(press("ArrowDown")).toBe(true);
    expect(editable.getAttribute("aria-activedescendant")).toBe(`${listId}-opt-0`);

    // ArrowUp wraps to the last item
    expect(press("ArrowUp")).toBe(true);
    expect(editable.getAttribute("aria-activedescendant")).toBe(`${listId}-opt-2`);
  });

  it("Enter selects the active item via the command callback", () => {
    const command = vi.fn();
    const handlers = createMergeTagSuggestionRenderer("No matches", null)();
    const { props } = makeProps({ command });
    handlers.onStart!(props);

    handlers.onKeyDown!({
      event: new KeyboardEvent("keydown", { key: "ArrowDown" }),
    } as never);
    const handled = handlers.onKeyDown!({
      event: new KeyboardEvent("keydown", { key: "Enter" }),
    } as never);

    expect(handled).toBe(true);
    expect(command).toHaveBeenCalledWith(TAGS[1]);
  });

  it("Escape is handled (returns true) without selecting", () => {
    const command = vi.fn();
    const handlers = createMergeTagSuggestionRenderer("No matches", null)();
    const { props } = makeProps({ command });
    handlers.onStart!(props);

    const handled = handlers.onKeyDown!({
      event: new KeyboardEvent("keydown", { key: "Escape" }),
    } as never);

    expect(handled).toBe(true);
    expect(command).not.toHaveBeenCalled();
  });

  it("Enter on an empty list is swallowed (true) and selects nothing", () => {
    const command = vi.fn();
    const handlers = createMergeTagSuggestionRenderer("No matches", null)();
    const { props } = makeProps({ items: [], command });
    handlers.onStart!(props);

    const handled = handlers.onKeyDown!({
      event: new KeyboardEvent("keydown", { key: "Enter" }),
    } as never);

    expect(handled).toBe(true);
    expect(command).not.toHaveBeenCalled();
  });
});

describe("merge-tag suggestion popup — onUpdate", () => {
  it("resets the selection when the new item set is shorter", () => {
    const command = vi.fn();
    const handlers = createMergeTagSuggestionRenderer("No matches", null)();
    const { props, editable } = makeProps({ command });
    handlers.onStart!(props);
    const listId = editable.getAttribute("aria-controls")!;

    // Move selection to index 2.
    handlers.onKeyDown!({
      event: new KeyboardEvent("keydown", { key: "ArrowUp" }),
    } as never);
    expect(editable.getAttribute("aria-activedescendant")).toBe(`${listId}-opt-2`);

    // Query narrows to a single item — selection must reset to 0.
    const single: MergeTag[] = [{ label: "Only", value: "only" }];
    const newCommand = vi.fn();
    handlers.onUpdate!({
      items: single,
      command: newCommand,
      clientRect: () => makeRect({ left: 10, top: 5, bottom: 20 }),
      editor: { view: { dom: editable } },
    } as never);

    expect(editable.getAttribute("aria-activedescendant")).toBe(`${listId}-opt-0`);

    // Enter now selects the new single item via the updated command.
    handlers.onKeyDown!({
      event: new KeyboardEvent("keydown", { key: "Enter" }),
    } as never);
    expect(newCommand).toHaveBeenCalledWith(single[0]);
  });
});

describe("merge-tag suggestion popup — onExit", () => {
  it("removes the popup, clears ARIA, and cancels the pending frame", () => {
    const handlers = createMergeTagSuggestionRenderer("No matches", null)();
    const { props, editable } = makeProps({});
    handlers.onStart!(props);
    expect(popup()).not.toBeNull();

    handlers.onExit!();

    expect(popup()).toBeNull();
    expect(editable.getAttribute("role")).toBeNull();
    expect(editable.getAttribute("aria-expanded")).toBeNull();
    expect(editable.getAttribute("aria-controls")).toBeNull();
    expect(editable.getAttribute("aria-activedescendant")).toBeNull();
    expect(editable.getAttribute("aria-haspopup")).toBeNull();
    expect(cancelSpy).toHaveBeenCalledWith(7);
  });
});
