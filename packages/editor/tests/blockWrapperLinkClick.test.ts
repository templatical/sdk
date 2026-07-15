// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { h } from "vue";
import { createParagraphBlock } from "@templatical/types";
import BlockWrapper from "../src/components/blocks/BlockWrapper.vue";
import { mountEditor } from "./helpers/mount";

/**
 * Link-click suppression in the non-editing canvas (issue #351).
 *
 * Rich-text blocks (Paragraph/Title) inject their links as raw <a> via
 * `v-html`, so — unlike Button/Menu/Image/Video/SocialIcons, which carry a
 * template-level `@click.prevent` on their anchors — they can't attach a
 * directive to the anchor. A single click on such a link used to trigger
 * native navigation (opening the href in a new tab because of `target=_blank`)
 * instead of selecting the block for editing.
 *
 * `BlockWrapper.handleClick` is the one shared click handler every block
 * routes through, so it's where anchor navigation is suppressed — but only in
 * build mode. Preview mode must leave real links clickable.
 */

function mountWrapper(previewMode: boolean) {
  const block = createParagraphBlock({ content: "<p>Hi</p>" });
  return mountEditor(BlockWrapper, {
    props: {
      block,
      isSelected: false,
      viewport: "desktop",
      previewMode,
    },
    slots: {
      default: () =>
        h("div", { class: "tpl-test-content" }, [
          h(
            "a",
            { href: "https://example.com", class: "tpl-test-link" },
            "link",
          ),
          h("span", { class: "tpl-test-text" }, "plain text"),
        ]),
    },
  });
}

function clickElement(el: Element): MouseEvent {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe("BlockWrapper link-click suppression", () => {
  it("build mode: clicking a link prevents navigation and selects the block", () => {
    const wrapper = mountWrapper(false);
    const event = clickElement(wrapper.find(".tpl-test-link").element);
    expect(event.defaultPrevented).toBe(true);
    expect(wrapper.emitted("select")).toHaveLength(1);
  });

  it("build mode: clicking non-link content selects without preventing default", () => {
    const wrapper = mountWrapper(false);
    const event = clickElement(wrapper.find(".tpl-test-text").element);
    expect(event.defaultPrevented).toBe(false);
    expect(wrapper.emitted("select")).toHaveLength(1);
  });

  it("preview mode: clicking a link is left alone (navigates) and does not select", () => {
    const wrapper = mountWrapper(true);
    const event = clickElement(wrapper.find(".tpl-test-link").element);
    expect(event.defaultPrevented).toBe(false);
    expect(wrapper.emitted("select")).toBeUndefined();
  });
});
