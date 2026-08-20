// @vitest-environment happy-dom
//
// The entry-level half of merge-tag normalization: every way consumer content
// reaches the editor must go through the normalizer, not just `init()`.
//
// Mocked the same way as `index-cloud-init.test.ts` — `h` captures the props
// handed to `Editor.vue`, so `config.content` can be inspected at the moment of
// mount, and the component instance is set by hand to drive the post-mount
// branches of the returned instance's methods.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Ref } from "vue";
import type {
  ParagraphBlock,
  Template,
  TemplateContent,
} from "@templatical/types";

const WRAPPED =
  '<p>Hi <span data-merge-tag="{{first_name}}">First Name</span></p>';
const BARE = "<p>Hi {{first_name}}</p>";

const MERGE_TAGS = {
  tags: [{ label: "First Name", value: "{{first_name}}", sample: "Ada" }],
};

function bareContent(): TemplateContent {
  return {
    blocks: [{ id: "p1", type: "paragraph", content: BARE }],
    settings: {},
  } as unknown as TemplateContent;
}

function firstParagraph(content: TemplateContent): string {
  return (content.blocks[0] as ParagraphBlock).content;
}

const captured: { props: Record<string, unknown> | null } = { props: null };

const fakeRuntime = { attach: vi.fn(), ready: vi.fn(), destroy: vi.fn() };
const fakeProviders = {
  templates: { load: vi.fn(), create: vi.fn(), save: vi.fn() },
  render: { toMjml: vi.fn(async () => "<mjml/>") },
  versionHistory: { list: vi.fn(), get: vi.fn(), create: false, restore: false },
  savedBlocks: { list: vi.fn(), create: false, update: false, delete: false },
  testEmail: { send: vi.fn() },
};

let initFn: typeof import("../src/index").init;
let initCloudFn: typeof import("../src/index").initCloud;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  captured.props = null;

  vi.doMock("vue", async () => {
    const actual = await vi.importActual<typeof import("vue")>("vue");
    return {
      ...actual,
      createApp: vi.fn((options: { setup: () => () => unknown }) => {
        options.setup()();
        return { mount: vi.fn(), unmount: vi.fn() };
      }),
      h: vi.fn((_comp: unknown, props: Record<string, unknown>) => {
        captured.props = props;
        return {};
      }),
    };
  });
  vi.doMock("../src/Editor.vue", () => ({ default: { name: "Editor" } }));
  vi.doMock("../src/cloud/createCloudRuntime", () => ({
    bootstrapCloud: vi.fn(async () => ({
      runtime: fakeRuntime,
      providers: fakeProviders,
    })),
  }));
  vi.doMock("../src/i18n", () => ({
    loadTranslations: vi.fn(() => Promise.resolve({})),
    loadCloudTranslations: vi.fn(() => Promise.resolve({})),
  }));
  vi.doMock("../src/composables", () => ({
    useFonts: vi.fn(() => ({
      fonts: { value: [] },
      customFonts: { value: [] },
      defaultFallback: { value: "Arial, sans-serif" },
    })),
  }));
  vi.doMock("../src/utils/toMjml", () => ({
    toMjmlForInstance: vi.fn(() => Promise.resolve("<mjml/>")),
  }));

  const mod = await import("../src/index");
  initFn = mod.init;
  initCloudFn = mod.initCloud;
});

afterEach(() => {
  document.body.innerHTML = "";
});

function container(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

/** The `config` object `Editor.vue` was mounted with. */
function mountedConfig(): { content: TemplateContent } {
  return (captured.props as { config: { content: TemplateContent } }).config;
}

/** Drive the post-mount branch by filling the template ref `h` captured. */
function attachInstance(instance: Record<string, unknown>): void {
  (captured.props as unknown as { ref: Ref<unknown> }).ref.value = instance;
}

describe("init() normalizes content on the way in", () => {
  it("converts a bare token in the seeded content before mount", async () => {
    await initFn({
      container: container(),
      content: bareContent(),
      mergeTags: MERGE_TAGS,
    });

    expect(firstParagraph(mountedConfig().content)).toBe(WRAPPED);
  });

  it("leaves a token in an href untouched in the seeded content", async () => {
    const content = {
      blocks: [
        {
          id: "p1",
          type: "paragraph",
          content: '<p><a href="{{first_name}}">x</a></p>',
        },
      ],
      settings: {},
    } as unknown as TemplateContent;

    await initFn({ container: container(), content, mergeTags: MERGE_TAGS });

    expect(firstParagraph(mountedConfig().content)).toBe(
      '<p><a href="{{first_name}}">x</a></p>',
    );
  });

  it("mounts with no content at all without throwing", async () => {
    await initFn({ container: container(), mergeTags: MERGE_TAGS });

    expect(mountedConfig().content).toBeUndefined();
  });
});

describe("initCloud() normalizes content on the way in", () => {
  it("converts a bare token in the seeded content before mount", async () => {
    await initCloudFn({
      container: container(),
      projectId: "p1",
      token: "t1",
      content: bareContent(),
      mergeTags: MERGE_TAGS,
    } as unknown as Parameters<typeof initCloudFn>[0]);

    expect(firstParagraph(mountedConfig().content)).toBe(WRAPPED);
  });
});

describe("instance.setContent() normalizes its argument", () => {
  it("forwards normalized content to the mounted editor", async () => {
    const instance = await initFn({
      container: container(),
      mergeTags: MERGE_TAGS,
    });
    const setContent = vi.fn();
    attachInstance({ setContent });

    instance.setContent(bareContent());

    expect(firstParagraph(setContent.mock.calls[0][0])).toBe(WRAPPED);
  });

  // `getContent()` falls back to `config.content` before mount, so the
  // write-back has to be normalized too or the two paths disagree.
  it("writes normalized content back to config, visible pre-mount", async () => {
    const instance = await initFn({
      container: container(),
      mergeTags: MERGE_TAGS,
    });

    instance.setContent(bareContent());

    expect(firstParagraph(instance.getContent())).toBe(WRAPPED);
  });
});

describe("instance.create() normalizes supplied content", () => {
  it("normalizes input.content before it becomes editor state", async () => {
    const instance = await initFn({
      container: container(),
      mergeTags: MERGE_TAGS,
    });
    const create = vi.fn(
      async (): Promise<Template> => ({ id: "t1", content: bareContent() }),
    );
    attachInstance({ create });

    await instance.create({ name: "New", content: bareContent() });

    expect(firstParagraph(create.mock.calls[0][0].content)).toBe(WRAPPED);
    expect(create.mock.calls[0][0].name).toBe("New");
  });

  it("passes a contentless create through untouched", async () => {
    const instance = await initFn({
      container: container(),
      mergeTags: MERGE_TAGS,
    });
    const create = vi.fn(
      async (): Promise<Template> => ({ id: "t1", content: bareContent() }),
    );
    attachInstance({ create });

    await instance.create({ name: "New" });

    expect(create.mock.calls[0][0]).toEqual({ name: "New" });
  });
});
