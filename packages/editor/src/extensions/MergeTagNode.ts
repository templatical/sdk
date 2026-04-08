import MergeTagNodeView from "./MergeTagNodeView.vue";
import type { MergeTag, SyntaxPreset } from "@templatical/types";
import { getMergeTagLabel, SYNTAX_PRESETS } from "@templatical/types";
import { InputRule, mergeAttributes, Node, PasteRule } from "@tiptap/core";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import { isNodeSelected } from "./isNodeSelected";

export interface MergeTagNodeOptions {
  mergeTags: MergeTag[];
  syntax: SyntaxPreset;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mergeTagNode: {
      insertMergeTag: (attrs: MergeTag) => ReturnType;
    };
  }
}

export const MergeTagNode = Node.create<MergeTagNodeOptions>({
  name: "mergeTagNode",

  group: "inline",

  inline: true,

  atom: true,

  addOptions() {
    return {
      mergeTags: [],
      syntax: SYNTAX_PRESETS.liquid,
    };
  },

  addAttributes() {
    return {
      label: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-label") || element.textContent || "",
      },
      value: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-merge-tag") || "",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-merge-tag]",
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = getMergeTagLabel(node.attrs.value, this.options.mergeTags);

    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-merge-tag": node.attrs.value,
        "data-label": label,
      }),
      label,
    ];
  },

  addNodeView() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TipTap's VueNodeViewRenderer expects
    // a narrower component type than what Vue SFC default exports provide. This is a known interop gap.
    return VueNodeViewRenderer(MergeTagNodeView as any);
  },

  addCommands() {
    return {
      insertMergeTag:
        (attrs: MergeTag) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => isNodeSelected(this.editor, this.name),
      Delete: () => isNodeSelected(this.editor, this.name),
    };
  },

  addInputRules() {
    const inputRegex = new RegExp(this.options.syntax.value.source + "$", "");

    return [
      new InputRule({
        find: inputRegex,
        handler: ({ state, range, match }) => {
          const fullValue = match[0];
          const label = getMergeTagLabel(fullValue, this.options.mergeTags);

          const node = this.type.create({
            label,
            value: fullValue,
          });

          state.tr.replaceWith(range.from, range.to, node);
        },
      }),
    ];
  },

  addPasteRules() {
    const pasteRegex = new RegExp(this.options.syntax.value.source, "g");

    return [
      new PasteRule({
        find: pasteRegex,
        handler: ({ state, range, match }) => {
          const fullValue = match[0];
          const label = getMergeTagLabel(fullValue, this.options.mergeTags);

          const node = this.type.create({
            label,
            value: fullValue,
          });

          state.tr.replaceWith(range.from, range.to, node);
        },
      }),
    ];
  },
});
