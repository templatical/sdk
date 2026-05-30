import "./dom-stubs";

import { describe, expect, it, vi } from "vitest";
import { SYNTAX_PRESETS } from "@templatical/types";

// Mock .vue node-view imports (matches mergeTagNode.test.ts) so importing the
// node extensions doesn't pull in SFCs the test doesn't need.
vi.mock("../src/extensions/MergeTagNodeView.vue", () => ({ default: {} }));
vi.mock("../src/extensions/LogicMergeTagNodeView.vue", () => ({ default: {} }));

import { FontSize } from "../src/extensions/FontSize";
import { LetterSpacing } from "../src/extensions/LetterSpacing";
import { LineHeight } from "../src/extensions/LineHeight";
import { MergeTagNode } from "../src/extensions/MergeTagNode";
import { LogicMergeTagNode } from "../src/extensions/LogicMergeTagNode";

// The existing textStyleExtensions.test.ts covers the global-attribute
// parse/render. This file covers the COMMANDS and the merge-tag INPUT/PASTE
// rule handlers — the actual transaction-composing logic — by invoking the
// command creators / rule handlers directly with mocked TipTap primitives
// (no full ProseMirror editor, per the package's test conventions).

/** A chained-command mock where every step returns the same object. */
function chainMock(runReturn = true) {
  const c = {
    setMark: vi.fn(() => c),
    removeEmptyTextStyle: vi.fn(() => c),
    run: vi.fn(() => runReturn),
  };
  return c;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function commandsOf(ext: any, options: Record<string, unknown>) {
  return ext.configure({}).config.addCommands.call({ options });
}

describe("FontSize commands", () => {
  it("setFontSize chains setMark(textStyle, { fontSize }) and returns the chain result", () => {
    const chain = chainMock(true);
    const cmds = commandsOf(FontSize, { types: ["textStyle"] });

    const result = cmds.setFontSize("18px")({ chain: () => chain });

    expect(chain.setMark).toHaveBeenCalledWith("textStyle", { fontSize: "18px" });
    expect(chain.run).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it("unsetFontSize clears the mark and removes the empty textStyle", () => {
    const chain = chainMock(false);
    const cmds = commandsOf(FontSize, { types: ["textStyle"] });

    const result = cmds.unsetFontSize()({ chain: () => chain });

    expect(chain.setMark).toHaveBeenCalledWith("textStyle", { fontSize: null });
    expect(chain.removeEmptyTextStyle).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });
});

describe("LetterSpacing commands", () => {
  it("setLetterSpacing chains setMark(textStyle, { letterSpacing })", () => {
    const chain = chainMock(true);
    const cmds = commandsOf(LetterSpacing, { types: ["textStyle"] });

    const result = cmds.setLetterSpacing("2px")({ chain: () => chain });

    expect(chain.setMark).toHaveBeenCalledWith("textStyle", {
      letterSpacing: "2px",
    });
    expect(result).toBe(true);
  });

  it("unsetLetterSpacing clears the mark and removes the empty textStyle", () => {
    const chain = chainMock(true);
    const cmds = commandsOf(LetterSpacing, { types: ["textStyle"] });

    cmds.unsetLetterSpacing()({ chain: () => chain });

    expect(chain.setMark).toHaveBeenCalledWith("textStyle", {
      letterSpacing: null,
    });
    expect(chain.removeEmptyTextStyle).toHaveBeenCalledTimes(1);
  });
});

describe("LineHeight commands", () => {
  it("setLineHeight updates the attribute on every configured type", () => {
    const updateAttributes = vi.fn(() => true);
    const cmds = commandsOf(LineHeight, { types: ["paragraph", "heading"] });

    const result = cmds.setLineHeight("2.0")({
      commands: { updateAttributes },
    });

    expect(updateAttributes).toHaveBeenCalledTimes(2);
    expect(updateAttributes).toHaveBeenNthCalledWith(1, "paragraph", {
      lineHeight: "2.0",
    });
    expect(updateAttributes).toHaveBeenNthCalledWith(2, "heading", {
      lineHeight: "2.0",
    });
    expect(result).toBe(true);
  });

  it("setLineHeight short-circuits and returns false when a type update fails", () => {
    // `every` stops at the first false — the failing type is first here.
    const updateAttributes = vi.fn((type: string) => type !== "heading");
    const cmds = commandsOf(LineHeight, { types: ["heading", "paragraph"] });

    const result = cmds.setLineHeight("2.0")({
      commands: { updateAttributes },
    });

    expect(result).toBe(false);
    expect(updateAttributes).toHaveBeenCalledTimes(1);
    expect(updateAttributes).toHaveBeenCalledWith("heading", {
      lineHeight: "2.0",
    });
  });

  it("unsetLineHeight resets the attribute on every configured type", () => {
    const resetAttributes = vi.fn(() => true);
    const cmds = commandsOf(LineHeight, { types: ["paragraph"] });

    const result = cmds.unsetLineHeight()({ commands: { resetAttributes } });

    expect(resetAttributes).toHaveBeenCalledWith("paragraph", "lineHeight");
    expect(result).toBe(true);
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nodeRules(ext: any, kind: "addInputRules" | "addPasteRules", ctx: any) {
  return ext.configure({}).config[kind].call(ctx);
}

describe("MergeTagNode input/paste rules", () => {
  function ctx(mergeTags: Array<{ label: string; value: string }> = []) {
    return {
      options: { syntax: SYNTAX_PRESETS.liquid, mergeTags },
      type: { create: vi.fn((attrs) => ({ __node: true, attrs })) },
    };
  }

  it("input rule replaces the matched range with a merge-tag node (resolved label)", () => {
    const c = ctx([{ label: "First Name", value: "{{first_name}}" }]);
    const rules = nodeRules(MergeTagNode, "addInputRules", c);
    expect(rules).toHaveLength(1);

    const replaceWith = vi.fn();
    rules[0].handler({
      state: { tr: { replaceWith } },
      range: { from: 3, to: 17 },
      match: ["{{first_name}}"],
    });

    expect(c.type.create).toHaveBeenCalledWith({
      label: "First Name",
      value: "{{first_name}}",
    });
    const createdNode = c.type.create.mock.results[0].value;
    expect(replaceWith).toHaveBeenCalledWith(3, 17, createdNode);
  });

  it("input rule falls back to the raw value as label when no tag matches", () => {
    const c = ctx([]); // unknown tag
    const rules = nodeRules(MergeTagNode, "addInputRules", c);

    const replaceWith = vi.fn();
    rules[0].handler({
      state: { tr: { replaceWith } },
      range: { from: 0, to: 11 },
      match: ["{{unknown}}"],
    });

    expect(c.type.create).toHaveBeenCalledWith({
      label: "{{unknown}}",
      value: "{{unknown}}",
    });
  });

  it("paste rule replaces the matched range with a merge-tag node", () => {
    const c = ctx([{ label: "Email", value: "{{email}}" }]);
    const rules = nodeRules(MergeTagNode, "addPasteRules", c);

    const replaceWith = vi.fn();
    rules[0].handler({
      state: { tr: { replaceWith } },
      range: { from: 5, to: 14 },
      match: ["{{email}}"],
    });

    expect(c.type.create).toHaveBeenCalledWith({
      label: "Email",
      value: "{{email}}",
    });
    expect(replaceWith).toHaveBeenCalledWith(
      5,
      14,
      c.type.create.mock.results[0].value,
    );
  });
});

describe("LogicMergeTagNode input/paste rules", () => {
  function ctx() {
    return {
      options: { syntax: SYNTAX_PRESETS.liquid },
      type: { create: vi.fn((attrs) => ({ __logic: true, attrs })) },
    };
  }

  it("input rule inserts a logic node with the uppercased keyword for a valid tag", () => {
    const c = ctx();
    const rules = nodeRules(LogicMergeTagNode, "addInputRules", c);

    const replaceWith = vi.fn();
    rules[0].handler({
      state: { tr: { replaceWith } },
      range: { from: 0, to: 13 },
      match: ["{% if user %}"],
    });

    expect(c.type.create).toHaveBeenCalledWith({
      value: "{% if user %}",
      keyword: "IF",
    });
    expect(replaceWith).toHaveBeenCalledWith(
      0,
      13,
      c.type.create.mock.results[0].value,
    );
  });

  it("input rule bails (no node, no replace) when the match is not a logic tag", () => {
    const c = ctx();
    const rules = nodeRules(LogicMergeTagNode, "addInputRules", c);

    const replaceWith = vi.fn();
    rules[0].handler({
      state: { tr: { replaceWith } },
      range: { from: 0, to: 5 },
      match: ["plain"],
    });

    expect(c.type.create).not.toHaveBeenCalled();
    expect(replaceWith).not.toHaveBeenCalled();
  });

  it("paste rule inserts a logic node for a valid tag", () => {
    const c = ctx();
    const rules = nodeRules(LogicMergeTagNode, "addPasteRules", c);

    const replaceWith = vi.fn();
    rules[0].handler({
      state: { tr: { replaceWith } },
      range: { from: 2, to: 17 },
      match: ["{% for x in y %}"],
    });

    expect(c.type.create).toHaveBeenCalledWith({
      value: "{% for x in y %}",
      keyword: "FOR",
    });
  });

  it("paste rule bails when the match is not a logic tag", () => {
    const c = ctx();
    const rules = nodeRules(LogicMergeTagNode, "addPasteRules", c);

    const replaceWith = vi.fn();
    rules[0].handler({
      state: { tr: { replaceWith } },
      range: { from: 0, to: 4 },
      match: ["nope"],
    });

    expect(c.type.create).not.toHaveBeenCalled();
    expect(replaceWith).not.toHaveBeenCalled();
  });
});
