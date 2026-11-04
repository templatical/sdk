// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { computed } from "vue";
import { createTitleBlock } from "@templatical/types";
import TitleBlock from "../src/components/blocks/TitleBlock.vue";
import { mountEditor } from "./helpers/mount";

// Hands TitleBlock unsanitized content, so the only thing between it and
// `v-html` is the component's own sanitizer.
vi.mock("../src/composables/useEditableTextBlock", async (importActual) => {
  const actual =
    await importActual<
      typeof import("../src/composables/useEditableTextBlock")
    >();
  return {
    useEditableTextBlock: (
      ...args: Parameters<typeof actual.useEditableTextBlock>
    ) => ({
      ...actual.useEditableTextBlock(...args),
      resolvedContent: computed(
        () => '<p><img src="x" onerror="alert(1)">ok</p>',
      ),
    }),
  };
});

describe("TitleBlock sanitizes what it renders", () => {
  it("strips event handlers from content that reaches it unsanitized", () => {
    const wrapper = mountEditor(TitleBlock, {
      props: {
        block: createTitleBlock({ content: "<p>ignored</p>", level: 2 }),
        viewport: "desktop" as const,
      },
    });
    const heading = wrapper.find("h2");
    expect(heading.text()).toBe("ok");
    expect(heading.element.querySelector("img")?.getAttribute("onerror")).toBe(
      null,
    );
    expect(heading.element.innerHTML).not.toContain("onerror");
  });
});
