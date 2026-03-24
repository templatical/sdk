import LogicMergeTagNodeView from './LogicMergeTagNodeView.vue';
import type { SyntaxPreset } from '@templatical/types';
import {
    getLogicMergeTagKeyword,
    isLogicMergeTagValue,
    SYNTAX_PRESETS,
} from '@templatical/types';
import { InputRule, mergeAttributes, Node, PasteRule } from '@tiptap/core';
import { VueNodeViewRenderer } from '@tiptap/vue-3';

export interface LogicMergeTagNodeOptions {
    syntax: SyntaxPreset;
}

export const LogicMergeTagNode = Node.create<LogicMergeTagNodeOptions>({
    name: 'logicMergeTagNode',

    group: 'inline',

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
                default: '',
            },
            keyword: {
                default: '',
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-logic-merge-tag]',
            },
        ];
    },

    renderHTML({ node, HTMLAttributes }) {
        if (!isLogicMergeTagValue(node.attrs.value, this.options.syntax)) {
            return ['span', {}, node.attrs.value];
        }

        const keyword = getLogicMergeTagKeyword(
            node.attrs.value,
            this.options.syntax,
        );

        return [
            'span',
            mergeAttributes(HTMLAttributes, {
                'data-logic-merge-tag': node.attrs.value,
                'data-keyword': keyword,
            }),
            keyword,
        ];
    },

    addNodeView() {
        return VueNodeViewRenderer(LogicMergeTagNodeView);
    },

    addKeyboardShortcuts() {
        const isLogicMergeTagSelected = (): boolean => {
            const { selection } = this.editor.state;
            const { $from, $to } = selection;

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

            if ($from.pos > 0) {
                const nodeBefore = $from.nodeBefore;
                if (nodeBefore?.type.name === this.name) {
                    return true;
                }
            }

            const nodeAfter = $from.nodeAfter;
            if (nodeAfter?.type.name === this.name) {
                return true;
            }

            return false;
        };

        return {
            Backspace: () => isLogicMergeTagSelected(),
            Delete: () => isLogicMergeTagSelected(),
        };
    },

    addInputRules() {
        const inputRegex = new RegExp(
            this.options.syntax.logic.source + '$',
            '',
        );

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

                    const tr = state.tr.replaceWith(range.from, range.to, node);
                    return tr;
                },
            }),
        ];
    },

    addPasteRules() {
        const pasteRegex = new RegExp(this.options.syntax.logic.source, 'g');

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

                    const tr = state.tr.replaceWith(range.from, range.to, node);
                    return tr;
                },
            }),
        ];
    },
});
