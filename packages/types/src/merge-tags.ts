import type { MergeTag } from './config';

// --- Syntax Presets ---

export interface SyntaxPreset {
    value: RegExp;
    logic: RegExp;
}

export type SyntaxPresetName =
    | 'liquid'
    | 'handlebars'
    | 'mailchimp'
    | 'ampscript'
    | 'django';

export const SYNTAX_PRESETS: Record<SyntaxPresetName, SyntaxPreset> = {
    liquid: { value: /\{\{.+?\}\}/g, logic: /\{%-?\s*(\w+).*?-?%\}/g },
    handlebars: {
        value: /\{\{\{?.+?\}?\}\}/g,
        logic: /\{\{[#/](\w+).*?\}\}/g,
    },
    mailchimp: { value: /\*\|\w+\|\*/g, logic: /\*\|(\w+)[:|].*?\|\*/g },
    ampscript: { value: /%%=.+?=%%/g, logic: /%%\[\s*(\w+).*?\]%%/g },
    django: { value: /\{\{.+?\}\}/g, logic: /\{%-?\s*(\w+).*?-?%\}/g },
};

export function resolveSyntax(
    syntax?: SyntaxPresetName | SyntaxPreset,
): SyntaxPreset {
    if (!syntax) {
        return SYNTAX_PRESETS.liquid;
    }

    if (typeof syntax === 'string') {
        return SYNTAX_PRESETS[syntax];
    }

    return syntax;
}

// --- Merge Tag Utilities ---

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function anchoredRegex(pattern: RegExp): RegExp {
    const source = pattern.source;
    const flags = pattern.flags.replace('g', '');
    return new RegExp(`^${source}$`, flags);
}

export function isMergeTagValue(value: string, syntax: SyntaxPreset): boolean {
    return anchoredRegex(syntax.value).test(value?.trim() || '');
}

export function getMergeTagLabel(value: string, mergeTags: MergeTag[]): string {
    const found = mergeTags.find((p) => p.value === value);
    if (found) {
        return found.label;
    }
    return value;
}

export function resolveHtmlMergeTagLabels(
    html: string,
    mergeTags: MergeTag[],
): string {
    return html.replace(
        /(<span[^>]*\sdata-merge-tag="([^"]*)"[^>]*>)(.*?)(<\/span>)/g,
        (_match, openTag, value, _oldLabel, closeTag) => {
            const label = getMergeTagLabel(value, mergeTags);
            return `${openTag}${label}${closeTag}`;
        },
    );
}

export function containsMergeTag(value: string, syntax: SyntaxPreset): boolean {
    if (!value) return false;

    const valueRegex = new RegExp(syntax.value.source, syntax.value.flags);
    const logicRegex = new RegExp(syntax.logic.source, syntax.logic.flags);

    return valueRegex.test(value) || logicRegex.test(value);
}

export function restoreMergeTagMarkup(
    html: string,
    mergeTags: MergeTag[],
    syntax: SyntaxPreset,
): string {
    let result = html;

    for (const tag of mergeTags) {
        const escaped = escapeRegExp(tag.value);
        const pattern = new RegExp(`(?<!data-merge-tag=")${escaped}`, 'g');
        result = result.replace(pattern, (match) => {
            const label = getMergeTagLabel(match, mergeTags);
            return `<span data-merge-tag="${match}">${label}</span>`;
        });
    }

    const logicRegex = new RegExp(
        `(?<!data-logic-merge-tag=")${syntax.logic.source}`,
        syntax.logic.flags,
    );
    result = result.replace(logicRegex, (match) => {
        const keyword = getLogicMergeTagKeyword(match, syntax);
        return `<span data-logic-merge-tag="${match}">${keyword}</span>`;
    });

    return result;
}

export function isLogicMergeTagValue(
    value: string,
    syntax: SyntaxPreset,
): boolean {
    return anchoredRegex(syntax.logic).test(value?.trim() || '');
}

export function getLogicMergeTagKeyword(
    value: string,
    syntax: SyntaxPreset,
): string {
    const regex = new RegExp(
        syntax.logic.source,
        syntax.logic.flags.replace('g', ''),
    );
    const match = value.match(regex);
    return match && match[1] ? match[1].toUpperCase() : value;
}

export function resolveHtmlLogicMergeTagLabels(
    html: string,
    syntax: SyntaxPreset,
): string {
    return html.replace(
        /(<span[^>]*\sdata-logic-merge-tag="([^"]*)"[^>]*>)(.*?)(<\/span>)/g,
        (_match, openTag, value, _oldLabel, closeTag) => {
            const keyword = getLogicMergeTagKeyword(value, syntax);
            return `${openTag}${keyword}${closeTag}`;
        },
    );
}
