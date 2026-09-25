// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { useFocusTrap } from "../src/composables/useFocusTrap";

Object.defineProperty(HTMLElement.prototype, "offsetParent", {
  configurable: true,
  get() {
    return this.parentElement ?? document.body;
  },
});

const TrapHost = defineComponent({
  setup() {
    const container = ref<HTMLElement | null>(null);
    const active = ref(true);
    useFocusTrap(container, active);
    function deactivate() {
      active.value = false;
    }
    return { container, deactivate };
  },
  template: `
    <div>
      <button id="outside">out</button>
      <div ref="container" data-testid="trap">
        <button id="first">first</button>
        <input id="mid" />
        <button id="last">last</button>
      </div>
    </div>
  `,
});

const wrappers: VueWrapper[] = [];

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  while (wrappers.length) {
    wrappers.pop()?.unmount();
  }
  vi.unstubAllGlobals();
});

describe("useFocusTrap", () => {
  it("moves initial focus to an input inside the trap", async () => {
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();

    const wrapper = mount(TrapHost, { attachTo: document.body });
    wrappers.push(wrapper);
    await nextTick();

    // `[autofocus], input:not([disabled])` wins over the first button.
    expect(document.activeElement?.id).toBe("mid");
    outside.remove();
  });

  it("wraps Tab from last to first and Shift+Tab from first to last", async () => {
    const wrapper = mount(TrapHost, { attachTo: document.body });
    wrappers.push(wrapper);
    await nextTick();

    const trap = wrapper.get('[data-testid="trap"]');
    document.getElementById("last")!.focus();
    await trap.trigger("keydown", { key: "Tab" });
    expect(document.activeElement?.id).toBe("first");

    document.getElementById("first")!.focus();
    await trap.trigger("keydown", { key: "Tab", shiftKey: true });
    expect(document.activeElement?.id).toBe("last");
  });

  it("ignores non-Tab keys and an empty trap", async () => {
    const Empty = defineComponent({
      setup() {
        const container = ref<HTMLElement | null>(null);
        useFocusTrap(container, ref(true));
        return { container };
      },
      template: `<div ref="container" data-testid="empty"></div>`,
    });
    const empty = mount(Empty, { attachTo: document.body });
    wrappers.push(empty);
    await nextTick();
    await empty.get('[data-testid="empty"]').trigger("keydown", { key: "Tab" });

    const wrapper = mount(TrapHost, { attachTo: document.body });
    wrappers.push(wrapper);
    await nextTick();
    const prevent = vi.fn();
    wrapper.get('[data-testid="trap"]').element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(prevent).not.toHaveBeenCalled();
  });

  it("restores the previously focused element when deactivated", async () => {
    const outside = document.createElement("button");
    outside.id = "prior";
    document.body.appendChild(outside);
    outside.focus();

    const wrapper = mount(TrapHost, { attachTo: document.body });
    wrappers.push(wrapper);
    await nextTick();
    expect(document.activeElement?.id).toBe("mid");

    (wrapper.vm as { deactivate: () => void }).deactivate();
    await nextTick();
    expect(document.activeElement?.id).toBe("prior");
    outside.remove();
  });
});
