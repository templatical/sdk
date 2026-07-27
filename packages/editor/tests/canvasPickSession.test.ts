// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { computed } from "vue";
import { useEditor } from "@templatical/core";
import {
  createDefaultTemplateContent,
  createTitleBlock,
} from "@templatical/types";
import Canvas from "../src/components/Canvas.vue";
import { mountEditor } from "./helpers/mount";
import { CAPABILITIES_KEY, EDITOR_KEY } from "../src/keys";

/**
 * Canvas click routing during a saved-blocks pick session.
 *
 * The whole point of the session being *transient* is that it never touches
 * `EditorState.selectedBlockId` — that's what keeps it out of core state, out of
 * Cloud's single-block selection broadcast, and out of block locking. These
 * tests pin that: while picking, a block click toggles the pick and selection is
 * left alone; outside a session the click selects as before.
 */

function setup(opts: {
  isPicking: boolean;
  /** Lock the first block, as a collaborator would. */
  lockFirstBlock?: boolean;
  previewMode?: boolean;
}) {
  const first = createTitleBlock({ content: "<p>One</p>", level: 2 });
  const second = createTitleBlock({ content: "<p>Two</p>", level: 2 });
  const content = createDefaultTemplateContent();
  content.blocks = [first, second];

  const editor = useEditor({ content });
  const togglePick = vi.fn();

  const lockedBlocks = new Map(
    opts.lockFirstBlock
      ? [
          [
            first.id,
            {
              id: "peer",
              name: "Peer",
              color: "#f00",
              selectedBlockId: first.id,
            },
          ] as const,
        ]
      : [],
  );

  const wrapper = mountEditor(Canvas, {
    props: {
      viewport: "desktop",
      content: editor.content.value,
      selectedBlockId: editor.state.selectedBlockId,
      darkMode: false,
      previewMode: opts.previewMode ?? false,
      lockedBlocks,
    },
    provides: {
      [EDITOR_KEY]: editor,
      [CAPABILITIES_KEY]: {
        savedBlocks: {
          startPicking: vi.fn(),
          togglePick,
          isPicked: () => false,
          isPicking: computed(() => opts.isPicking),
          confirmPicking: vi.fn(),
          cancelPicking: vi.fn(),
          openBrowser: vi.fn(),
          count: computed(() => 0),
          isAvailable: computed(() => true),
        },
      },
    },
  } as never);

  return { wrapper, editor, togglePick, first, second };
}

function clickBlock(
  wrapper: ReturnType<typeof setup>["wrapper"],
  blockId: string,
) {
  return wrapper.get(`[data-block-id="${blockId}"]`).trigger("click");
}

describe("Canvas pick session routing", () => {
  it("outside a session, a click selects the block", async () => {
    const { wrapper, first } = setup({ isPicking: false });

    await clickBlock(wrapper, first.id);

    const emitted = wrapper.emitted("select-block");
    expect(emitted).toHaveLength(1);
    expect(emitted![0][0]).toBe(first.id);
  });

  it("while picking, a click toggles the pick instead of selecting", async () => {
    const { wrapper, togglePick, first } = setup({ isPicking: true });

    await clickBlock(wrapper, first.id);

    expect(togglePick).toHaveBeenCalledWith(first.id);
    // Selection is deliberately untouched — the session is transient.
    expect(wrapper.emitted("select-block")).toBeUndefined();
  });

  it("while picking, each click targets its own block", async () => {
    const { wrapper, togglePick, first, second } = setup({ isPicking: true });

    await clickBlock(wrapper, first.id);
    await clickBlock(wrapper, second.id);

    expect(togglePick.mock.calls.map((c) => c[0])).toEqual([
      first.id,
      second.id,
    ]);
  });

  it("a collaborator-locked block can be neither picked nor selected", async () => {
    const { wrapper, togglePick, first } = setup({
      isPicking: true,
      lockFirstBlock: true,
    });

    await clickBlock(wrapper, first.id);

    expect(togglePick).not.toHaveBeenCalled();
    expect(wrapper.emitted("select-block")).toBeUndefined();
  });

  it("preview mode suppresses picking entirely", async () => {
    const { wrapper, togglePick, first } = setup({
      isPicking: true,
      previewMode: true,
    });

    await clickBlock(wrapper, first.id);

    expect(togglePick).not.toHaveBeenCalled();
    expect(wrapper.emitted("select-block")).toBeUndefined();
  });

  it("a background click does not deselect while picking", async () => {
    const { wrapper } = setup({ isPicking: true });

    // `.tpl-canvas` owns the deselect-on-background-click behaviour.
    await wrapper.get(".tpl-canvas").trigger("click");

    expect(wrapper.emitted("select-block")).toBeUndefined();
  });

  it("a background click still deselects outside a session", async () => {
    const { wrapper } = setup({ isPicking: false });

    await wrapper.get(".tpl-canvas").trigger("click");

    const emitted = wrapper.emitted("select-block");
    expect(emitted).toHaveLength(1);
    expect(emitted![0][0]).toBe(null);
  });
});
