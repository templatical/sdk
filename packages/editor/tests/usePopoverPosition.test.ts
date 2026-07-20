// @vitest-environment happy-dom
//
// Arithmetic + fallback for the shared popover-position helper. The real
// transform-under-ancestor scenario needs a layout engine and is covered by
// the consumer e2e (tests/e2e-consumer/transformed-host.spec.ts); here we
// verify the viewport→root-local conversion in isolation.

import { describe, expect, it, type InjectionKey } from "vitest";
import { createApp, defineComponent, h, ref } from "vue";
import { usePopoverPosition } from "../src/composables/usePopoverPosition";
import { POPOVER_ROOT_KEY } from "../src/keys";

function withProvide<T>(
  setup: () => T,
  provides: Record<symbol, unknown> = {},
): T {
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
  return result;
}

// happy-dom has no layout, so stub the root's rect explicitly.
function rootAt(top: number, left: number): HTMLElement {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({
      top,
      left,
      right: left,
      bottom: top,
      width: 0,
      height: 0,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
  return el;
}

describe("usePopoverPosition", () => {
  it("subtracts the popover root's viewport rect to yield root-local coords", () => {
    // Mirrors the measured bug: a swatch at viewport (top 460, left 1030)
    // inside a root offset to (top 133, left 125) must resolve to local
    // (460-133, 1030-125) so the `absolute` popover lands back on the swatch.
    const root = ref<HTMLElement | null>(rootAt(133, 125));
    const { toLocal } = withProvide(() => usePopoverPosition(), {
      [POPOVER_ROOT_KEY]: root,
    });
    expect(toLocal({ top: 460, left: 1030 })).toEqual({ top: 327, left: 905 });
  });

  it("is a no-op when the popover root sits at the viewport origin", () => {
    const root = ref<HTMLElement | null>(rootAt(0, 0));
    const { toLocal } = withProvide(() => usePopoverPosition(), {
      [POPOVER_ROOT_KEY]: root,
    });
    expect(toLocal({ top: 200, left: 80 })).toEqual({ top: 200, left: 80 });
  });

  it("returns the viewport coords unchanged when no popover root is in scope", () => {
    // No POPOVER_ROOT_KEY provided → usePopoverRoot falls back to ref(null).
    const { toLocal } = withProvide(() => usePopoverPosition());
    expect(toLocal({ top: 42, left: 118 })).toEqual({ top: 42, left: 118 });
  });
});
