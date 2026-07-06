import MergeTagNodeView from "./MergeTagNodeView.vue";
import type { MergeTag, SyntaxPreset } from "@templatical/types";
import { getMergeTagLabel, SYNTAX_PRESETS } from "@templatical/types";
import { InputRule, mergeAttributes, Node, PasteRule } from "@tiptap/core";
import { isNodeSelected } from "./isNodeSelected";
import { mergeTagNodeSpec } from "../utils/mergeTagNodeSpec";
import { renderVueNodeView } from "./renderVueNodeView";

export interface MergeTagNodeOptions {
  mergeTags: MergeTag[];
  syntax: SyntaxPreset;
}

/**
 * Inserted-node attrs are intentionally limited to `label` + `value`. The
 * `MergeTag` interface also carries optional `group` / `description` for
 * the built-in picker, but those are display-only and must NOT leak into
 * the document JSON — they would bloat templates and pollute serialized
 * state. `Pick<>` makes the constraint explicit at the type level.
 */
export type InsertMergeTagAttrs = Pick<MergeTag, "label" | "value">;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mergeTagNode: {
      insertMergeTag: (attrs: InsertMergeTagAttrs) => ReturnType;
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
    return renderVueNodeView(MergeTagNodeView);
  },

  addCommands() {
    return {
      insertMergeTag:
        (attrs: InsertMergeTagAttrs) =>
        ({ commands }) => {
          // Insert a logicMergeTagNode when the value is logic-shaped, else a
          // data mergeTagNode — matching what manual typing produces via the
          // input rules. The helper also whitelists attrs, so extra keys a
          // caller might smuggle via a wider type cannot reach the node.
          return commands.insertContent(
            mergeTagNodeSpec(attrs.value, attrs.label, this.options.syntax),
          );
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
