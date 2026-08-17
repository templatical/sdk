import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// The `logic` config must be forwarded from the public config all the way to
// `useEditorCore`'s provides, and the floating toolbars must hide when the
// logic picker is open. Both are integration seams that per-composable unit
// tests (which provide inject keys directly) can't catch — a dropped field
// here silently disables the whole feature. These source-pattern guards lock
// the wiring.

function read(path: string): string {
  return readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
}

describe("logicTags config wiring", () => {
  it("Editor.vue forwards config.logicTags to useEditorCore", () => {
    expect(read("Editor.vue")).toContain(
      "logicTags: props.config.logicTags",
    );
  });

  // `initCloud()` forwards it by mapping its own config onto `init()`'s — there
  // is one `useEditorCore` call site now, so this is the only hop left.
  it("initCloud forwards config.logicTags into the init() config", () => {
    expect(read("index.ts")).toContain("logicTags: config.logicTags");
  });

  it("useEditorCore provides the logic tags, pairs, onRequest, and picker keys", () => {
    const src = read("composables/useEditorCore.ts");
    expect(src).toContain("provide(LOGIC_TAGS_KEY, config.logicTags?.tags ?? [])");
    expect(src).toContain("provide(LOGIC_PAIRS_KEY, config.logicTags?.pairs ?? [])");
    expect(src).toContain(
      "provide(ON_REQUEST_LOGIC_TAG_KEY, config.logicTags?.onRequest ?? null)",
    );
    expect(src).toContain("provide(LOGIC_TAG_PICKER_KEY, useLogicTagPicker())");
  });

  it("plain-field components render a logic insert button", () => {
    expect(read("components/MergeTagInput.vue")).toContain("LogicTagInsertButton");
    expect(read("components/MergeTagTextarea.vue")).toContain(
      "LogicTagInsertButton",
    );
  });

  it("useMergeTagField exposes insertLogicTag + canInsertLogicTag", () => {
    const src = read("composables/useMergeTagField.ts");
    expect(src).toContain("insertLogicTag");
    expect(src).toContain("canInsertLogicTag");
  });

  it("the editor renders the LogicTagPickerModal", () => {
    expect(read("Editor.vue")).toContain("<LogicTagPickerModal");
  });

  it("both floating toolbars hide while the logic picker is open", () => {
    expect(read("components/blocks/ParagraphToolbar.vue")).toContain(
      "LOGIC_TAG_PICKER_KEY",
    );
    expect(read("components/blocks/TitleEditor.vue")).toContain(
      "LOGIC_TAG_PICKER_KEY",
    );
  });

  it("click-outside is suppressed while the logic picker is open (so the insert lands)", () => {
    // Regression: without this guard, clicking a logic picker item exits the
    // block's edit mode before handleAddLogicTag inserts, and the insert no-ops.
    expect(read("composables/useRichTextEditor.ts")).toMatch(
      /isRequestingMergeTag\.value \|\| isRequestingLogicTag\.value/,
    );
  });
});
