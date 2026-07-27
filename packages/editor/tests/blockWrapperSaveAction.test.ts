// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { computed, h, ref } from "vue";
import { createTitleBlock } from "@templatical/types";
import BlockWrapper from "../src/components/blocks/BlockWrapper.vue";
import { mountEditor } from "./helpers/mount";
import { CAPABILITIES_KEY } from "../src/keys";

/**
 * Visibility and behaviour of the "save as block" action, and the picked state.
 *
 * Regressions guarded here:
 *
 * 1. The action rendered on section children. The save flow only ever handles
 *    top-level blocks, and insertion is top-level-only, so a nested block could
 *    be saved but never re-inserted where it came from.
 * 2. The action rendered whenever the capability was merely *present*. Cloud
 *    provides capabilities before its plan config resolves, so on a plan without
 *    the entitlement the button appeared and did nothing.
 * 3. The whole action bar stayed visible during a pick session, which is a
 *    different mode — N bars across the picked blocks would be noise.
 */

function makeCapability(opts: {
  isAvailable?: boolean;
  isPicking?: boolean;
  pickedIds?: string[];
  startPicking?: ReturnType<typeof vi.fn>;
}) {
  const picked = new Set(opts.pickedIds ?? []);
  return {
    savedBlocks: {
      startPicking: opts.startPicking ?? vi.fn(),
      togglePick: vi.fn(),
      isPicked: (id: string) => picked.has(id),
      isPicking: computed(() => opts.isPicking ?? false),
      confirmPicking: vi.fn(),
      cancelPicking: vi.fn(),
      openBrowser: vi.fn(),
      count: computed(() => 0),
      isAvailable: computed(() => opts.isAvailable ?? true),
    },
  };
}

function mountWrapper(opts: {
  nested?: boolean;
  picked?: boolean;
  isSelected?: boolean;
  isAvailable?: boolean;
  isPicking?: boolean;
  withCapability?: boolean;
  startPicking?: ReturnType<typeof vi.fn>;
}) {
  return mountEditor(BlockWrapper, {
    props: {
      block: createTitleBlock({ content: "<p>Hi</p>", level: 2 }),
      isSelected: opts.isSelected ?? true,
      nested: opts.nested ?? false,
      picked: opts.picked ?? false,
    },
    slots: { default: () => h("div", { class: "tpl-test-child" }, "child") },
    provides: {
      [CAPABILITIES_KEY]:
        opts.withCapability === false ? {} : makeCapability(opts),
    },
  } as never);
}

/** The bookmark carries the `blockActions.saveAsBlock` label (stubbed to its key path). */
function saveButtons(wrapper: ReturnType<typeof mountWrapper>) {
  return wrapper.findAll('button[aria-label="blockActions.saveAsBlock"]');
}

describe("BlockWrapper save-as-block action", () => {
  it("renders for a selected top-level block when the feature is available", () => {
    expect(saveButtons(mountWrapper({}))).toHaveLength(1);
  });

  it("does NOT render for a section child", () => {
    expect(saveButtons(mountWrapper({ nested: true }))).toHaveLength(0);
  });

  it("does NOT render when the feature is unavailable", () => {
    expect(saveButtons(mountWrapper({ isAvailable: false }))).toHaveLength(0);
  });

  it("does NOT render when no saved-blocks capability is provided", () => {
    expect(saveButtons(mountWrapper({ withCapability: false }))).toHaveLength(0);
  });

  it("still renders the other block actions for a section child", () => {
    const wrapper = mountWrapper({ nested: true });

    // Only the save action is withheld — this proves the bar itself rendered and
    // the gate is targeted rather than hiding everything.
    expect(
      wrapper.findAll('button[aria-label="blockActions.duplicate"]'),
    ).toHaveLength(1);
    expect(
      wrapper.findAll('button[aria-label="blockActions.delete"]'),
    ).toHaveLength(1);
  });

  it("starts a pick session with the block id when clicked", async () => {
    const startPicking = vi.fn();
    const block = createTitleBlock({ content: "<p>Hi</p>", level: 2 });
    const wrapper = mountEditor(BlockWrapper, {
      props: { block, isSelected: true, nested: false, picked: false },
      slots: { default: () => h("div", "child") },
      provides: { [CAPABILITIES_KEY]: makeCapability({ startPicking }) },
    } as never);

    await wrapper
      .get('button[aria-label="blockActions.saveAsBlock"]')
      .trigger("click");

    expect(startPicking).toHaveBeenCalledWith(block.id);
  });
});

describe("BlockWrapper during a pick session", () => {
  it("hides the whole action bar while a session runs", () => {
    const wrapper = mountWrapper({ isPicking: true, isSelected: true });

    expect(wrapper.findAll(".tpl-block-actions")).toHaveLength(0);
    // Positive control: the same mount without a session does show the bar.
    expect(
      mountWrapper({ isPicking: false, isSelected: true }).findAll(
        ".tpl-block-actions",
      ),
    ).toHaveLength(1);
  });

  it("marks a picked block via class and data attribute", () => {
    const wrapper = mountWrapper({ picked: true, isSelected: false });
    const block = wrapper.get(".tpl-block");

    expect(block.classes()).toContain("tpl-block--picked");
    // Semantic hook (mirrors data-block-id/type) so tests and consumers don't
    // depend on styling classes.
    expect(block.attributes("data-tpl-picked")).toBe("true");
  });

  it("carries neither the class nor the attribute when not picked", () => {
    const wrapper = mountWrapper({ picked: false, isSelected: false });
    const block = wrapper.get(".tpl-block");

    expect(block.classes()).not.toContain("tpl-block--picked");
    // Absent, not "false".
    expect(block.attributes("data-tpl-picked")).toBeUndefined();
  });

  it("a picked block is not also styled idle", () => {
    const wrapper = mountWrapper({ picked: true, isSelected: false });

    // Idle draws the faint dashed outline; picked owns the visual instead.
    expect(wrapper.get(".tpl-block").classes()).not.toContain(
      "tpl-block--idle",
    );
  });
});
