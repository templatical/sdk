// @vitest-environment happy-dom
//
// Behavior tests for the input/textarea merge-tag autocomplete driver. Uses a
// real happy-dom `<input>` + the shared popup controller (with the list SFC
// stubbed, matching mergeTagSuggestionRenderer.test.ts) and asserts the real
// open/close/select effects — not source patterns.

import { describe, expect, it, vi, beforeEach, type InjectionKey } from "vitest";
import { createApp, defineComponent, h, ref } from "vue";
import type { MergeTag } from "@templatical/types";
import { SYNTAX_PRESETS } from "@templatical/types";
import { useMergeTagAutocomplete } from "../src/composables/useMergeTagAutocomplete";
import { POPOVER_ROOT_KEY } from "../src/keys";

vi.mock("../src/components/MergeTagSuggestionList.vue", () => ({
  default: { name: "MergeTagSuggestionListStub", render: () => null },
}));

const TAGS: MergeTag[] = [
  { label: "First Name", value: "{{first_name}}" },
  { label: "Last Name", value: "{{last_name}}" },
  { label: "Email", value: "{{email}}" },
];

function withProvide<T>(
  setup: () => T,
  provides: Record<symbol, unknown> = {},
): { app: ReturnType<typeof createApp>; result: T } {
  let result!: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => h("div");
      },
    }),
  );
  for (const sym of Object.getOwnPropertySymbols(provides)) {
    app.provide(sym as InjectionKey<unknown>, provides[sym]);
  }
  app.mount(document.createElement("div"));
  return { app, result };
}

function popupEl(): HTMLElement | null {
  return document.querySelector('[data-testid="merge-tag-suggestion-popup"]');
}

interface SetupOpts {
  value?: string;
  caret?: number;
  tags?: MergeTag[];
  syntax?: (typeof SYNTAX_PRESETS)[keyof typeof SYNTAX_PRESETS];
  enabled?: boolean;
}

function setupDriver(opts: SetupOpts = {}) {
  const input = document.createElement("input");
  input.value = opts.value ?? "";
  document.body.appendChild(input);
  if (opts.caret !== undefined) input.setSelectionRange(opts.caret, opts.caret);

  const elementRef = ref<HTMLInputElement | null>(input);
  const emit = vi.fn();
  const onInsert = vi.fn();
  const model = ref(input.value);
  emit.mockImplementation((v: string) => {
    model.value = v;
    input.value = v;
  });

  const popoverContainer = document.createElement("div");
  document.body.appendChild(popoverContainer);

  const { app, result } = withProvide(
    () =>
      useMergeTagAutocomplete({
        elementRef,
        modelValue: () => model.value,
        emit,
        mergeTags: opts.tags ?? TAGS,
        syntax: opts.syntax ?? SYNTAX_PRESETS.liquid,
        enabled: opts.enabled ?? true,
        onInsert,
      }),
    { [POPOVER_ROOT_KEY as symbol]: ref(popoverContainer) },
  );

  return { app, driver: result, input, emit, onInsert, popoverContainer };
}

const key = (k: string) => new KeyboardEvent("keydown", { key: k });

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("useMergeTagAutocomplete — availability gate", () => {
  it("is available with a built-in syntax, tags, and enabled", () => {
    const { driver } = setupDriver();
    expect(driver.available).toBe(true);
  });

  it("is unavailable when disabled by config", () => {
    const { driver } = setupDriver({ enabled: false });
    expect(driver.available).toBe(false);
  });

  it("is unavailable with no tags to filter", () => {
    const { driver } = setupDriver({ tags: [] });
    expect(driver.available).toBe(false);
  });

  it("is unavailable for a custom (non-built-in) syntax", () => {
    const custom = { value: /<<.+?>>/g, logic: /<%.+?%>/g };
    const { driver } = setupDriver({ syntax: custom });
    expect(driver.available).toBe(false);
  });

  it("does not open the popup when unavailable", () => {
    const { driver, input } = setupDriver({ enabled: false });
    input.value = "{{fir";
    input.setSelectionRange(5, 5);
    driver.refresh();
    expect(driver.isOpen()).toBe(false);
    expect(popupEl()).toBeNull();
  });
});

describe("useMergeTagAutocomplete — open / close", () => {
  it("opens the popup inside the popover root on an open trigger", () => {
    const { driver, input, popoverContainer } = setupDriver();
    input.value = "{{fir";
    input.setSelectionRange(5, 5);

    driver.refresh();

    expect(driver.isOpen()).toBe(true);
    const el = popupEl();
    expect(el).not.toBeNull();
    expect(el!.parentNode).toBe(popoverContainer);
  });

  it("closes the popup when the caret leaves the trigger", () => {
    const { driver, input } = setupDriver();
    input.value = "{{fir";
    input.setSelectionRange(5, 5);
    driver.refresh();
    expect(driver.isOpen()).toBe(true);

    input.value = "hello";
    input.setSelectionRange(5, 5);
    driver.refresh();

    expect(driver.isOpen()).toBe(false);
    expect(popupEl()).toBeNull();
  });

  it("does not reopen over a completed tag", () => {
    const { driver, input } = setupDriver();
    input.value = "{{first_name}}";
    input.setSelectionRange(14, 14);
    driver.refresh();
    expect(driver.isOpen()).toBe(false);
  });
});

describe("useMergeTagAutocomplete — selection", () => {
  it("replaces the typed fragment with the picked tag on Enter", () => {
    const { driver, input, emit, onInsert } = setupDriver();
    input.value = "{{fir";
    input.setSelectionRange(5, 5);
    driver.refresh();

    const handled = driver.handleKeydown(key("Enter"));

    expect(handled).toBe(true);
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("{{first_name}}");
    expect(driver.isOpen()).toBe(false);
  });

  it("preserves surrounding text when inserting mid-string", () => {
    const { driver, input, emit } = setupDriver({});
    input.value = "Hi {{la there";
    input.setSelectionRange(7, 7); // caret right after "{{la"
    driver.refresh();

    driver.handleKeydown(key("Enter"));

    expect(emit).toHaveBeenCalledWith("Hi {{last_name}} there");
  });

  it("absorbs a trailing closer so the tag is not doubled", () => {
    const { driver, input, emit } = setupDriver();
    input.value = "{{fir}}";
    input.setSelectionRange(5, 5); // caret before the "}}"
    driver.refresh();

    driver.handleKeydown(key("Enter"));

    expect(emit).toHaveBeenCalledWith("{{first_name}}");
  });

  it("moves the selection with ArrowDown before selecting", () => {
    const { driver, input, emit } = setupDriver();
    input.value = "{{"; // empty query → all tags
    input.setSelectionRange(2, 2);
    driver.refresh();

    driver.handleKeydown(key("ArrowDown")); // index 0 → 1
    driver.handleKeydown(key("Enter"));

    expect(emit).toHaveBeenCalledWith("{{last_name}}");
  });
});

describe("useMergeTagAutocomplete — keyboard routing", () => {
  it("returns false for any key when the popup is closed", () => {
    const { driver } = setupDriver();
    expect(driver.handleKeydown(key("ArrowDown"))).toBe(false);
    expect(driver.handleKeydown(key("Enter"))).toBe(false);
  });

  it("closes on Escape and reports it handled", () => {
    const { driver, input } = setupDriver();
    input.value = "{{fir";
    input.setSelectionRange(5, 5);
    driver.refresh();

    const handled = driver.handleKeydown(key("Escape"));

    expect(handled).toBe(true);
    expect(driver.isOpen()).toBe(false);
  });

  it("closes on a horizontal caret move but lets the key through", () => {
    const { driver, input } = setupDriver();
    input.value = "{{fir";
    input.setSelectionRange(5, 5);
    driver.refresh();

    const handled = driver.handleKeydown(key("ArrowLeft"));

    expect(handled).toBe(false);
    expect(driver.isOpen()).toBe(false);
  });
});

describe("useMergeTagAutocomplete — disposal", () => {
  it("closes the popup and stops responding after unmount", () => {
    const { app, driver, input } = setupDriver();
    input.value = "{{fir";
    input.setSelectionRange(5, 5);
    driver.refresh();
    expect(driver.isOpen()).toBe(true);

    app.unmount();

    expect(popupEl()).toBeNull();
    // refresh is a no-op after disposal — the popup stays closed.
    driver.refresh();
    expect(popupEl()).toBeNull();
  });
});
