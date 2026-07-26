// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { computed, h } from "vue";
import { createTitleBlock } from "@templatical/types";
import BlockWrapper from "../src/components/blocks/BlockWrapper.vue";
import { mountEditor } from "./helpers/mount";
import { CAPABILITIES_KEY } from "../src/keys";

/**
 * The "save as block" action's visibility rules.
 *
 * Two regressions live here:
 *
 * 1. The action rendered on section children. The save dialog only lists
 *    top-level blocks, so the pre-selected id matched nothing, Save stayed
 *    enabled, and it persisted an EMPTY saved block. Insertion is
 *    top-level-only anyway, so a nested block could never round-trip back
 *    into its column — the whole section is the savable unit.
 * 2. The action rendered whenever the capability was merely *present*. Cloud
 *    provides capabilities before its plan config resolves, so on a plan
 *    without the entitlement the button appeared and did nothing.
 */

function mountWrapper(opts: {
  nested?: boolean;
  isAvailable?: boolean;
  withCapability?: boolean;
}) {
  const capability =
    opts.withCapability === false
      ? {}
      : {
          savedBlocks: {
            openSaveDialog: vi.fn(),
            openBrowser: vi.fn(),
            count: computed(() => 0),
            isAvailable: computed(() => opts.isAvailable ?? true),
          },
        };

  return mountEditor(BlockWrapper, {
    props: {
      block: createTitleBlock({ content: "<p>Hi</p>", level: 2 }),
      isSelected: true,
      nested: opts.nested ?? false,
    },
    slots: { default: () => h("div", { class: "tpl-test-child" }, "child") },
    provides: { [CAPABILITIES_KEY]: capability },
  } as never);
}

/** The bookmark carries the `blockActions.saveAsBlock` label (stubbed to its key path). */
function saveButtons(wrapper: ReturnType<typeof mountWrapper>) {
  return wrapper.findAll('button[aria-label="blockActions.saveAsBlock"]');
}

describe("BlockWrapper save-as-block action", () => {
  it("renders for a top-level block when the feature is available", () => {
    const wrapper = mountWrapper({});

    expect(saveButtons(wrapper)).toHaveLength(1);
  });

  it("does NOT render for a section child", () => {
    const wrapper = mountWrapper({ nested: true });

    expect(saveButtons(wrapper)).toHaveLength(0);
  });

  it("does NOT render when the feature is unavailable", () => {
    const wrapper = mountWrapper({ isAvailable: false });

    expect(saveButtons(wrapper)).toHaveLength(0);
  });

  it("does NOT render when no saved-blocks capability is provided", () => {
    const wrapper = mountWrapper({ withCapability: false });

    expect(saveButtons(wrapper)).toHaveLength(0);
  });

  it("still renders the other block actions for a section child", () => {
    const wrapper = mountWrapper({ nested: true });

    // Only the save action is withheld — duplicate/delete stay available, so
    // this proves the action bar itself rendered and the gate is targeted.
    expect(
      wrapper.findAll('button[aria-label="blockActions.duplicate"]'),
    ).toHaveLength(1);
    expect(
      wrapper.findAll('button[aria-label="blockActions.delete"]'),
    ).toHaveLength(1);
  });

  it("invokes openSaveDialog with the block id when clicked", async () => {
    const openSaveDialog = vi.fn();
    const block = createTitleBlock({ content: "<p>Hi</p>", level: 2 });
    const wrapper = mountEditor(BlockWrapper, {
      props: { block, isSelected: true, nested: false },
      slots: { default: () => h("div", "child") },
      provides: {
        [CAPABILITIES_KEY]: {
          savedBlocks: {
            openSaveDialog,
            openBrowser: vi.fn(),
            count: computed(() => 0),
            isAvailable: computed(() => true),
          },
        },
      },
    } as never);

    await wrapper
      .get('button[aria-label="blockActions.saveAsBlock"]')
      .trigger("click");

    expect(openSaveDialog).toHaveBeenCalledWith(block.id);
  });
});
