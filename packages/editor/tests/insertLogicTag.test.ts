import { describe, expect, it } from "vitest";
import { SYNTAX_PRESETS } from "@templatical/types";
import type { Editor } from "@tiptap/core";
import type { LogicPair, LogicTag } from "@templatical/types";
import {
  insertLogicTagSelection,
  isLogicTagPair,
} from "../src/utils/insertLogicTag";

const liquid = SYNTAX_PRESETS.liquid;

type Call = [string, ...unknown[]];

function makeEditor(from: number, to: number): { editor: Editor; calls: Call[] } {
  const calls: Call[] = [];
  const chain = {
    focus() {
      calls.push(["focus"]);
      return chain;
    },
    insertContent(c: unknown) {
      calls.push(["insertContent", c]);
      return chain;
    },
    insertContentAt(pos: unknown, c: unknown) {
      calls.push(["insertContentAt", pos, c]);
      return chain;
    },
    setTextSelection(pos: unknown) {
      calls.push(["setTextSelection", pos]);
      return chain;
    },
    run() {
      calls.push(["run"]);
      return true;
    },
  };
  const editor = {
    state: { selection: { from, to } },
    chain: () => chain,
  } as unknown as Editor;
  return { editor, calls };
}

describe("isLogicTagPair", () => {
  it("is true for a pair, false for a tag", () => {
    const pair: LogicPair = {
      label: "If",
      before: "{% if x %}",
      after: "{% endif %}",
    };
    const tag: LogicTag = { label: "Else", value: "{% else %}" };
    expect(isLogicTagPair(pair)).toBe(true);
    expect(isLogicTagPair(tag)).toBe(false);
  });
});

describe("insertLogicTagSelection", () => {
  it("inserts a standalone tag at the cursor as a logic node", () => {
    const { editor, calls } = makeEditor(3, 3);
    insertLogicTagSelection(editor, { label: "Else", value: "{% else %}" }, liquid);
    expect(calls).toEqual([
      ["focus"],
      [
        "insertContent",
        {
          type: "logicMergeTagNode",
          attrs: { value: "{% else %}", keyword: "ELSE" },
        },
      ],
      ["run"],
    ]);
  });

  it("wraps a non-empty selection: close at `to`, open at `from`", () => {
    const { editor, calls } = makeEditor(2, 5);
    insertLogicTagSelection(
      editor,
      { label: "If VIP", before: "{% if vip %}", after: "{% endif %}" },
      liquid,
    );
    expect(calls).toEqual([
      ["focus"],
      [
        "insertContentAt",
        5,
        {
          type: "logicMergeTagNode",
          attrs: { value: "{% endif %}", keyword: "ENDIF" },
        },
      ],
      [
        "insertContentAt",
        2,
        {
          type: "logicMergeTagNode",
          attrs: { value: "{% if vip %}", keyword: "IF" },
        },
      ],
      ["run"],
    ]);
  });

  it("with no selection, inserts both pills and parks the caret between them", () => {
    const { editor, calls } = makeEditor(4, 4);
    insertLogicTagSelection(
      editor,
      {
        label: "Loop",
        before: "{% for item in items %}",
        after: "{% endfor %}",
      },
      liquid,
    );
    expect(calls).toEqual([
      ["focus"],
      [
        "insertContentAt",
        4,
        [
          {
            type: "logicMergeTagNode",
            attrs: { value: "{% for item in items %}", keyword: "FOR" },
          },
          {
            type: "logicMergeTagNode",
            attrs: { value: "{% endfor %}", keyword: "ENDFOR" },
          },
        ],
      ],
      ["setTextSelection", 5],
      ["run"],
    ]);
  });
});
