import LogicMergeTagNodeView from "./LogicMergeTagNodeView.vue";
import type { SyntaxPreset } from "@templatical/types";
import {
  getLogicMergeTagKeyword,
  isLogicMergeTagValue,
  SYNTAX_PRESETS,
} from "@templatical/types";
import { InputRule, mergeAttributes, Node, PasteRule } from "@tiptap/core";
import { isNodeSelected } from "./isNodeSelected";
import { renderVueNodeView } from "./renderVueNodeView";

export interface LogicMergeTagNodeOptions {
  syntax: SyntaxPreset;
}

export const LogicMergeTagNode = Node.create<LogicMergeTagNodeOptions>({
  name: "logicMergeTagNode",

  group: "inline",

  inline: true,

  atom: true,

  addOptions() {
    return {
      syntax: SYNTAX_PRESETS.liquid,
    };
  },

  addAttributes() {
    return {
      // Both attributes are state, not markup, same as `MergeTagNode`:
      // `renderHTML()` emits the canonical `data-logic-merge-tag` /
      // `data-keyword` pair and `parseHTML` reads only those. `rendered: false`
      // keeps TipTap from also serializing each attribute under its own name,
      // which would put a write-only duplicate of the same data on every tag.
      value: {
        default: "",
        rendered: false,
        parseHTML: (element) =>
          element.getAttribute("data-logic-merge-tag") || "",
      },
      keyword: {
        default: "",
        rendered: false,
        parseHTML: (element) =>
          element.getAttribute("data-keyword") || element.textContent || "",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-logic-merge-tag]",
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    if (!isLogicMergeTagValue(node.attrs.value, this.options.syntax)) {
      return ["span", {}, node.attrs.value];
    }

    const keyword = getLogicMergeTagKeyword(
      node.attrs.value,
      this.options.syntax,
    );

    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-logic-merge-tag": node.attrs.value,
        "data-keyword": keyword,
      }),
      keyword,
    ];
  },

  addNodeView() {
    return renderVueNodeView(LogicMergeTagNodeView);
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => isNodeSelected(this.editor, this.name),
      Delete: () => isNodeSelected(this.editor, this.name),
    };
  },

  addInputRules() {
    const inputRegex = new RegExp(this.options.syntax.logic.source + "$", "");

    return [
      new InputRule({
        find: inputRegex,
        handler: ({ state, range, match }) => {
          const fullValue = match[0];
          if (!isLogicMergeTagValue(fullValue, this.options.syntax)) {
            return;
          }

          const keyword = getLogicMergeTagKeyword(
            fullValue,
            this.options.syntax,
          );

          const node = this.type.create({
            value: fullValue,
            keyword,
          });

          state.tr.replaceWith(range.from, range.to, node);
        },
      }),
    ];
  },

  addPasteRules() {
    const pasteRegex = new RegExp(this.options.syntax.logic.source, "g");

    return [
      new PasteRule({
        find: pasteRegex,
        handler: ({ state, range, match }) => {
          const fullValue = match[0];
          if (!isLogicMergeTagValue(fullValue, this.options.syntax)) {
            return;
          }

          const keyword = getLogicMergeTagKeyword(
            fullValue,
            this.options.syntax,
          );

          const node = this.type.create({
            value: fullValue,
            keyword,
          });

          state.tr.replaceWith(range.from, range.to, node);
        },
      }),
    ];
  },
});
