import MergeTagNodeView from "./MergeTagNodeView.vue";
import type { MergeTag, SyntaxPreset } from "@templatical/types";
import { getMergeTagLabel, SYNTAX_PRESETS } from "@templatical/types";
import { InputRule, mergeAttributes, Node, PasteRule } from "@tiptap/core";
import { VueNodeViewRenderer } from "@tiptap/vue-3";

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
      },
      value: {
        default: "",
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
    const isMergeTagSelected = (): boolean => {
      const { selection } = this.editor.state;
      const { $from, $to } = selection;

      // Check if selection contains a merge tag node
      let hasMergeTag = false;
      this.editor.state.doc.nodesBetween($from.pos, $to.pos, (node) => {
        if (node.type.name === this.name) {
          hasMergeTag = true;
          return false;
        }
      });

      if (hasMergeTag) {
        return true;
      }

      // Check if cursor is right after a merge tag (for Backspace)
      if ($from.pos > 0) {
        const nodeBefore = $from.nodeBefore;
        if (nodeBefore?.type.name === this.name) {
          return true;
        }
      }

      // Check if cursor is right before a merge tag (for Delete)
      const nodeAfter = $from.nodeAfter;
      if (nodeAfter?.type.name === this.name) {
        return true;
      }

      return false;
    };

    return {
      Backspace: () => isMergeTagSelected(),
      Delete: () => isMergeTagSelected(),
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
