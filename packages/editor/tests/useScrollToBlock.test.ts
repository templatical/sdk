// @vitest-environment happy-dom
//
// happy-dom has no layout and no scrolling, so `scrollIntoView` is stubbed per
// element and asserted on. Whether the browser actually moves is covered by
// `apps/playground/e2e/tests/palette-insert-position.spec.ts`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createApp,
  defineComponent,
  h,
  nextTick,
  type InjectionKey,
} from "vue";
import { useScrollToBlock } from "../src/composables/useScrollToBlock";
import { EDITOR_ROOT_KEY } from "../src/keys";

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

/** A block node carrying the attribute the composable queries on. */
function blockNode(blockId: string) {
  const el = document.createElement("div");
  el.setAttribute("data-block-id", blockId);
  const scrollIntoView = vi.fn();
  el.scrollIntoView = scrollIntoView;
  return { el, scrollIntoView };
}

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
  }));
}

beforeEach(() => {
  setReducedMotion(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("useScrollToBlock", () => {
  it("scrolls the matching block into view", async () => {
    const { el, scrollIntoView } = blockNode("block-a");
    document.body.appendChild(el);

    const scrollToBlock = withProvide(() => useScrollToBlock());
    scrollToBlock("block-a");
    await nextTick();

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("waits a tick so a block inserted in the same call has rendered", async () => {
    // The node does not exist when `scrollToBlock` is called — this is the
    // real sequence for a palette insert, where Vue has not yet re-rendered.
    const scrollToBlock = withProvide(() => useScrollToBlock());
    scrollToBlock("late");

    const { el, scrollIntoView } = blockNode("late");
    document.body.appendChild(el);
    expect(scrollIntoView).not.toHaveBeenCalled();

    await nextTick();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("uses block: nearest so an already-visible block does not jump", async () => {
    const { el, scrollIntoView } = blockNode("block-a");
    document.body.appendChild(el);

    const scrollToBlock = withProvide(() => useScrollToBlock());
    scrollToBlock("block-a");
    await nextTick();

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      behavior: "smooth",
    });
  });

  it("scrolls instantly when the user prefers reduced motion", async () => {
    setReducedMotion(true);
    const { el, scrollIntoView } = blockNode("block-a");
    document.body.appendChild(el);

    const scrollToBlock = withProvide(() => useScrollToBlock());
    scrollToBlock("block-a");
    await nextTick();

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      behavior: "auto",
    });
  });

  it("is a no-op when no block matches the id", async () => {
    const { scrollIntoView } = blockNode("block-a");
    // deliberately not appended

    const scrollToBlock = withProvide(() => useScrollToBlock());
    scrollToBlock("block-a");
    await nextTick();

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("queries the injected editor root, not the document", async () => {
    // In shadow-DOM mode the blocks live in the shadow tree, where a
    // document-level query finds nothing. Only the shadow node is populated
    // here, so a document query would scroll nothing.
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const { el, scrollIntoView } = blockNode("block-a");
    shadow.appendChild(el);

    const scrollToBlock = withProvide(() => useScrollToBlock(), {
      [EDITOR_ROOT_KEY]: shadow,
    });
    scrollToBlock("block-a");
    await nextTick();

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("ignores a block that only exists outside the injected root", async () => {
    // Negative control for the case above: without it, that test would pass
    // even if the composable queried `document` and happened to find a match.
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const { el, scrollIntoView } = blockNode("block-a");
    document.body.appendChild(el);

    const scrollToBlock = withProvide(() => useScrollToBlock(), {
      [EDITOR_ROOT_KEY]: shadow,
    });
    scrollToBlock("block-a");
    await nextTick();

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("survives a missing matchMedia", async () => {
    // `matchMedia` is absent in some embedding contexts and older jsdom-style
    // environments; a throw here would break the insert itself.
    vi.stubGlobal("matchMedia", undefined);
    const { el, scrollIntoView } = blockNode("block-a");
    document.body.appendChild(el);

    const scrollToBlock = withProvide(() => useScrollToBlock());
    scrollToBlock("block-a");
    await nextTick();

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      behavior: "smooth",
    });
  });
});
