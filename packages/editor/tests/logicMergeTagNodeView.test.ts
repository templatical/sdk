// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import LogicMergeTagNodeView from "../src/extensions/LogicMergeTagNodeView.vue";
import { mountEditor } from "./helpers/mount";
import { TRANSLATIONS_KEY } from "../src/keys";
import en from "../src/i18n/locales/en";

vi.mock("@tiptap/vue-3", () => ({
  NodeViewWrapper: {
    name: "NodeViewWrapper",
    template: "<span><slot /></span>",
  },
}));

function mountChip(
  value: string,
  extras: {
    updateAttributes?: (attrs: Record<string, unknown>) => void;
    deleteNode?: () => void;
  } = {},
) {
  const updateAttributes = extras.updateAttributes ?? vi.fn();
  const deleteNode = extras.deleteNode ?? vi.fn();
  const wrapper = mountEditor(LogicMergeTagNodeView, {
    props: {
      node: { attrs: { value, keyword: "IF" } },
      editor: {},
      getPos: () => 0,
      deleteNode,
      updateAttributes,
    },
    provides: { [TRANSLATIONS_KEY]: en },
  });
  return { wrapper, updateAttributes, deleteNode };
}

describe("LogicMergeTagNodeView", () => {
  it("shows the keyword for a valid liquid tag and the raw token when it is not", () => {
    const valid = mountChip("{% if plan %}");
    expect(valid.wrapper.text()).toContain("IF");
    expect(valid.wrapper.find(".tpl-logic-merge-tag-node").exists()).toBe(true);

    const invalid = mountChip("not-a-tag");
    expect(invalid.wrapper.text()).toContain("not-a-tag");
    expect(invalid.wrapper.find(".tpl-logic-merge-tag-node").exists()).toBe(
      false,
    );
  });

  it("commits a changed value on Enter and records the keyword", async () => {
    const { wrapper, updateAttributes } = mountChip("{% if plan %}");
    await wrapper.get('[role="button"]').trigger("click");
    await nextTick();
    const input = wrapper.get("input");
    await input.setValue("{% endif %}");
    await input.trigger("keydown", { key: "Enter" });
    expect(updateAttributes).toHaveBeenCalledWith({
      value: "{% endif %}",
      keyword: "ENDIF",
    });
  });

  it("does not write on Escape, an empty trim, or an unchanged value", async () => {
    const { wrapper, updateAttributes } = mountChip("{% if plan %}");
    await wrapper.get('[role="button"]').trigger("keydown.enter");
    await nextTick();
    await wrapper.get("input").setValue("  ");
    await wrapper.get("input").trigger("keydown", { key: "Enter" });
    expect(updateAttributes).not.toHaveBeenCalled();

    await wrapper.get('[role="button"]').trigger("click");
    await nextTick();
    await wrapper.get("input").setValue("{% if other %}");
    await wrapper.get("input").trigger("keydown", { key: "Escape" });
    expect(updateAttributes).not.toHaveBeenCalled();
    expect(wrapper.find("input").exists()).toBe(false);

    await wrapper.get('[role="button"]').trigger("click");
    await nextTick();
    await wrapper.get("input").trigger("keydown", { key: "Enter" });
    expect(updateAttributes).not.toHaveBeenCalled();
  });

  it("clears the keyword when the committed value is not a logic tag", async () => {
    const { wrapper, updateAttributes } = mountChip("{% if plan %}");
    await wrapper.get('[role="button"]').trigger("click");
    await nextTick();
    await wrapper.get("input").setValue("plain");
    await wrapper.get("input").trigger("blur");
    expect(updateAttributes).toHaveBeenCalledWith({
      value: "plain",
      keyword: "",
    });
  });

  it("deletes from the chip button", async () => {
    const { wrapper, deleteNode } = mountChip("{% if plan %}");
    await wrapper
      .get(`button[aria-label="${en.mergeTag.deleteMergeTag}"]`)
      .trigger("click");
    expect(deleteNode).toHaveBeenCalled();
  });
});
