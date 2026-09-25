// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import {
  createButtonBlock,
  createCountdownBlock,
  createCustomBlock,
  createDividerBlock,
  createHtmlBlock,
  createImageBlock,
  createMenuBlock,
  createParagraphBlock,
  createSectionBlock,
  createSocialIconsBlock,
  createSpacerBlock,
  createTableBlock,
  createTitleBlock,
  createVideoBlock,
} from "@templatical/types";
import type { Block, CustomBlockDefinition } from "@templatical/types";
import Toolbar from "../src/components/Toolbar.vue";
import { mountEditor } from "./helpers/mount";
import { CUSTOM_BLOCK_DEFINITIONS_KEY, TRANSLATIONS_KEY } from "../src/keys";
import en from "../src/i18n/locales/en";

const toolbarStubs = {
  TitleToolbar: { template: '<div data-testid="tb-title" />' },
  ParagraphToolbar: { template: '<div data-testid="tb-paragraph" />' },
  ImageToolbar: { template: '<div data-testid="tb-image" />' },
  VideoToolbar: { template: '<div data-testid="tb-video" />' },
  ButtonToolbar: { template: '<div data-testid="tb-button" />' },
  DividerToolbar: { template: '<div data-testid="tb-divider" />' },
  SocialToolbar: { template: '<div data-testid="tb-social" />' },
  MenuToolbar: { template: '<div data-testid="tb-menu" />' },
  TableToolbar: { template: '<div data-testid="tb-table" />' },
  SpacerToolbar: { template: '<div data-testid="tb-spacer" />' },
  HtmlToolbar: { template: '<div data-testid="tb-html" />' },
  SectionToolbar: { template: '<div data-testid="tb-section" />' },
  CountdownToolbar: { template: '<div data-testid="tb-countdown" />' },
  CustomBlockToolbar: {
    props: ["block"],
    emits: ["updateFieldValues", "updateDataSourceFetched"],
    template:
      "<button data-testid=\"tb-custom\" @click=\"$emit('updateFieldValues', { title: 'x' }); $emit('updateDataSourceFetched', true)\" />",
  },
  CommonBlockSettings: {
    props: ["block", "isFirstSection"],
    template:
      "<div data-testid=\"tb-common\" :data-first=\"isFirstSection ? 'yes' : 'no'\" />",
  },
};

const hero: CustomBlockDefinition = {
  type: "hero",
  name: "Hero Card",
  template: "<div></div>",
  fields: [{ key: "title", label: "Title", type: "text" }],
};

function mountToolbar(block: Block) {
  return mountEditor(Toolbar, {
    props: { block },
    provides: {
      [TRANSLATIONS_KEY]: en,
      [CUSTOM_BLOCK_DEFINITIONS_KEY]: [hero],
    },
    global: { stubs: toolbarStubs },
  });
}

describe("Toolbar dispatcher", () => {
  it.each([
    ["title", createTitleBlock(), "tb-title"],
    ["paragraph", createParagraphBlock(), "tb-paragraph"],
    ["image", createImageBlock(), "tb-image"],
    ["video", createVideoBlock(), "tb-video"],
    ["button", createButtonBlock(), "tb-button"],
    ["divider", createDividerBlock(), "tb-divider"],
    ["social", createSocialIconsBlock(), "tb-social"],
    ["menu", createMenuBlock(), "tb-menu"],
    ["table", createTableBlock(), "tb-table"],
    ["spacer", createSpacerBlock(), "tb-spacer"],
    ["html", createHtmlBlock(), "tb-html"],
    ["section", createSectionBlock(), "tb-section"],
    ["countdown", createCountdownBlock(), "tb-countdown"],
  ] as const)("routes a %s block to its toolbar", (_type, block, testid) => {
    const wrapper = mountToolbar(block);
    expect(wrapper.get(`[data-testid="${testid}"]`).exists()).toBe(true);
    expect(wrapper.get('[data-testid="tb-common"]').exists()).toBe(true);
  });

  it("marks CommonBlockSettings as first-section only for a paragraph", () => {
    const para = mountToolbar(createParagraphBlock());
    expect(para.get('[data-testid="tb-common"]').attributes("data-first")).toBe(
      "yes",
    );
    const title = mountToolbar(createTitleBlock());
    expect(
      title.get('[data-testid="tb-common"]').attributes("data-first"),
    ).toBe("no");
  });

  it("labels a custom block from the definition, falling back to the type slug", () => {
    const named = mountToolbar(createCustomBlock(hero));
    expect(named.text()).toContain("Hero Card");
    expect(named.get('[data-testid="tb-custom"]').exists()).toBe(true);

    const unknown = mountToolbar(
      createCustomBlock({
        type: "orphan",
        name: "Orphan",
        template: "<div></div>",
        fields: [],
      }),
    );
    expect(unknown.text()).toContain("orphan");
  });

  it("forwards duplicate, delete, and custom field writes", async () => {
    const wrapper = mountToolbar(createCustomBlock(hero));
    await wrapper.get('button[title="Duplicate"]').trigger("click");
    await wrapper.get('button[title="Delete"]').trigger("click");
    await wrapper.get('[data-testid="tb-custom"]').trigger("click");
    expect(wrapper.emitted("duplicate")).toHaveLength(1);
    expect(wrapper.emitted("delete")).toHaveLength(1);
    expect(wrapper.emitted("update")).toEqual([
      [{ fieldValues: { title: "x" } }],
      [{ dataSourceFetched: true }],
    ]);
  });
});
