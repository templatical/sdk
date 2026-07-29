// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, markRaw } from "vue";
import { useEditor } from "@templatical/core";
import {
  createCountdownBlock,
  createTitleBlock,
  createDefaultTemplateContent,
} from "@templatical/types";
import type { Block } from "@templatical/types";
import Canvas from "../src/components/Canvas.vue";
import { mountEditor } from "./helpers/mount";
import { BLOCK_REGISTRY_KEY, EDITOR_KEY } from "../src/keys";
import type { UseBlockRegistryReturn } from "../src/composables/useBlockRegistry";

/**
 * Canvas must render `countdown` blocks via the block registry.
 *
 * `countdown` is the one Cloud-only block, so `useEditorCore` registers it as a
 * lazy `defineAsyncComponent` and Canvas's static `blockComponentMap`
 * deliberately has no entry for it. That makes the registry the *only* source —
 * so if Canvas ever stopped consulting it, countdown blocks would silently
 * vanish from the canvas with nothing else to fall back on.
 *
 * The stub stands in for the real async component on purpose: what's under test
 * is Canvas's routing, not the countdown UI (covered by `countdownBlock.test.ts`).
 */

const StubCountdown = markRaw(
  defineComponent({
    name: "StubCountdown",
    props: { block: { type: Object, required: true } },
    setup: () => () => h("div", { class: "stub-countdown" }, "countdown here"),
  }),
);

function mountCanvasWith(blocks: Block[], registry: UseBlockRegistryReturn) {
  const content = createDefaultTemplateContent();
  content.blocks = blocks;
  const editor = useEditor({ content });

  return mountEditor(Canvas, {
    props: {
      viewport: "desktop",
      content: editor.content.value,
      selectedBlockId: null,
      darkMode: false,
      previewMode: false,
    },
    provides: {
      [EDITOR_KEY]: editor,
      [BLOCK_REGISTRY_KEY]: registry,
    },
  } as never);
}

/** A registry that resolves only `countdown`, like the real one does for it. */
function countdownOnlyRegistry(component: unknown = StubCountdown) {
  return {
    getComponent: vi.fn((block: Block) =>
      block.type === "countdown" ? component : undefined,
    ),
  } as unknown as UseBlockRegistryReturn;
}

describe("Canvas renders countdown through the registry", () => {
  it("renders the registry's component for a countdown block", () => {
    const countdown = createCountdownBlock();
    const registry = countdownOnlyRegistry();

    const wrapper = mountCanvasWith([countdown], registry);

    expect(wrapper.findAll(".stub-countdown")).toHaveLength(1);
    expect(wrapper.get(".stub-countdown").text()).toBe("countdown here");
    expect(registry.getComponent).toHaveBeenCalled();
  });

  it("still renders non-countdown blocks from the static fallback map", () => {
    // The registry returns undefined for `title`, so this proves removing
    // countdown from the fallback map didn't disturb the fallback path.
    const wrapper = mountCanvasWith(
      [createTitleBlock({ content: "<p>Heading</p>", level: 2 })],
      countdownOnlyRegistry(),
    );

    expect(wrapper.text()).toContain("Heading");
  });

  it("renders both kinds together, each via its own path", () => {
    const wrapper = mountCanvasWith(
      [
        createTitleBlock({ content: "<p>Heading</p>", level: 2 }),
        createCountdownBlock(),
      ],
      countdownOnlyRegistry(),
    );

    expect(wrapper.text()).toContain("Heading");
    expect(wrapper.findAll(".stub-countdown")).toHaveLength(1);
    expect(wrapper.findAll("[data-block-type]")).toHaveLength(2);
  });

  it("renders nothing for countdown when no registry resolves it", () => {
    // Canvas has no static countdown entry, so an unresolved countdown block
    // yields a wrapper with no inner component — the same degradation the three
    // preview surfaces have always had. Asserted so the behaviour is stated
    // rather than discovered.
    const emptyRegistry = {
      getComponent: vi.fn(() => undefined),
    } as unknown as UseBlockRegistryReturn;

    const wrapper = mountCanvasWith([createCountdownBlock()], emptyRegistry);

    expect(wrapper.findAll(".stub-countdown")).toHaveLength(0);
    // The block wrapper itself is still laid out — only its content is missing.
    expect(
      wrapper.findAll('[data-block-type="countdown"]'),
    ).toHaveLength(1);
  });
});
