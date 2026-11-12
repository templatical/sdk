// @vitest-environment happy-dom
import "./dom-stubs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { computed, ref, shallowRef } from "vue";
import { useEditor } from "@templatical/core";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  safeClone,
  type MergeTag,
  type TemplateContent,
} from "@templatical/types";
import Editor from "../src/Editor.vue";
import BlockPreviewCanvas from "../src/components/BlockPreviewCanvas.vue";
import Canvas from "../src/components/Canvas.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";
import {
  CAPABILITIES_KEY,
  EDITOR_KEY,
  MERGE_TAGS_KEY,
  PREVIEW_RESOLUTION_KEY,
} from "../src/keys";
import { mountEditor } from "./helpers/mount";

/**
 * Preview mode showing what `resolvePreview` returned.
 *
 * A host usually resolves tags in place: it renders each string through its own
 * engine, which evaluates the token inside `data-merge-tag` too, so the span
 * survives with the value where the token was. The preview must show that value
 * as ordinary text, like a sample in Sample view, and drop the logic badges the
 * host evaluated. Keeping the span is never right here: `getMergeTagLabel` falls
 * back to the value it is given, so a kept span shows "Cruz" as a highlighted
 * chip.
 *
 * Unresolved previews (no hook, or the fallback after a failure) keep labels,
 * badges and the Sample/Label switch exactly as before.
 */

const TAGS: MergeTag[] = [
  { label: "First Name", value: "{{first_name}}", sample: "Ada" },
  { label: "Last Name", value: "{{last_name}}", sample: "Lovelace" },
];

/** Stored as TipTap writes it: the attribute holds the token, the text the label. */
const STORED_HTML =
  '<p><span data-logic-merge-tag="{% if vip %}" data-keyword="IF">IF</span>Welcome back<span data-logic-merge-tag="{% endif %}" data-keyword="ENDIF">ENDIF</span>, ' +
  '<span data-merge-tag="{{first_name}}" data-label="First Name">First Name</span> ' +
  '<span data-merge-tag="{{last_name}}" data-label="Last Name">Last Name</span></p>';

/**
 * The same paragraph after a host rendered the whole string through its engine
 * for a VIP guest called Cruz Rau: every token, including the ones in the
 * attributes, was evaluated; the labels inside the spans were left alone.
 */
const RESOLVED_HTML =
  '<p><span data-logic-merge-tag="" data-keyword="IF">IF</span>Welcome back<span data-logic-merge-tag="" data-keyword="ENDIF">ENDIF</span>, ' +
  '<span data-merge-tag="Cruz" data-label="First Name">First Name</span> ' +
  '<span data-merge-tag="Rau" data-label="Last Name">Last Name</span></p>';

function template(html = STORED_HTML): TemplateContent {
  const content = createDefaultTemplateContent();
  content.blocks = [createParagraphBlock({ id: "greeting", content: html })];
  return content;
}

function resolvedFrom(content: TemplateContent, html: string): TemplateContent {
  const resolved = safeClone(content);
  (resolved.blocks[0] as { content: string }).content = html;
  return resolved;
}

const wrappers: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  document.body.innerHTML = "";
});

async function openPreview(config: Record<string, unknown>) {
  const wrapper = mount(Editor, {
    attachTo: document.body,
    props: {
      config: {
        container: document.createElement("div"),
        content: template(),
        mergeTags: { tags: TAGS },
        ...config,
      },
      translations: await loadTranslations("en"),
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
  wrappers.push(wrapper);
  await wrapper.find(".tpl-preview-toggle").trigger("click");
  await flushPromises();
  return wrapper;
}

function paragraph(wrapper: VueWrapper): HTMLElement {
  return wrapper.get('[data-block-id="greeting"] .tpl-text-content')
    .element as HTMLElement;
}

describe("preview mode showing a resolved template", () => {
  it("renders values the host resolved in place as plain text, with no chip", async () => {
    const resolver = vi.fn(async ({ content }: { content: TemplateContent }) =>
      resolvedFrom(content, RESOLVED_HTML),
    );
    const wrapper = await openPreview({ resolvePreview: resolver });
    const el = paragraph(wrapper);

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(el.textContent).toBe("Welcome back, Cruz Rau");
    // The highlight is CSS on these spans; none may survive.
    expect(el.querySelectorAll("[data-merge-tag]")).toHaveLength(0);
    expect(el.querySelectorAll("[data-logic-merge-tag]")).toHaveLength(0);
  });

  it("keeps a tag the host left unresolved as a highlighted label", async () => {
    const wrapper = await openPreview({
      resolvePreview: async ({ content }: { content: TemplateContent }) =>
        resolvedFrom(
          content,
          '<p>Hi <span data-merge-tag="Cruz">First Name</span> ' +
            '<span data-merge-tag="{{last_name}}">Last Name</span></p>',
        ),
    });
    const el = paragraph(wrapper);

    expect(el.textContent).toBe("Hi Cruz Last Name");
    const chips = el.querySelectorAll("[data-merge-tag]");
    expect(chips).toHaveLength(1);
    expect(chips[0]!.getAttribute("data-merge-tag")).toBe("{{last_name}}");
  });

  it("shows the unresolved template unchanged when the resolver returns it as-is", async () => {
    // The documented "no choice made yet" pattern returns `content` untouched.
    const wrapper = await openPreview({
      resolvePreview: async ({ content }: { content: TemplateContent }) =>
        content,
    });
    const el = paragraph(wrapper);

    expect(el.textContent).toBe("IFWelcome backENDIF, First Name Last Name");
    expect(el.querySelectorAll("[data-merge-tag]")).toHaveLength(2);
    expect(el.querySelectorAll("[data-logic-merge-tag]")).toHaveLength(2);
  });

  it("never touches the stored content", async () => {
    const wrapper = await openPreview({
      resolvePreview: async ({ content }: { content: TemplateContent }) =>
        resolvedFrom(content, RESOLVED_HTML),
    });

    const exposed = wrapper.vm as unknown as {
      getContent: () => TemplateContent;
    };
    expect((exposed.getContent().blocks[0] as { content: string }).content)
      .toContain('data-merge-tag="{{first_name}}"');
  });
});

describe("unresolved previews keep labels and badges", () => {
  it("highlights labels and logic badges on the fallback after a failure", async () => {
    const wrapper = await openPreview({
      resolvePreview: async () => {
        throw new Error("backend down");
      },
    });
    const el = paragraph(wrapper);

    expect(wrapper.find('[data-testid="preview-resolution-failed"]').exists())
      .toBe(true);
    expect(el.textContent).toBe("IFWelcome backENDIF, First Name Last Name");
    expect(el.querySelectorAll("[data-merge-tag]")).toHaveLength(2);
    expect(el.querySelectorAll("[data-logic-merge-tag]")).toHaveLength(2);
  });

  it("leaves the Sample/Label switch working when no resolver is set", async () => {
    const wrapper = await openPreview({});
    const toggle = wrapper.get('[data-testid="merge-tag-mode-toggle"]');

    // Sample view by default: samples as plain text, badges still shown.
    expect(paragraph(wrapper).textContent).toBe(
      "IFWelcome backENDIF, Ada Lovelace",
    );
    expect(paragraph(wrapper).querySelectorAll("[data-merge-tag]")).toHaveLength(0);
    expect(paragraph(wrapper).querySelectorAll("[data-logic-merge-tag]"))
      .toHaveLength(2);

    await toggle.get('[aria-label="Label"]').trigger("click");

    expect(paragraph(wrapper).textContent).toBe(
      "IFWelcome backENDIF, First Name Last Name",
    );
    expect(paragraph(wrapper).querySelectorAll("[data-merge-tag]")).toHaveLength(2);
  });
});

/**
 * The surface decides, not the resolution state: `Canvas.vue` folds in
 * `previewMode`, so the editing canvas keeps a tag as a tag even while a
 * resolution instance reports a resolved answer, and `BlockPreviewCanvas`
 * opts in only through its prop, so saved-block previews keep their labels.
 */
describe("only a preview showing resolved content renders tags as text", () => {
  /** One tag resolved in place, as a host's engine leaves it. */
  const IN_PLACE = '<p>Hi <span data-merge-tag="Cruz">First Name</span></p>';

  /** A resolution instance that reports a resolved answer on screen. */
  function showingResolved() {
    return {
      isConfigured: true,
      content: computed(() => template(IN_PLACE)),
      isResolving: ref(false),
      isInitialResolve: computed(() => false),
      hasFailed: ref(false),
      isShowingResolved: computed(() => true),
      supersedesSamples: computed(() => true),
      refresh: () => {},
    };
  }

  function mountCanvas(previewMode: boolean) {
    const editor = useEditor({ content: template(IN_PLACE) });
    return mountEditor(Canvas, {
      props: {
        viewport: "desktop",
        content: editor.content.value,
        selectedBlockId: editor.state.selectedBlockId,
        darkMode: false,
        previewMode,
      },
      provides: {
        [EDITOR_KEY]: editor,
        [MERGE_TAGS_KEY]: shallowRef(TAGS),
        [PREVIEW_RESOLUTION_KEY]: showingResolved(),
        [CAPABILITIES_KEY]: {},
      },
    } as never);
  }

  function mountBlockPreview(showsResolved?: boolean) {
    const content = template(IN_PLACE);
    return mountEditor(BlockPreviewCanvas, {
      props: {
        blocks: content.blocks,
        ...(showsResolved === undefined ? {} : { showsResolved }),
      },
      provides: {
        [EDITOR_KEY]: { content: ref(content), state: {} },
        [MERGE_TAGS_KEY]: shallowRef(TAGS),
      },
    } as never);
  }

  function text(wrapper: VueWrapper): HTMLElement {
    return wrapper.get(".tpl-text-content").element as HTMLElement;
  }

  it("keeps the tag on the editing canvas", async () => {
    const wrapper = mountCanvas(false);
    await flushPromises();

    expect(text(wrapper).textContent).toBe("Hi Cruz");
    expect(text(wrapper).querySelectorAll("[data-merge-tag]")).toHaveLength(1);
  });

  it("renders it as text once the same canvas is in preview mode", async () => {
    // Positive control: without it the case above could pass because the
    // canvas never renders resolved tags as text at all.
    const wrapper = mountCanvas(true);
    await flushPromises();

    expect(text(wrapper).textContent).toBe("Hi Cruz");
    expect(text(wrapper).querySelectorAll("[data-merge-tag]")).toHaveLength(0);
  });

  it("keeps the tag in a block preview that is not told it shows resolved content", async () => {
    const wrapper = mountBlockPreview();
    await flushPromises();

    expect(text(wrapper).querySelectorAll("[data-merge-tag]")).toHaveLength(1);
  });

  it("renders it as text in a block preview showing resolved content", async () => {
    const wrapper = mountBlockPreview(true);
    await flushPromises();

    expect(text(wrapper).textContent).toBe("Hi Cruz");
    expect(text(wrapper).querySelectorAll("[data-merge-tag]")).toHaveLength(0);
  });
});
