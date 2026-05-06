import "./dom-stubs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ref, nextTick } from "vue";

const mockCleanup = vi.fn();
vi.mock("@vueuse/core", () => ({
  useEventListener: vi.fn(() => mockCleanup),
}));

import { useEventListener } from "@vueuse/core";
import { useFocusTrap } from "../src/composables/useFocusTrap";

function createFocusableElement(tag = "button") {
  return {
    tagName: tag.toUpperCase(),
    focus: vi.fn(),
    offsetParent: {},
  } as any;
}

function createMockContainer(focusableElements: any[] = []) {
  return {
    nodeType: 1,
    tagName: "DIV",
    querySelectorAll: vi.fn(() => focusableElements),
    querySelector: vi.fn(() => focusableElements[0] || null),
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    appendChild: (c: any) => c,
    removeChild: (c: any) => c,
    insertBefore: (c: any) => c,
    contains: () => false,
    style: {},
    parentNode: null,
    nextSibling: null,
    childNodes: [],
    firstChild: null,
    ownerDocument: globalThis.document,
  } as any;
}

async function flushWatcher() {
  await nextTick();
  await nextTick();
}

describe("useFocusTrap", () => {
  beforeEach(() => {
    vi.mocked(useEventListener).mockClear();
    mockCleanup.mockClear();
    vi.stubGlobal("requestAnimationFrame", (cb: Function) => {
      cb();
      return 0;
    });
  });

  it("does not error when container is null and active is true", async () => {
    const active = ref(true);
    const containerRef = ref<HTMLElement | null>(null);

    useFocusTrap(containerRef, active);
    await flushWatcher();

    expect(vi.mocked(useEventListener).mock.calls.length).toBe(0);
  });

  it("activates when both active and container are set", async () => {
    const btn = createFocusableElement("button");
    const container = createMockContainer([btn]);
    const active = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    useFocusTrap(containerRef, active);

    active.value = true;
    containerRef.value = container;
    await flushWatcher();

    expect(vi.mocked(useEventListener).mock.calls.length).toBe(1);
    expect(vi.mocked(useEventListener).mock.calls[0][1]).toBe("keydown");
  });

  it("deactivates when active goes false and calls cleanup", async () => {
    const btn = createFocusableElement("button");
    const container = createMockContainer([btn]);
    const active = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    useFocusTrap(containerRef, active);

    active.value = true;
    containerRef.value = container;
    await flushWatcher();

    expect(vi.mocked(useEventListener).mock.calls.length).toBe(1);

    active.value = false;
    await flushWatcher();

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it("focuses the first focusable element on activate", async () => {
    const btn1 = createFocusableElement("button");
    const btn2 = createFocusableElement("button");
    const container = createMockContainer([btn1, btn2]);
    // querySelector returns null so it falls back to first focusable
    container.querySelector = vi.fn(() => null);

    const active = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    useFocusTrap(containerRef, active);

    active.value = true;
    containerRef.value = container;
    await flushWatcher();

    expect(btn1.focus).toHaveBeenCalledTimes(1);
    expect(btn2.focus).not.toHaveBeenCalled();
  });

  it("prefers autofocus/input element over first focusable", async () => {
    const btn = createFocusableElement("button");
    const input = createFocusableElement("input");
    const container = createMockContainer([btn, input]);
    container.querySelector = vi.fn(() => input);

    const active = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    useFocusTrap(containerRef, active);

    active.value = true;
    containerRef.value = container;
    await flushWatcher();

    expect(input.focus).toHaveBeenCalledTimes(1);
    expect(btn.focus).not.toHaveBeenCalled();
  });

  it("does not focus anything when container has no focusable elements", async () => {
    const container = createMockContainer([]);
    const active = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    useFocusTrap(containerRef, active);

    active.value = true;
    containerRef.value = container;
    await flushWatcher();

    // useEventListener is still called (keydown handler registered)
    expect(vi.mocked(useEventListener).mock.calls.length).toBe(1);
  });

  it("wraps focus from last to first on Tab", async () => {
    const first = createFocusableElement("button");
    const last = createFocusableElement("button");
    const container = createMockContainer([first, last]);
    container.querySelector = vi.fn(() => null);

    const active = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    useFocusTrap(containerRef, active);

    active.value = true;
    containerRef.value = container;
    await flushWatcher();

    const handler = vi.mocked(useEventListener).mock.calls[0][2] as (
      e: KeyboardEvent,
    ) => void;

    const preventDefault = vi.fn();
    // Simulate activeElement being the last element
    Object.defineProperty(document, "activeElement", {
      value: last,
      writable: true,
      configurable: true,
    });

    handler({
      key: "Tab",
      shiftKey: false,
      preventDefault,
    } as any);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(first.focus).toHaveBeenCalledTimes(2); // once on activate, once on wrap
  });

  it("wraps focus from first to last on Shift+Tab", async () => {
    const first = createFocusableElement("button");
    const last = createFocusableElement("button");
    const container = createMockContainer([first, last]);
    container.querySelector = vi.fn(() => null);

    const active = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    useFocusTrap(containerRef, active);

    active.value = true;
    containerRef.value = container;
    await flushWatcher();

    const handler = vi.mocked(useEventListener).mock.calls[0][2] as (
      e: KeyboardEvent,
    ) => void;

    const preventDefault = vi.fn();
    Object.defineProperty(document, "activeElement", {
      value: first,
      writable: true,
      configurable: true,
    });

    handler({
      key: "Tab",
      shiftKey: true,
      preventDefault,
    } as any);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(last.focus).toHaveBeenCalledTimes(1);
  });

  it("does not preventDefault when Tab pressed and activeElement is in the middle", async () => {
    const first = createFocusableElement("button");
    const middle = createFocusableElement("button");
    const last = createFocusableElement("button");
    const container = createMockContainer([first, middle, last]);
    container.querySelector = vi.fn(() => null);

    const active = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    useFocusTrap(containerRef, active);

    active.value = true;
    containerRef.value = container;
    await flushWatcher();

    const handler = vi.mocked(useEventListener).mock.calls[0][2] as (
      e: KeyboardEvent,
    ) => void;

    const preventDefault = vi.fn();
    Object.defineProperty(document, "activeElement", {
      value: middle,
      writable: true,
      configurable: true,
    });

    handler({
      key: "Tab",
      shiftKey: false,
      preventDefault,
    } as any);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(first.focus).toHaveBeenCalledTimes(1); // only from activate
    expect(last.focus).not.toHaveBeenCalled();
  });

  it("ignores non-Tab key events", async () => {
    const first = createFocusableElement("button");
    const last = createFocusableElement("button");
    const container = createMockContainer([first, last]);
    container.querySelector = vi.fn(() => null);

    const active = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    useFocusTrap(containerRef, active);

    active.value = true;
    containerRef.value = container;
    await flushWatcher();

    const handler = vi.mocked(useEventListener).mock.calls[0][2] as (
      e: KeyboardEvent,
    ) => void;

    const preventDefault = vi.fn();
    handler({
      key: "Enter",
      shiftKey: false,
      preventDefault,
    } as any);

    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("restores focus to previously focused element on deactivate", async () => {
    const previousElement = createFocusableElement("input");
    Object.defineProperty(document, "activeElement", {
      value: previousElement,
      writable: true,
      configurable: true,
    });

    const btn = createFocusableElement("button");
    const container = createMockContainer([btn]);
    const active = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    useFocusTrap(containerRef, active);

    active.value = true;
    containerRef.value = container;
    await flushWatcher();

    active.value = false;
    await flushWatcher();

    expect(previousElement.focus).toHaveBeenCalledTimes(1);
  });

  it("does not error on deactivate when no element was previously focused", async () => {
    Object.defineProperty(document, "activeElement", {
      value: null,
      writable: true,
      configurable: true,
    });

    const btn = createFocusableElement("button");
    const container = createMockContainer([btn]);
    const active = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    useFocusTrap(containerRef, active);

    active.value = true;
    containerRef.value = container;
    await flushWatcher();

    active.value = false;
    await flushWatcher();

    // No error thrown, cleanup still called
    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it("cancels pending rAF when deactivated before frame fires", async () => {
    const rafCallbacks: Array<() => void> = [];
    let rafIdSeq = 0;
    const cancelled: number[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
      rafCallbacks.push(cb);
      return ++rafIdSeq;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      cancelled.push(id);
    });

    const btn = createFocusableElement("button");
    const container = createMockContainer([btn]);
    const active = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    useFocusTrap(containerRef, active);

    active.value = true;
    containerRef.value = container;
    await flushWatcher();

    expect(rafIdSeq).toBe(1);
    expect(btn.focus).not.toHaveBeenCalled();

    active.value = false;
    await flushWatcher();

    expect(cancelled).toContain(1);
  });

  it("cleans up previous listener when container changes while active", async () => {
    const btn1 = createFocusableElement("button");
    const btn2 = createFocusableElement("button");
    const c1 = createMockContainer([btn1]);
    const c2 = createMockContainer([btn2]);
    const active = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    useFocusTrap(containerRef, active);

    active.value = true;
    containerRef.value = c1;
    await flushWatcher();
    expect(vi.mocked(useEventListener).mock.calls.length).toBe(1);
    expect(mockCleanup).toHaveBeenCalledTimes(0);

    containerRef.value = c2;
    await flushWatcher();

    expect(mockCleanup).toHaveBeenCalledTimes(1);
    expect(vi.mocked(useEventListener).mock.calls.length).toBe(2);
  });

  it("preserves the original previously-focused element across re-entry (container swap)", async () => {
    // Element that had focus BEFORE the trap activated. After all activations
    // tear down, focus must return here — not to whatever was focused inside
    // the first trap container when the second trap container took over.
    const externalElement = createFocusableElement("input");
    Object.defineProperty(document, "activeElement", {
      value: externalElement,
      writable: true,
      configurable: true,
    });

    const c1Btn = createFocusableElement("button");
    const c2Btn = createFocusableElement("button");
    const c1 = createMockContainer([c1Btn]);
    const c2 = createMockContainer([c2Btn]);
    c1.querySelector = vi.fn(() => null);
    c2.querySelector = vi.fn(() => null);

    const active = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    useFocusTrap(containerRef, active);

    active.value = true;
    containerRef.value = c1;
    await flushWatcher();

    // Simulate user tabbing inside the first trap → activeElement is c1Btn now.
    Object.defineProperty(document, "activeElement", {
      value: c1Btn,
      writable: true,
      configurable: true,
    });

    // Container swaps while still active (re-entry). The trap should NOT
    // overwrite previouslyFocused with c1Btn — the original (externalElement)
    // must be preserved.
    containerRef.value = c2;
    await flushWatcher();

    active.value = false;
    await flushWatcher();

    // Final deactivate must restore focus to the originally-focused element,
    // not to whatever was focused inside the trap when the container swapped.
    expect(externalElement.focus).toHaveBeenCalled();
  });

  it("registers onScopeDispose cleanup when used in effectScope", async () => {
    const { effectScope, onScopeDispose } = await import("vue");
    const container = createMockContainer([createFocusableElement("button")]);
    const active = ref(false);
    const containerRef = ref<HTMLElement | null>(container);

    const scope = effectScope();
    scope.run(() => {
      useFocusTrap(containerRef, active);
    });

    scope.stop();
    // After scope disposal, activating has no effect (watchers are torn down).
    const focusCountBefore = (document.activeElement as HTMLElement | null)
      ?.tagName;
    active.value = true;
    expect((document.activeElement as HTMLElement | null)?.tagName).toBe(
      focusCountBefore,
    );
  });
});
