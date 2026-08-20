// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import {
  createParagraphBlock,
  createDefaultTemplateContent,
  type MergeTagsConfig,
  type ParagraphBlock,
  type Template,
  type TemplateContent,
  type TemplatesProvider,
} from "@templatical/types";
import { useEditor } from "@templatical/core";
import {
  normalizeContentForConfig,
  withNormalizedTemplateLoads,
} from "../src/utils/normalizeMergeTagMarkup";

const MERGE_TAGS: MergeTagsConfig = {
  tags: [{ label: "First Name", value: "{{first_name}}", sample: "Ada" }],
};

const WRAPPED =
  '<p>Hi <span data-merge-tag="{{first_name}}">First Name</span></p>';

function bareContent(html = "<p>Hi {{first_name}}</p>"): TemplateContent {
  return {
    ...createDefaultTemplateContent(),
    blocks: [createParagraphBlock({ content: html })],
  };
}

function firstParagraph(content: TemplateContent): string {
  return (content.blocks[0] as ParagraphBlock).content;
}

// ---------------------------------------------------------------------------
// Binding the normalizer to the editor's own config shape
// ---------------------------------------------------------------------------

describe("normalizeContentForConfig", () => {
  it("normalizes using the configured tags", () => {
    const result = normalizeContentForConfig(bareContent(), MERGE_TAGS);

    expect(firstParagraph(result)).toBe(WRAPPED);
  });

  // Consistent with typing: `MergeTagNode`'s input and paste rules are
  // registered unconditionally and default to liquid, so a consumer who
  // configured nothing already gets a node the moment a user types `{{x}}`.
  it("normalizes with the liquid default when no merge tags are configured", () => {
    const result = normalizeContentForConfig(bareContent(), undefined);

    expect(firstParagraph(result)).toBe(
      '<p>Hi <span data-merge-tag="{{first_name}}">{{first_name}}</span></p>',
    );
  });

  it("honours a configured syntax preset instead of liquid", () => {
    const result = normalizeContentForConfig(
      bareContent("<p>Hi *|FNAME|*</p>"),
      { syntax: "mailchimp", tags: [{ label: "First", value: "*|FNAME|*" }] },
    );

    expect(firstParagraph(result)).toBe(
      '<p>Hi <span data-merge-tag="*|FNAME|*">First</span></p>',
    );
  });

  it("leaves a token that does not match the configured syntax alone", () => {
    const result = normalizeContentForConfig(bareContent(), {
      syntax: "mailchimp",
      tags: [],
    });

    expect(firstParagraph(result)).toBe("<p>Hi {{first_name}}</p>");
  });

  it("returns the same reference when there is nothing to normalize", () => {
    const content = bareContent("<p>Nothing here</p>");

    expect(normalizeContentForConfig(content, MERGE_TAGS)).toBe(content);
  });
});

// ---------------------------------------------------------------------------
// The templates provider — content arriving from a store
// ---------------------------------------------------------------------------

describe("withNormalizedTemplateLoads", () => {
  function provider(overrides: Partial<TemplatesProvider> = {}) {
    return {
      load: vi.fn(
        async (id: string): Promise<Template> => ({
          id,
          content: bareContent(),
        }),
      ),
      create: vi.fn(),
      save: vi.fn(),
      ...overrides,
    } as TemplatesProvider;
  }

  it("normalizes the content a load returns", async () => {
    const wrapped = withNormalizedTemplateLoads(provider(), MERGE_TAGS);

    const template = await wrapped.load("tpl-1");

    expect(firstParagraph(template.content)).toBe(WRAPPED);
  });

  it("preserves every other field of the loaded template", async () => {
    const base = provider({
      load: async () => ({
        id: "tpl-1",
        name: "Welcome",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z",
        content: bareContent(),
      }),
    });

    const template = await withNormalizedTemplateLoads(base, MERGE_TAGS).load(
      "tpl-1",
    );

    expect(template.name).toBe("Welcome");
    expect(template.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(template.updatedAt).toBe("2026-02-02T00:00:00.000Z");
    expect(template.id).toBe("tpl-1");
  });

  it("returns the provider's own template object when nothing normalized", async () => {
    const template: Template = {
      id: "tpl-1",
      content: bareContent("<p>Nothing here</p>"),
    };
    const wrapped = withNormalizedTemplateLoads(
      provider({ load: async () => template }),
      MERGE_TAGS,
    );

    expect(await wrapped.load("tpl-1")).toBe(template);
  });

  // `create: false` / `save: false` are how a provider disables a mutation.
  // Wrapping must forward the refusal, not turn it into a function.
  it("forwards a disabled create and save untouched", () => {
    const wrapped = withNormalizedTemplateLoads(
      provider({ create: false, save: false }),
      MERGE_TAGS,
    );

    expect(wrapped.create).toBe(false);
    expect(wrapped.save).toBe(false);
  });

  it("leaves save outbound-only, so stored content is whatever the editor holds", async () => {
    const save = vi.fn(
      async (id: string): Promise<Template> => ({ id, content: bareContent() }),
    );
    const wrapped = withNormalizedTemplateLoads(
      provider({ save }),
      MERGE_TAGS,
    );

    const patch = { content: bareContent() };
    await (wrapped.save as (id: string, p: unknown) => Promise<Template>)(
      "tpl-1",
      patch,
    );

    expect(save).toHaveBeenCalledWith("tpl-1", patch);
  });
});

// ---------------------------------------------------------------------------
// Q4 — normalization happens on the way in, so nothing is marked dirty
// ---------------------------------------------------------------------------

describe("loading a template whose content normalized", () => {
  it("applies the spans without marking the template dirty", async () => {
    const templates = withNormalizedTemplateLoads(
      {
        load: async (id: string) => ({ id, content: bareContent() }),
        create: false,
        save: false,
      },
      MERGE_TAGS,
    );
    const editor = useEditor({
      content: createDefaultTemplateContent(),
      templates,
    });

    await editor.load("tpl-1");

    expect(firstParagraph(editor.content.value)).toBe(WRAPPED);
    expect(editor.state.isDirty).toBe(false);
  });
});
