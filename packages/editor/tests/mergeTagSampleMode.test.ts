// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nextTick, ref } from "vue";
import BlockPreviewCanvas from "../src/components/BlockPreviewCanvas.vue";
import Canvas from "../src/components/Canvas.vue";
import MergeTagModeToggle from "../src/components/MergeTagModeToggle.vue";
import { useEditor } from "@templatical/core";
import { mountEditor } from "./helpers/mount";
import {
  CAPABILITIES_KEY,
  EDITOR_KEY,
  MERGE_TAGS_KEY,
  MERGE_TAG_SAMPLE_MODE_KEY,
} from "../src/keys";
import {
  createDefaultTemplateContent,
  createParagraphBlock,
  type MergeTag,
} from "@templatical/types";

/**
 * Sample mode — merge tags rendered as example values on preview surfaces.
 *
 * The invariant that matters more than any other here: **substitution never
 * happens while editing.** A block a user is about to type into must show the
 * tag they inserted, not a value they never wrote. That is why the surface, not
 * the mode, has the final say — `Canvas.vue` folds in its own `previewMode`, so
 * the editing canvas provides `false` no matter what the mode ref holds.
 *
 * The second invariant is the wrapper: a substituted sample renders with no
 * `<span data-merge-tag>`, because that span is what carries the highlight. Its
 * absence is what makes Sample mode look like a delivered email.
 */

const TAGS: MergeTag[] = [
  { label: "First Name", value: "{{first_name}}", sample: "Ada" },
  { label: "Plan Name", value: "{{plan}}" }, // deliberately sample-less
];

/** A paragraph carrying both tags as TipTap-authored spans. */
const PARAGRAPH_HTML =
  '<p>Hi <span data-merge-tag="{{first_name}}">First Name</span> on ' +
  '<span data-merge-tag="{{plan}}">Plan Name</span></p>';

function content() {
  const c = createDefaultTemplateContent();
  c.blocks = [createParagraphBlock({ content: PARAGRAPH_HTML })];
  return c;
}

function mountPreview(sampleMode: boolean) {
  const c = content();
  return mountEditor(BlockPreviewCanvas, {
    props: { blocks: c.blocks },
    provides: {
      [EDITOR_KEY]: { content: ref(c), state: {} },
      [MERGE_TAGS_KEY]: TAGS,
      [MERGE_TAG_SAMPLE_MODE_KEY]: ref(sampleMode),
    },
  } as never);
}

function mountCanvas(previewMode: boolean, sampleMode = true) {
  const editor = useEditor({ content: content() });
  return mountEditor(Canvas, {
    props: {
      viewport: "desktop",
      content: editor.content.value,
      selectedBlockId: editor.state.selectedBlockId,
      darkMode: false,
      previewMode,
      lockedBlocks: new Map(),
    },
    provides: {
      [EDITOR_KEY]: editor,
      [MERGE_TAGS_KEY]: TAGS,
      [MERGE_TAG_SAMPLE_MODE_KEY]: ref(sampleMode),
      [CAPABILITIES_KEY]: {},
    },
  } as never);
}

describe("sample mode on a preview surface", () => {
  it("renders the sample value instead of the label", async () => {
    const wrapper = mountPreview(true);
    await nextTick();

    expect(wrapper.html()).toContain("Ada");
    expect(wrapper.text()).not.toContain("First Name");
  });

  it("drops the span wrapper, so no highlight applies to the sample", async () => {
    const wrapper = mountPreview(true);
    await nextTick();

    // The highlight CSS targets `span[data-merge-tag]`; no span, no highlight.
    expect(wrapper.html()).not.toContain('data-merge-tag="{{first_name}}"');
  });

  it("keeps the label AND its highlight for a tag with no sample", async () => {
    const wrapper = mountPreview(true);
    await nextTick();

    expect(wrapper.text()).toContain("Plan Name");
    expect(wrapper.text()).not.toContain("{{plan}}");
    // Per-tag: the sampled tag lost its span (above), this one keeps it, so it
    // stays visibly dynamic while the sample beside it reads as real content.
    expect(wrapper.html()).toContain('data-merge-tag="{{plan}}"');
  });

  it("shows labels with their spans in label mode", async () => {
    const wrapper = mountPreview(false);
    await nextTick();

    expect(wrapper.text()).toContain("First Name");
    expect(wrapper.text()).not.toContain("Ada");
    expect(wrapper.html()).toContain('data-merge-tag="{{first_name}}"');
  });
});

describe("the editing canvas never substitutes", () => {
  it("shows labels while editing, even with sample mode on", async () => {
    // The whole point: mode is on, but the canvas is editable, so the author
    // still sees the tag they inserted.
    const wrapper = mountCanvas(false, true);
    await nextTick();

    expect(wrapper.text()).toContain("First Name");
    expect(wrapper.text()).not.toContain("Ada");
  });

  it("substitutes once preview mode is on", async () => {
    // Positive control — without this the test above could pass because
    // substitution is broken everywhere rather than correctly gated.
    const wrapper = mountCanvas(true, true);
    await nextTick();

    expect(wrapper.text()).toContain("Ada");
    expect(wrapper.text()).not.toContain("First Name");
  });

  it("shows labels in preview mode when the user picks label view", async () => {
    const wrapper = mountCanvas(true, false);
    await nextTick();

    expect(wrapper.text()).toContain("First Name");
    expect(wrapper.text()).not.toContain("Ada");
  });
});

describe("stored content is untouched", () => {
  it("leaves the block's own content carrying the raw token", async () => {
    const c = content();
    const wrapper = mountEditor(BlockPreviewCanvas, {
      props: { blocks: c.blocks },
      provides: {
        [EDITOR_KEY]: { content: ref(c), state: {} },
        [MERGE_TAGS_KEY]: TAGS,
        [MERGE_TAG_SAMPLE_MODE_KEY]: ref(true),
      },
    } as never);
    await nextTick();

    expect(wrapper.text()).toContain("Ada");
    // Substitution is display-only: what would be exported still holds the
    // token, which is what keeps sample data out of a real send.
    expect(c.blocks[0]).toMatchObject({ content: PARAGRAPH_HTML });
    expect(PARAGRAPH_HTML).toContain("{{first_name}}");
  });
});

/**
 * The feature gates itself on a sample existing. With none configured the two
 * views would render identically, so the editor stays in Label view and shows
 * no toggle — meaning every consumer who never sets `sample` sees exactly the
 * previous behaviour.
 */
describe("availability gates on a sample existing", () => {
  const NO_SAMPLES: MergeTag[] = [
    { label: "First Name", value: "{{first_name}}" },
    { label: "Plan Name", value: "{{plan}}" },
  ];

  function mountToggle(tags: MergeTag[]) {
    return mountEditor(MergeTagModeToggle, {
      props: { sampleMode: true },
      provides: { [MERGE_TAGS_KEY]: tags },
    } as never);
  }

  it("renders the toggle when at least one tag has a sample", () => {
    const wrapper = mountToggle(TAGS);

    expect(wrapper.find('[data-testid="merge-tag-mode-toggle"]').exists()).toBe(
      true,
    );
  });

  it("renders nothing when no tag has a sample", () => {
    const wrapper = mountToggle(NO_SAMPLES);

    expect(wrapper.find('[data-testid="merge-tag-mode-toggle"]').exists()).toBe(
      false,
    );
  });

  it("renders nothing when no merge tags are configured at all", () => {
    const wrapper = mountToggle([]);

    expect(wrapper.find('[data-testid="merge-tag-mode-toggle"]').exists()).toBe(
      false,
    );
  });

  it("leaves every tag labelled and highlighted when none has a sample", async () => {
    // Even with sample mode forced on, there is nothing to substitute, so the
    // rendering is identical to Label view — spans and all.
    const c = content();
    const wrapper = mountEditor(BlockPreviewCanvas, {
      props: { blocks: c.blocks },
      provides: {
        [EDITOR_KEY]: { content: ref(c), state: {} },
        [MERGE_TAGS_KEY]: NO_SAMPLES,
        [MERGE_TAG_SAMPLE_MODE_KEY]: ref(true),
      },
    } as never);
    await nextTick();

    expect(wrapper.text()).toContain("First Name");
    expect(wrapper.text()).toContain("Plan Name");
    expect(wrapper.html()).toContain('data-merge-tag="{{first_name}}"');
    expect(wrapper.html()).toContain('data-merge-tag="{{plan}}"');
  });
});

/**
 * The mode toggle has to *be* the viewport toggle's twin, not merely resemble
 * it: the two sit side by side in the editor header, so any divergence in icon
 * size, padding or pill geometry reads as a visual bug.
 *
 * This drifted once already — the mode toggle shipped with 16px icons against
 * the header's 18px, which made its pill 2px shorter than every neighbour
 * (`py-1.5` + `p-1` means icon height drives pill height). Source-level
 * assertions, in the style of `block-chrome-structure.test.ts`.
 */
describe("MergeTagModeToggle matches the header's other controls", () => {
  const dir = join(__dirname, "..", "src", "components");
  const read = (name: string) =>
    readFileSync(join(dir, `${name}.vue`), "utf-8");

  const iconSizes = (src: string) =>
    [...new Set([...src.matchAll(/:size="(\d+)"/g)].map((m) => m[1]))].sort();

  /** Every `tpl:` utility used, as a sorted set. */
  const tplClasses = (src: string) =>
    [...new Set(src.match(/tpl:[a-z0-9:[\]().,%/_-]+/g) ?? [])].sort();

  it("uses the same icon size as every other header control", () => {
    // 18 is the header baseline — viewport, dark mode and preview all use it.
    expect(iconSizes(read("MergeTagModeToggle"))).toEqual(["18"]);
    expect(iconSizes(read("ViewportToggle"))).toEqual(["18"]);
    expect(iconSizes(read("DarkModeToggle"))).toEqual(["18"]);
    expect(iconSizes(read("PreviewToggle"))).toEqual(["18"]);
  });

  it("uses exactly the viewport toggle's Tailwind utilities", () => {
    // Identical sets, so padding, gap, radius and text size cannot diverge.
    expect(tplClasses(read("MergeTagModeToggle"))).toEqual(
      tplClasses(read("ViewportToggle")),
    );
  });

  it("keeps the same radiogroup semantics", () => {
    const src = read("MergeTagModeToggle");
    expect(src).toContain('role="radiogroup"');
    expect(src).toContain('role="radio"');
    expect(src).toContain(":aria-checked=");
  });
});
