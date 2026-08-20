// @vitest-environment happy-dom
//
// The fourth content-in path: a template fetched from a `TemplatesProvider`.
// Unlike the three entry-point hooks in `index.ts`, this content never passes
// through the public API — core assigns it to state itself — so the provider is
// wrapped in `Editor.vue` on its way to `useEditor`.

import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  type ParagraphBlock,
  type Template,
  type TemplateContent,
  type TemplatesProvider,
} from "@templatical/types";
import Editor from "../src/Editor.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";

const BARE = "<p>Hi {{first_name}}</p>";
const WRAPPED =
  '<p>Hi <span data-merge-tag="{{first_name}}">First Name</span></p>';

const MERGE_TAGS = {
  tags: [{ label: "First Name", value: "{{first_name}}", sample: "Ada" }],
};

function content(html: string): TemplateContent {
  return {
    ...createDefaultTemplateContent(),
    blocks: [createParagraphBlock({ content: html })],
  };
}

function firstParagraph(c: TemplateContent): string {
  return (c.blocks[0] as ParagraphBlock).content;
}

async function mountEditor(templates: TemplatesProvider) {
  const translations = await loadTranslations("en");
  return mount(Editor, {
    props: {
      config: {
        container: document.createElement("div"),
        content: content("<p>start</p>"),
        mergeTags: MERGE_TAGS,
        templates,
      },
      translations,
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
}

describe("Editor.vue normalizes content arriving from the templates provider", () => {
  it("converts bare tokens in a loaded template", async () => {
    const provider: TemplatesProvider = {
      load: vi.fn(
        async (id: string): Promise<Template> => ({ id, content: content(BARE) }),
      ),
      create: false,
      save: false,
    };
    const wrapper = await mountEditor(provider);

    await (
      wrapper.vm as unknown as { load: (id: string) => Promise<Template> }
    ).load("tpl-1");

    const current = (
      wrapper.vm as unknown as { getContent: () => TemplateContent }
    ).getContent();
    expect(firstParagraph(current)).toBe(WRAPPED);
  });

  it("leaves a loaded token in an href untouched", async () => {
    const href = '<p><a href="{{first_name}}">x</a></p>';
    const provider: TemplatesProvider = {
      load: vi.fn(
        async (id: string): Promise<Template> => ({
          id,
          content: content(href),
        }),
      ),
      create: false,
      save: false,
    };
    const wrapper = await mountEditor(provider);

    await (
      wrapper.vm as unknown as { load: (id: string) => Promise<Template> }
    ).load("tpl-1");

    const current = (
      wrapper.vm as unknown as { getContent: () => TemplateContent }
    ).getContent();
    expect(firstParagraph(current)).toBe(href);
  });

  // Q4 — normalization runs on the way in, so core assigns already-correct
  // content and observes no mutation. A refactor that normalizes *after* the
  // load lands would flip this and silently arm autosave.
  it("does not mark the template dirty", async () => {
    const provider: TemplatesProvider = {
      load: vi.fn(
        async (id: string): Promise<Template> => ({ id, content: content(BARE) }),
      ),
      create: false,
      save: false,
    };
    const wrapper = await mountEditor(provider);

    await (
      wrapper.vm as unknown as { load: (id: string) => Promise<Template> }
    ).load("tpl-1");

    expect(
      (wrapper.vm as unknown as { isDirty: () => boolean }).isDirty(),
    ).toBe(false);
  });
});
