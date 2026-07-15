// @vitest-environment happy-dom
//
// Canvas display: Button and Menu blocks render a merge-tag-enabled text field
// directly as a string, so (unlike the rich-text blocks) they must resolve
// tokens to labels themselves. Regression test for issue #348.

import { describe, expect, it } from "vitest";
import type { MergeTag, MenuItemData } from "@templatical/types";
import {
  createButtonBlock,
  createImageBlock,
  createMenuBlock,
  createVideoBlock,
} from "@templatical/types";
import ButtonBlock from "../src/components/blocks/ButtonBlock.vue";
import MenuBlock from "../src/components/blocks/MenuBlock.vue";
import VideoBlock from "../src/components/blocks/VideoBlock.vue";
import ImageBlock from "../src/components/blocks/ImageBlock.vue";
import { mountEditor } from "./helpers/mount";
import { MERGE_TAGS_KEY } from "../src/keys";

const TAGS: MergeTag[] = [
  { label: "First Name", value: "{{first_name}}" },
  { label: "Shipping Method", value: "{{shipping_method}}" },
];

function menuItem(overrides: Partial<MenuItemData>): MenuItemData {
  return {
    id: "item-1",
    text: "",
    url: "https://example.com",
    openInNewTab: false,
    bold: false,
    underline: false,
    ...overrides,
  };
}

describe("ButtonBlock merge tag label display", () => {
  it("replaces the merge tag token with its label on the canvas", () => {
    const wrapper = mountEditor(ButtonBlock, {
      props: {
        block: createButtonBlock({
          text: "Go to Your Dashboard {{shipping_method}}",
        }),
        viewport: "desktop",
      },
      provides: { [MERGE_TAGS_KEY]: TAGS },
    });

    expect(wrapper.find("a").text()).toBe("Go to Your Dashboard Shipping Method");
  });

  it("keeps an unknown token verbatim (falls back to raw value)", () => {
    const wrapper = mountEditor(ButtonBlock, {
      props: {
        block: createButtonBlock({ text: "Hello {{mystery}}" }),
        viewport: "desktop",
      },
      provides: { [MERGE_TAGS_KEY]: TAGS },
    });

    expect(wrapper.find("a").text()).toBe("Hello {{mystery}}");
  });
});

describe("MenuBlock merge tag label display", () => {
  it("replaces merge tag tokens in item labels with their labels", () => {
    const wrapper = mountEditor(MenuBlock, {
      props: {
        block: createMenuBlock({
          items: [
            menuItem({ id: "a", text: "Hi {{first_name}}" }),
            menuItem({ id: "b", text: "Plain link" }),
          ],
        }),
        viewport: "desktop",
      },
      provides: { [MERGE_TAGS_KEY]: TAGS },
    });

    const links = wrapper.findAll("a");
    expect(links).toHaveLength(2);
    expect(links[0].text()).toBe("Hi First Name");
    expect(links[1].text()).toBe("Plain link");
  });
});

describe("VideoBlock merge tag label display", () => {
  it("shows the label (not the raw token) in the merge-tag URL placeholder", () => {
    const wrapper = mountEditor(VideoBlock, {
      props: {
        block: createVideoBlock({
          url: "{{video_url}}",
          thumbnailUrl: "",
          placeholderUrl: "",
        }),
        viewport: "desktop",
      },
      provides: {
        [MERGE_TAGS_KEY]: [{ label: "Video URL", value: "{{video_url}}" }],
      },
    });

    expect(wrapper.text()).toContain("Video URL");
    expect(wrapper.text()).not.toContain("{{video_url}}");
  });
});

describe("ImageBlock merge tag label display", () => {
  it("shows the label (not the raw token) in the merge-tag src placeholder", () => {
    const wrapper = mountEditor(ImageBlock, {
      props: {
        block: createImageBlock({
          src: "{{account_id}}",
          placeholderUrl: "",
          linkUrl: "",
        }),
        viewport: "desktop",
      },
      provides: {
        [MERGE_TAGS_KEY]: [{ label: "Account ID", value: "{{account_id}}" }],
      },
    });

    expect(wrapper.text()).toContain("Account ID");
    expect(wrapper.text()).not.toContain("{{account_id}}");
  });
});
