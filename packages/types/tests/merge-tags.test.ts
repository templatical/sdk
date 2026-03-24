import { describe, expect, it } from 'vitest';
import {
    isMergeTagValue,
    getMergeTagLabel,
    containsMergeTag,
    isLogicMergeTagValue,
    getLogicMergeTagKeyword,
    resolveHtmlMergeTagLabels,
    restoreMergeTagMarkup,
    resolveSyntax,
    SYNTAX_PRESETS,
    type MergeTag,
} from '../src';

const liquidSyntax = SYNTAX_PRESETS.liquid;

const tags: MergeTag[] = [
    { label: 'First Name', value: '{{first_name}}' },
    { label: 'Email', value: '{{email}}' },
];

describe('resolveSyntax', () => {
    it('returns liquid preset by default', () => {
        const syntax = resolveSyntax();
        expect(syntax).toBe(SYNTAX_PRESETS.liquid);
    });

    it('resolves named presets', () => {
        expect(resolveSyntax('handlebars')).toBe(SYNTAX_PRESETS.handlebars);
        expect(resolveSyntax('mailchimp')).toBe(SYNTAX_PRESETS.mailchimp);
    });

    it('returns custom syntax as-is', () => {
        const custom = { value: /\[\[.+?\]\]/g, logic: /\[\[#(\w+).*?\]\]/g };
        expect(resolveSyntax(custom)).toBe(custom);
    });
});

describe('isMergeTagValue', () => {
    it('returns true for liquid merge tags', () => {
        expect(isMergeTagValue('{{first_name}}', liquidSyntax)).toBe(true);
    });

    it('returns false for plain text', () => {
        expect(isMergeTagValue('hello', liquidSyntax)).toBe(false);
    });

    it('returns false for partial match', () => {
        expect(isMergeTagValue('hello {{name}} world', liquidSyntax)).toBe(false);
    });
});

describe('getMergeTagLabel', () => {
    it('returns label for known merge tags', () => {
        expect(getMergeTagLabel('{{first_name}}', tags)).toBe('First Name');
    });

    it('returns raw value for unknown merge tags', () => {
        expect(getMergeTagLabel('{{unknown}}', tags)).toBe('{{unknown}}');
    });
});

describe('containsMergeTag', () => {
    it('detects value merge tags in string', () => {
        expect(containsMergeTag('Hello {{name}}', liquidSyntax)).toBe(true);
    });

    it('detects logic merge tags in string', () => {
        expect(containsMergeTag('{% if active %}', liquidSyntax)).toBe(true);
    });

    it('returns false for plain text', () => {
        expect(containsMergeTag('Hello world', liquidSyntax)).toBe(false);
    });

    it('returns false for empty string', () => {
        expect(containsMergeTag('', liquidSyntax)).toBe(false);
    });
});

describe('isLogicMergeTagValue', () => {
    it('returns true for liquid logic tags', () => {
        expect(isLogicMergeTagValue('{% if active %}', liquidSyntax)).toBe(true);
    });

    it('returns false for value tags', () => {
        expect(isLogicMergeTagValue('{{name}}', liquidSyntax)).toBe(false);
    });
});

describe('getLogicMergeTagKeyword', () => {
    it('extracts keyword from liquid logic tag', () => {
        expect(getLogicMergeTagKeyword('{% if active %}', liquidSyntax)).toBe('IF');
    });

    it('extracts keyword from endif', () => {
        expect(getLogicMergeTagKeyword('{% endif %}', liquidSyntax)).toBe('ENDIF');
    });
});

describe('resolveHtmlMergeTagLabels', () => {
    it('updates merge tag span labels', () => {
        const html = '<span data-merge-tag="{{first_name}}">old</span>';
        const result = resolveHtmlMergeTagLabels(html, tags);
        expect(result).toBe('<span data-merge-tag="{{first_name}}">First Name</span>');
    });
});

describe('restoreMergeTagMarkup', () => {
    it('wraps raw merge tags in editor markup', () => {
        const result = restoreMergeTagMarkup(
            'Hello {{first_name}}',
            tags,
            liquidSyntax,
        );
        expect(result).toContain('data-merge-tag="{{first_name}}"');
        expect(result).toContain('First Name');
    });
});
