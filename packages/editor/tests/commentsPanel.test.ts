// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";

vi.mock("../src/components/CommentsSidebar.vue", () => ({
  __esModule: true,
  default: defineComponent({
    name: "CommentsSidebarStub",
    props: { visible: Boolean, feature: Object },
    emits: ["close"],
    setup(props, { emit }) {
      return () =>
        h("div", {
          "data-testid": "comments-sidebar",
          "data-visible": String(props.visible),
          onClick: () => emit("close"),
        });
    },
  }),
}));

import CommentsPanel from "../src/components/CommentsPanel.vue";
import type { UseCommentsFeatureReturn } from "../src/composables/useCommentsFeature";

/**
 * The slide wraps the `v-if` that mounts the sidebar: inside the sidebar it
 * would mount already visible (no enter) and unmount with it (no leave).
 */
describe("CommentsPanel", () => {
  function setup() {
    const isOpen = ref(false);
    const close = vi.fn(() => {
      isOpen.value = false;
    });
    const feature = { isOpen, close } as unknown as UseCommentsFeatureReturn;
    const wrapper = mount(CommentsPanel, {
      attachTo: document.body,
      props: { feature },
      global: { stubs: { transition: false } },
    });
    return { wrapper, isOpen, close };
  }

  it("mounts the sidebar only while open, with the shared panel slide", async () => {
    const { wrapper, isOpen } = setup();
    expect(wrapper.find('[data-testid="comments-sidebar"]').exists()).toBe(
      false,
    );
    // Vue drops the enter class once the (absent, in happy-dom) animation
    // ends, so read it as the sidebar is inserted.
    const insertedWith: string[][] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (node instanceof HTMLElement)
            insertedWith.push([...node.classList]);
    });
    observer.observe(wrapper.element.parentElement!, {
      childList: true,
      subtree: true,
    });

    isOpen.value = true;
    await flushPromises();
    await vi.dynamicImportSettled();
    await flushPromises();

    const sidebar = wrapper.get('[data-testid="comments-sidebar"]');
    expect(sidebar.attributes("data-visible")).toBe("true");
    observer.disconnect();
    expect(insertedWith).toContainEqual(
      expect.arrayContaining(["tpl-panel-enter-active"]),
    );
  });

  it("closes the feature when the sidebar asks to close", async () => {
    const { wrapper, isOpen, close } = setup();
    isOpen.value = true;
    await flushPromises();
    await vi.dynamicImportSettled();
    await flushPromises();

    await wrapper.get('[data-testid="comments-sidebar"]').trigger("click");

    expect(close).toHaveBeenCalledTimes(1);
    expect(isOpen.value).toBe(false);
  });
});
