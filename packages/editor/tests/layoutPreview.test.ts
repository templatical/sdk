// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  createSlotBlock,
  createWrapperBlock,
  type TemplateContent,
} from "@templatical/types";
import Editor from "../src/Editor.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";

/**
 * Preview compose of `config.layout`. Public `getContent()` stays unshelled —
 * these cases lock the editing-vs-preview DOM split rather than calling it.
 */

const AUTHOR = "AUTHOR-BODY";
const VIEW_IN_BROWSER = "VIEW-IN-BROWSER";
const IMPRESSUM = "IMPRESSUM";

function authorContent(): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = [createParagraphBlock({ content: `<p>${AUTHOR}</p>` })];
  return content;
}

function siblingLayout(): TemplateContent {
  const layout = createDefaultTemplateContent();
  layout.blocks = [
    createParagraphBlock({ content: `<p>${VIEW_IN_BROWSER}</p>` }),
    createSlotBlock(),
    createParagraphBlock({ content: `<p>${IMPRESSUM}</p>` }),
  ];
  return layout;
}

function cardLayout(): TemplateContent {
  const layout = createDefaultTemplateContent();
  layout.blocks = [
    createParagraphBlock({ content: `<p>${VIEW_IN_BROWSER}</p>` }),
    createWrapperBlock({ children: [createSlotBlock()] }),
    createParagraphBlock({ content: `<p>${IMPRESSUM}</p>` }),
  ];
  return layout;
}

async function mountEditor(layout: TemplateContent): Promise<VueWrapper> {
  const translations = await loadTranslations("en");
  return mount(Editor, {
    props: {
      config: {
        container: document.createElement("div"),
        content: authorContent(),
        layout,
      },
      translations,
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
}

async function enterPreview(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('[aria-label="Preview Mode"]').trigger("click");
  await nextTick();
}

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("layout preview compose", () => {
  it("sibling layout does not paint chrome on the editing canvas", async () => {
    wrapper = await mountEditor(siblingLayout());
    const html = wrapper.html();

    expect(html).toContain(AUTHOR);
    expect(html).not.toContain(VIEW_IN_BROWSER);
    expect(html).not.toContain(IMPRESSUM);
  });

  it("sibling layout paints chrome after entering preview", async () => {
    wrapper = await mountEditor(siblingLayout());
    await enterPreview(wrapper);
    const html = wrapper.html();

    expect(html).toContain(AUTHOR);
    expect(html).toContain(VIEW_IN_BROWSER);
    expect(html).toContain(IMPRESSUM);
  });

  it("card layout wraps author copy inside layout-wrapper in preview", async () => {
    wrapper = await mountEditor(cardLayout());
    await enterPreview(wrapper);

    expect(wrapper.get('[data-testid="layout-wrapper"]').text()).toContain(
      AUTHOR,
    );
  });

  it("layout-only preview does not report a resolve failure", async () => {
    wrapper = await mountEditor(siblingLayout());
    await enterPreview(wrapper);

    expect(
      wrapper.find('[data-testid="preview-resolution-failed"]').exists(),
    ).toBe(false);
  });
});
