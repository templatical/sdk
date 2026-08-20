// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { effectScope, ref } from "vue";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  type MergeTagsConfig,
  type ParagraphBlock,
  type TemplateContent,
  type TemplateVersion,
  type VersionHistoryProvider,
} from "@templatical/types";
import { useVersionHistoryFeature } from "../src/composables/useVersionHistoryFeature";
import { withNormalizedContentWrites } from "../src/utils/normalizeMergeTagMarkup";

/**
 * Version history is the fifth content-in path.
 *
 * Its content does not arrive through the public API or through the `templates`
 * provider — `resolveContent()` reads `version.content` off the hydrated list,
 * a `fetched` cache, or `provider.get()`, and `restore()` returns its own. So
 * neither the entry-point hooks nor the templates-provider wrapper reach it.
 *
 * A version is not guaranteed to hold normalized content just because a save
 * produced it: a store carries whatever was written to it, and a backend may
 * version a template it imported rather than one the editor round-tripped —
 * which is exactly the population this feature serves. Previewing such a
 * version without this would put bare tokens on a canvas where every other tag
 * is a chip.
 */

const MERGE_TAGS: MergeTagsConfig = {
  tags: [{ label: "First Name", value: "{{first_name}}", sample: "Ada" }],
};

const BARE = "<p>Hi {{first_name}}</p>";
const WRAPPED =
  '<p>Hi <span data-merge-tag="{{first_name}}">First Name</span></p>';

function content(html: string): TemplateContent {
  return {
    ...createDefaultTemplateContent(),
    blocks: [createParagraphBlock({ content: html })],
  };
}

function firstParagraph(c: TemplateContent): string {
  return (c.blocks[0] as ParagraphBlock).content;
}

function version(id: string, overrides: Partial<TemplateVersion> = {}) {
  return { id, createdAt: "2026-08-16T10:00:00Z", ...overrides };
}

// ---------------------------------------------------------------------------
// The wiring — the wrapper is worthless if Editor.vue stops using it
// ---------------------------------------------------------------------------

describe("Editor.vue wiring", () => {
  const editorSource = readFileSync(
    join(import.meta.dirname, "..", "src", "Editor.vue"),
    "utf8",
  );

  it("hands version history a normalizing editor, not the raw one", () => {
    expect(editorSource).toContain(
      "editor: withNormalizedContentWrites(editor, props.config.mergeTags),",
    );
  });
});

// ---------------------------------------------------------------------------
// The wrapper itself
// ---------------------------------------------------------------------------

describe("withNormalizedContentWrites", () => {
  function baseEditor() {
    return {
      state: { template: { id: "tpl-1" }, isDirty: false },
      content: ref(content("<p>current</p>")),
      setContent: vi.fn(),
    };
  }

  it("normalizes content on its way to setContent", () => {
    const editor = baseEditor();

    withNormalizedContentWrites(editor, MERGE_TAGS).setContent(content(BARE));

    expect(firstParagraph(editor.setContent.mock.calls[0][0])).toBe(WRAPPED);
  });

  // Every version-history write passes `false`. Dropping it would turn opening
  // a preview into an unsaved change and arm autosave on content the user never
  // authored.
  it("forwards markDirty unchanged", () => {
    const editor = baseEditor();
    const wrapped = withNormalizedContentWrites(editor, MERGE_TAGS);

    wrapped.setContent(content(BARE), false);
    wrapped.setContent(content(BARE), true);
    wrapped.setContent(content(BARE));

    expect(editor.setContent.mock.calls[0][1]).toBe(false);
    expect(editor.setContent.mock.calls[1][1]).toBe(true);
    expect(editor.setContent.mock.calls[2][1]).toBeUndefined();
  });

  it("leaves a token in an href untouched", () => {
    const editor = baseEditor();
    const href = '<p><a href="{{first_name}}">x</a></p>';

    withNormalizedContentWrites(editor, MERGE_TAGS).setContent(content(href));

    expect(firstParagraph(editor.setContent.mock.calls[0][0])).toBe(href);
  });

  it("reads state and content through to the live editor", () => {
    const editor = baseEditor();
    const wrapped = withNormalizedContentWrites(editor, MERGE_TAGS);

    editor.state.isDirty = true;
    editor.content.value = content("<p>later</p>");

    expect(wrapped.state.isDirty).toBe(true);
    expect(firstParagraph(wrapped.content.value)).toBe("<p>later</p>");
  });

  // Collaboration replaces the editor's mutators so they broadcast, and it runs
  // before this feature is built. Resolving `setContent` per call rather than
  // capturing it keeps a wrapped editor from pinning the pre-broadcast version.
  it("resolves setContent per call, not at construction", () => {
    const editor = baseEditor();
    const wrapped = withNormalizedContentWrites(editor, MERGE_TAGS);
    const rewrapped = vi.fn();
    editor.setContent = rewrapped;

    wrapped.setContent(content(BARE));

    expect(rewrapped).toHaveBeenCalledTimes(1);
    expect(firstParagraph(rewrapped.mock.calls[0][0])).toBe(WRAPPED);
  });
});

// ---------------------------------------------------------------------------
// Through the feature, which is where it has to hold
// ---------------------------------------------------------------------------

describe("version history normalizes the content it puts on the canvas", () => {
  function setup(providerOverrides: Partial<VersionHistoryProvider> = {}) {
    const provider: VersionHistoryProvider = {
      list: vi.fn(async () => ({ versions: [] as TemplateVersion[] })),
      get: vi.fn(async () => content(BARE)),
      create: vi.fn(async () => version("ver-safety")),
      restore: vi.fn(async () => ({ id: "tpl-1", content: content(BARE) })),
      ...providerOverrides,
    };

    const editor = {
      state: { template: { id: "tpl-1" }, isDirty: false },
      content: ref(content("<p>current</p>")),
      setContent: vi.fn((next: TemplateContent) => {
        editor.content.value = next;
      }),
    };

    const scope = effectScope();
    const feature = scope.run(() =>
      useVersionHistoryFeature({
        provider,
        editor: withNormalizedContentWrites(editor, MERGE_TAGS) as never,
        history: { clear: vi.fn() } as never,
        conditionPreview: { reset: vi.fn() } as never,
        autoSave: { pause: vi.fn(), resume: vi.fn() } as never,
        saveBeforeRestore: null,
        onError: vi.fn(),
      }),
    )!;

    return { provider, editor, feature, scope };
  }

  it("converts bare tokens in a version fetched through get()", async () => {
    const { editor, feature } = setup();

    await feature.navigate(version("ver-1"));

    expect(firstParagraph(editor.content.value)).toBe(WRAPPED);
  });

  // The synchronous scrub path: content the provider hydrated onto the list,
  // which never goes through `get()` at all.
  it("converts bare tokens in a version hydrated onto the list", async () => {
    const { editor, provider, feature } = setup();
    await feature.navigate(version("ver-1"));
    vi.mocked(provider.get).mockClear();

    await feature.navigate(version("ver-2", { content: content(BARE) }));

    expect(provider.get).not.toHaveBeenCalled();
    expect(firstParagraph(editor.content.value)).toBe(WRAPPED);
  });

  it("converts bare tokens in restored content", async () => {
    // Distinct from what `get()` returns, so this cannot pass on the content the
    // preview already put on the canvas — the restore has to be what applied it.
    const { editor, feature } = setup({
      restore: vi.fn(async () => ({
        id: "tpl-1",
        content: content("<p>Bye {{first_name}}</p>"),
      })),
    });
    await feature.navigate(version("ver-1"));

    await feature.confirmRestore();

    expect(firstParagraph(editor.content.value)).toBe(
      '<p>Bye <span data-merge-tag="{{first_name}}">First Name</span></p>',
    );
  });

  // Q4 — a preview is not an edit, and normalizing must not make it one.
  it("opens a preview without marking the template dirty", async () => {
    const { editor, feature } = setup();

    await feature.navigate(version("ver-1"));

    expect(editor.setContent.mock.calls[0][1]).toBe(false);
    expect(editor.state.isDirty).toBe(false);
  });

  it("puts the user's own work back unchanged when a preview is cancelled", async () => {
    const { editor, feature } = setup();
    const before = editor.content.value;

    await feature.navigate(version("ver-1"));
    feature.cancelPreview();

    expect(firstParagraph(editor.content.value)).toBe(
      firstParagraph(before),
    );
  });
});
