import { describe, expect, it } from 'vitest';
import {
    isMergeTagValue,
    getMergeTagLabel,
    containsMergeTag,
    isLogicMergeTagValue,
    getLogicMergeTagKeyword,
    resolveHtmlMergeTagLabels,
    resolveHtmlLogicMergeTagLabels,
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

    it('falls back to liquid when given an unknown preset name', () => {
        // Consumers may pass a runtime string that bypasses TS narrowing.
        const syntax = resolveSyntax('not-a-real-preset' as any);
        expect(syntax).toBe(SYNTAX_PRESETS.liquid);
        expect(syntax.value).toBeInstanceOf(RegExp);
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

    it('returns false for handlebars logic tags (not value tags)', () => {
        // The handlebars value regex `\{\{\{?.+?\}?\}\}` would otherwise match
        // `{{#each items}}` and misclassify it as a value merge tag.
        const handlebars = SYNTAX_PRESETS.handlebars;
        expect(isMergeTagValue('{{#each items}}', handlebars)).toBe(false);
        expect(isMergeTagValue('{{/each}}', handlebars)).toBe(false);
        expect(isMergeTagValue('{{#if active}}', handlebars)).toBe(false);
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

describe('resolveHtmlLogicMergeTagLabels', () => {
    it('replaces logic tag labels inside spans', () => {
        const html = '<span data-logic-merge-tag="{% if active %}">old_label</span>';
        const result = resolveHtmlLogicMergeTagLabels(html, SYNTAX_PRESETS.liquid);
        expect(result).toContain('>IF<');
    });

    it('handles multiple logic tag spans', () => {
        const html = '<span data-logic-merge-tag="{% if active %}">old</span> content <span data-logic-merge-tag="{% endif %}">old2</span>';
        const result = resolveHtmlLogicMergeTagLabels(html, SYNTAX_PRESETS.liquid);
        expect(result).toContain('>IF<');
        expect(result).toContain('>ENDIF<');
    });

    it('leaves HTML without logic tags unchanged', () => {
        const html = '<p>No logic tags here</p>';
        const result = resolveHtmlLogicMergeTagLabels(html, SYNTAX_PRESETS.liquid);
        expect(result).toBe(html);
    });
});

describe('cross-syntax merge tag detection', () => {
    it('isMergeTagValue works with handlebars syntax', () => {
        expect(isMergeTagValue('{{name}}', SYNTAX_PRESETS.handlebars)).toBe(true);
        expect(isMergeTagValue('{{{raw}}}', SYNTAX_PRESETS.handlebars)).toBe(true);
    });

    it('isMergeTagValue works with mailchimp syntax', () => {
        expect(isMergeTagValue('*|FNAME|*', SYNTAX_PRESETS.mailchimp)).toBe(true);
        expect(isMergeTagValue('{{ not_mailchimp }}', SYNTAX_PRESETS.mailchimp)).toBe(false);
    });

    it('isMergeTagValue works with ampscript syntax', () => {
        expect(isMergeTagValue('%%=v(@var)=%%', SYNTAX_PRESETS.ampscript)).toBe(true);
    });

    it('containsMergeTag works with handlebars syntax', () => {
        expect(containsMergeTag('Hello {{name}}!', SYNTAX_PRESETS.handlebars)).toBe(true);
        expect(containsMergeTag('{{#if active}}show{{/if}}', SYNTAX_PRESETS.handlebars)).toBe(true);
    });

    it('containsMergeTag works with mailchimp syntax', () => {
        expect(containsMergeTag('Hi *|FNAME|*', SYNTAX_PRESETS.mailchimp)).toBe(true);
    });
});

describe('restoreMergeTagMarkup edge cases', () => {
    it('does not double-wrap already wrapped merge tags', () => {
        const html = '<span data-merge-tag="{{ name }}">Name</span>';
        const result = restoreMergeTagMarkup(
            html,
            [{ label: 'Name', value: '{{ name }}' }],
            SYNTAX_PRESETS.liquid,
        );
        // Should not double-wrap - lookahead prevents it
        const count = (result.match(/data-merge-tag/g) || []).length;
        expect(count).toBe(1);
    });

    it('wraps unwrapped merge tags while preserving wrapped ones', () => {
        const html = '<span data-merge-tag="{{ name }}">Name</span> and {{ email }}';
        const result = restoreMergeTagMarkup(
            html,
            [
                { label: 'Name', value: '{{ name }}' },
                { label: 'Email', value: '{{ email }}' },
            ],
            SYNTAX_PRESETS.liquid,
        );
        expect(result).toContain('data-merge-tag="{{ email }}"');
        expect((result.match(/data-merge-tag/g) || []).length).toBe(2);
    });

    it('wraps logic tags in addition to value tags', () => {
        const html = '{{ name }} and {% if active %}show{% endif %}';
        const result = restoreMergeTagMarkup(
            html,
            [{ label: 'Name', value: '{{ name }}' }],
            SYNTAX_PRESETS.liquid,
        );
        expect(result).toContain('data-merge-tag="{{ name }}"');
        expect(result).toContain('data-logic-merge-tag="{% if active %}"');
        expect(result).toContain('data-logic-merge-tag="{% endif %}"');
    });
});

describe('isMergeTagValue edge cases', () => {
    it('handles whitespace around tags', () => {
        expect(isMergeTagValue('  {{ name }}  ', SYNTAX_PRESETS.liquid)).toBe(true);
    });

    it('returns false for empty string', () => {
        expect(isMergeTagValue('', SYNTAX_PRESETS.liquid)).toBe(false);
    });

    it('returns false for null-ish input', () => {
        expect(isMergeTagValue(null as any, SYNTAX_PRESETS.liquid)).toBe(false);
        expect(isMergeTagValue(undefined as any, SYNTAX_PRESETS.liquid)).toBe(false);
    });
});

describe('restoreMergeTagMarkup with regex special chars', () => {
    it('handles merge tag values containing regex special characters', () => {
        const specialTags: MergeTag[] = [
            { label: 'Price', value: '{{price.$total}}' },
        ];
        const html = 'Total: {{price.$total}}';
        const result = restoreMergeTagMarkup(html, specialTags, SYNTAX_PRESETS.liquid);
        expect(result).toContain('data-merge-tag="{{price.$total}}"');
        expect(result).toContain('>Price<');
    });

    it('handles merge tag values with parentheses', () => {
        const specialTags: MergeTag[] = [
            { label: 'Calc', value: '{{calc(1+2)}}' },
        ];
        const html = 'Result: {{calc(1+2)}}';
        const result = restoreMergeTagMarkup(html, specialTags, SYNTAX_PRESETS.liquid);
        expect(result).toContain('data-merge-tag="{{calc(1+2)}}"');
    });
});

describe('getMergeTagLabel cross-syntax', () => {
    it('returns label for handlebars syntax tags', () => {
        const hbTags: MergeTag[] = [{ label: 'Name', value: '{{name}}' }];
        expect(getMergeTagLabel('{{name}}', hbTags)).toBe('Name');
    });

    it('returns label for mailchimp syntax tags', () => {
        const mcTags: MergeTag[] = [{ label: 'First Name', value: '*|FNAME|*' }];
        expect(getMergeTagLabel('*|FNAME|*', mcTags)).toBe('First Name');
    });

    it('returns label for ampscript syntax tags', () => {
        const ampTags: MergeTag[] = [{ label: 'Variable', value: '%%=v(@var)=%%' }];
        expect(getMergeTagLabel('%%=v(@var)=%%', ampTags)).toBe('Variable');
    });
});

describe('isMergeTagValue cross-syntax', () => {
    it('works with liquid syntax', () => {
        expect(isMergeTagValue('{{name}}', SYNTAX_PRESETS.liquid)).toBe(true);
    });

    it('returns false for mailchimp syntax with liquid tag', () => {
        expect(isMergeTagValue('{{name}}', SYNTAX_PRESETS.mailchimp)).toBe(false);
    });

    it('returns false for ampscript syntax with liquid tag', () => {
        expect(isMergeTagValue('{{name}}', SYNTAX_PRESETS.ampscript)).toBe(false);
    });
});

describe('containsMergeTag with empty string', () => {
    it('returns false for empty string with all syntaxes', () => {
        expect(containsMergeTag('', SYNTAX_PRESETS.liquid)).toBe(false);
        expect(containsMergeTag('', SYNTAX_PRESETS.handlebars)).toBe(false);
        expect(containsMergeTag('', SYNTAX_PRESETS.mailchimp)).toBe(false);
        expect(containsMergeTag('', SYNTAX_PRESETS.ampscript)).toBe(false);
    });

    it('returns false for null-ish input', () => {
        expect(containsMergeTag(null as any, SYNTAX_PRESETS.liquid)).toBe(false);
        expect(containsMergeTag(undefined as any, SYNTAX_PRESETS.liquid)).toBe(false);
    });
});

describe('containsMergeTag with ampscript syntax', () => {
    it('detects ampscript value tags', () => {
        expect(containsMergeTag('Hello %%=v(@name)=%%', SYNTAX_PRESETS.ampscript)).toBe(true);
    });

    it('detects ampscript logic tags', () => {
        expect(containsMergeTag('%%[IF @active]%%', SYNTAX_PRESETS.ampscript)).toBe(true);
    });
});
