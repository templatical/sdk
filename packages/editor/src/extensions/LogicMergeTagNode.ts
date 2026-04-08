import LogicMergeTagNodeView from "./LogicMergeTagNodeView.vue";
import type { SyntaxPreset } from "@templatical/types";
import {
  getLogicMergeTagKeyword,
  isLogicMergeTagValue,
  SYNTAX_PRESETS,
} from "@templatical/types";
import { InputRule, mergeAttributes, Node, PasteRule } from "@tiptap/core";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import { isNodeSelected } from "./isNodeSelected";

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
      value: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-logic-merge-tag") || "",
      },
      keyword: {
        default: "",
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TipTap's VueNodeViewRenderer expects
    // a narrower component type than what Vue SFC default exports provide. This is a known interop gap.
    return VueNodeViewRenderer(LogicMergeTagNodeView as any);
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
