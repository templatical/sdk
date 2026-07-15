// @vitest-environment happy-dom
//
// Canvas display: Button, Menu, Video and Image render a merge-tag-enabled text
// field directly, so (unlike the rich-text blocks) they resolve tokens to
// labels themselves — and mark each resolved tag with `.tpl-merge-tag-label`
// (dotted underline) so it reads as dynamic rather than user-typed text.
// Regression test for issue #348.

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

const TAG_SELECTOR = ".tpl-merge-tag-label";

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
  it("shows the label as a marked tag while surrounding text stays plain", () => {
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
    const tags = wrapper.findAll(TAG_SELECTOR);
    expect(tags).toHaveLength(1);
    expect(tags[0].text()).toBe("Shipping Method");
  });

  it("marks an unknown token too, keeping it verbatim", () => {
    const wrapper = mountEditor(ButtonBlock, {
      props: {
        block: createButtonBlock({ text: "Hello {{mystery}}" }),
        viewport: "desktop",
      },
      provides: { [MERGE_TAGS_KEY]: TAGS },
    });

    expect(wrapper.find("a").text()).toBe("Hello {{mystery}}");
    expect(wrapper.find(TAG_SELECTOR).text()).toBe("{{mystery}}");
  });

  it("renders no tag marker for plain text", () => {
    const wrapper = mountEditor(ButtonBlock, {
      props: {
        block: createButtonBlock({ text: "Just a label" }),
        viewport: "desktop",
      },
      provides: { [MERGE_TAGS_KEY]: TAGS },
    });

    expect(wrapper.find("a").text()).toBe("Just a label");
    expect(wrapper.find(TAG_SELECTOR).exists()).toBe(false);
  });
});

describe("MenuBlock merge tag label display", () => {
  it("marks tags in item labels and leaves plain items unmarked", () => {
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
    expect(links[0].find(TAG_SELECTOR).text()).toBe("First Name");
    expect(links[1].text()).toBe("Plain link");
    expect(links[1].find(TAG_SELECTOR).exists()).toBe(false);
  });
});

describe("VideoBlock merge tag label display", () => {
  it("marks the label in the merge-tag URL placeholder", () => {
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

    expect(wrapper.find(TAG_SELECTOR).text()).toBe("Video URL");
    expect(wrapper.text()).not.toContain("{{video_url}}");
  });
});

describe("ImageBlock merge tag label display", () => {
  it("marks the label in the merge-tag src placeholder", () => {
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

    expect(wrapper.find(TAG_SELECTOR).text()).toBe("Account ID");
    expect(wrapper.text()).not.toContain("{{account_id}}");
  });
});
