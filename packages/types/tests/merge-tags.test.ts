import { describe, expect, it } from 'vitest';
import {
    isMergeTagValue,
    getMergeTagLabel,
    getMergeTagSample,
    hasMergeTagSamples,
    substituteHtmlMergeTagSamples,
    substituteTextMergeTagSamples,
    containsMergeTag,
    isLogicMergeTagValue,
    getLogicMergeTagKeyword,
    resolveHtmlMergeTagLabels,
    resolveHtmlLogicMergeTagLabels,
    resolveSyntax,
    SYNTAX_PRESETS,
    getSyntaxTriggerChar,
    getSyntaxClosingChar,
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

    it('returns label when description is set (description does not leak into label rendering)', () => {
        const enriched: MergeTag[] = [
            { label: 'First Name', value: '{{first_name}}', description: 'Recipient first name' },
        ];
        expect(getMergeTagLabel('{{first_name}}', enriched)).toBe('First Name');
    });

    it('returns label when group is set', () => {
        const grouped: MergeTag[] = [
            { label: 'First Name', value: '{{first_name}}', group: 'Recipient' },
        ];
        expect(getMergeTagLabel('{{first_name}}', grouped)).toBe('First Name');
    });
});

describe('MergeTag interface — optional fields', () => {
    it('accepts the baseline shape (label + value only)', () => {
        const tag: MergeTag = { label: 'Email', value: '{{email}}' };
        expect(tag.value).toBe('{{email}}');
        expect(tag.group).toBeUndefined();
        expect(tag.description).toBeUndefined();
    });

    it('accepts label + value + group', () => {
        const tag: MergeTag = { label: 'First Name', value: '{{first_name}}', group: 'Recipient' };
        expect(tag.group).toBe('Recipient');
        expect(tag.description).toBeUndefined();
    });

    it('accepts label + value + description', () => {
        const tag: MergeTag = {
            label: 'Unsubscribe URL',
            value: '{{unsubscribe_url}}',
            description: 'Required by anti-spam legislation',
        };
        expect(tag.description).toBe('Required by anti-spam legislation');
        expect(tag.group).toBeUndefined();
    });

    it('accepts label + value + group + description', () => {
        const tag: MergeTag = {
            label: 'Company',
            value: '{{company.name}}',
            group: 'Account',
            description: 'Recipient organization',
        };
        expect(tag.group).toBe('Account');
        expect(tag.description).toBe('Recipient organization');
    });

    it('isMergeTagValue is unaffected when group/description are set', () => {
        const enriched: MergeTag[] = [
            { label: 'First Name', value: '{{first_name}}', group: 'Recipient', description: 'desc' },
        ];
        expect(isMergeTagValue(enriched[0]!.value, liquidSyntax)).toBe(true);
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

    it('updates multiple spans in one pass', () => {
        const html =
            '<span data-merge-tag="{{first_name}}">x</span> and ' +
            '<span data-merge-tag="{{first_name}}">y</span>';
        const result = resolveHtmlMergeTagLabels(html, tags);
        expect(result).toBe(
            '<span data-merge-tag="{{first_name}}">First Name</span> and ' +
            '<span data-merge-tag="{{first_name}}">First Name</span>',
        );
    });

    it('leaves spans without data-merge-tag unchanged', () => {
        const html = '<span class="other">stay</span>';
        expect(resolveHtmlMergeTagLabels(html, tags)).toBe(html);
    });

    it('rewrites a merge-tag span nested inside a plain span', () => {
        const html =
            '<span class="x"><span data-merge-tag="{{first_name}}">old</span></span>';
        const result = resolveHtmlMergeTagLabels(html, tags);
        expect(result).toBe(
            '<span class="x"><span data-merge-tag="{{first_name}}">First Name</span></span>',
        );
    });

    // Regression: the old `/<span[^>]*\sdata-merge-tag="..."[^>]*>(.*?)<\/span>/g`
    // pattern was polynomial-ReDoS — every `<span` start re-scanned the rest of
    // the input for a closing `>`. A 10k-char adversarial input below would
    // stall the regex for seconds. The linear scanner completes in ms.
    it('runs in linear time on adversarial `<span<span<span…` input (ReDoS regression)', () => {
        const adversarial = '<span'.repeat(10_000);
        const start = Date.now();
        const result = resolveHtmlMergeTagLabels(adversarial, tags);
        const elapsed = Date.now() - start;
        // Output should be unchanged (no closing `>`, no rewrite to do).
        expect(result).toBe(adversarial);
        // Generous bound for CI variance — old regex would push 10s+.
        expect(elapsed).toBeLessThan(500);
    });

    it('runs in linear time on `<span data-merge-tag=""…` repeats (ReDoS regression)', () => {
        const adversarial =
            '<span data-merge-tag=""'.repeat(5_000);
        const start = Date.now();
        const result = resolveHtmlMergeTagLabels(adversarial, tags);
        const elapsed = Date.now() - start;
        // No closing `>` on any span — none should be rewritten.
        expect(result).toBe(adversarial);
        expect(elapsed).toBeLessThan(500);
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

    it('runs in linear time on adversarial `<span<span…` input (ReDoS regression)', () => {
        const adversarial = '<span'.repeat(10_000);
        const start = Date.now();
        const result = resolveHtmlLogicMergeTagLabels(
            adversarial,
            SYNTAX_PRESETS.liquid,
        );
        const elapsed = Date.now() - start;
        expect(result).toBe(adversarial);
        expect(elapsed).toBeLessThan(500);
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

describe('getSyntaxTriggerChar', () => {
    it('returns "{{" for liquid preset', () => {
        
        expect(getSyntaxTriggerChar(SYNTAX_PRESETS.liquid)).toBe('{{');
    });

    it('returns "{{" for handlebars preset', () => {
        
        expect(getSyntaxTriggerChar(SYNTAX_PRESETS.handlebars)).toBe('{{');
    });

    it('returns "*|" for mailchimp preset', () => {
        
        expect(getSyntaxTriggerChar(SYNTAX_PRESETS.mailchimp)).toBe('*|');
    });

    it('returns "%%=" for ampscript preset', () => {
        
        expect(getSyntaxTriggerChar(SYNTAX_PRESETS.ampscript)).toBe('%%=');
    });

    it('works with resolveSyntax output', () => {
        
        expect(getSyntaxTriggerChar(resolveSyntax('liquid'))).toBe('{{');
        expect(getSyntaxTriggerChar(resolveSyntax('mailchimp'))).toBe('*|');
    });

    it('returns null for custom syntax', () => {
        
        const custom = { value: /<<.+?>>/g, logic: /<%.+?%>/g };
        expect(getSyntaxTriggerChar(custom)).toBe(null);
    });

    it('returns null for empty regex', () => {
        
        const empty = { value: /(?:)/g, logic: /(?:)/g };
        expect(getSyntaxTriggerChar(empty)).toBe(null);
    });

    it('matches by source even when regex flags differ', () => {

        const cloned = {
            value: new RegExp(SYNTAX_PRESETS.liquid.value.source, 'gi'),
            logic: SYNTAX_PRESETS.liquid.logic,
        };
        expect(getSyntaxTriggerChar(cloned)).toBe('{{');
    });
});

describe('getSyntaxClosingChar', () => {
    it('returns "}}" for liquid preset', () => {
        expect(getSyntaxClosingChar(SYNTAX_PRESETS.liquid)).toBe('}}');
    });

    it('returns "}}" for handlebars preset', () => {
        expect(getSyntaxClosingChar(SYNTAX_PRESETS.handlebars)).toBe('}}');
    });

    it('returns "|*" for mailchimp preset', () => {
        expect(getSyntaxClosingChar(SYNTAX_PRESETS.mailchimp)).toBe('|*');
    });

    it('returns "=%%" for ampscript preset', () => {
        expect(getSyntaxClosingChar(SYNTAX_PRESETS.ampscript)).toBe('=%%');
    });

    it('works with resolveSyntax output', () => {
        expect(getSyntaxClosingChar(resolveSyntax('liquid'))).toBe('}}');
        expect(getSyntaxClosingChar(resolveSyntax('ampscript'))).toBe('=%%');
    });

    it('returns null for custom syntax', () => {
        const custom = { value: /<<.+?>>/g, logic: /<%.+?%>/g };
        expect(getSyntaxClosingChar(custom)).toBe(null);
    });

    it('matches by source even when regex flags differ', () => {
        const cloned = {
            value: new RegExp(SYNTAX_PRESETS.liquid.value.source, 'gi'),
            logic: SYNTAX_PRESETS.liquid.logic,
        };
        expect(getSyntaxClosingChar(cloned)).toBe('}}');
    });
});

/**
 * Sample values — the previews' Sample mode.
 *
 * Two invariants carry the feature. First, a sample is *display-only*: the
 * substituted HTML must never be able to reach an export, which is asserted
 * end-to-end below by checking the token survives in the untouched content.
 * Second, Sample mode never shows a raw token — a tag without a sample falls
 * back to its label, not to `{{…}}`.
 */
const sampleTags: MergeTag[] = [
    { label: 'First Name', value: '{{first_name}}', sample: 'Ada' },
    { label: 'Plan Name', value: '{{plan}}' }, // deliberately no sample
];

describe('getMergeTagSample', () => {
    it('returns the configured sample', () => {
        expect(getMergeTagSample('{{first_name}}', sampleTags)).toBe('Ada');
    });

    it('returns undefined for a declared tag with no sample', () => {
        expect(getMergeTagSample('{{plan}}', sampleTags)).toBeUndefined();
    });

    it('returns undefined for an unknown token rather than echoing it', () => {
        // Deliberately unlike getMergeTagLabel, which falls back to the token.
        expect(getMergeTagSample('{{nope}}', sampleTags)).toBeUndefined();
        expect(getMergeTagLabel('{{nope}}', sampleTags)).toBe('{{nope}}');
    });
});

describe('substituteHtmlMergeTagSamples', () => {
    it('replaces the span with the bare sample, dropping the wrapper', () => {
        const html = '<p>Hi <span data-merge-tag="{{first_name}}">First Name</span>!</p>';

        const result = substituteHtmlMergeTagSamples(html, sampleTags);

        expect(result).toBe('<p>Hi Ada!</p>');
        // The wrapper is what carries the highlight; it must be gone.
        expect(result).not.toContain('<span');
        expect(result).not.toContain('data-merge-tag');
    });

    it('KEEPS the span for a tag with no sample, so its highlight survives', () => {
        // Per-tag, not per-mode: a sample-less tag stays visibly dynamic, and the
        // surviving highlight doubles as a signal that a sample is still unset.
        const html = '<p><span data-merge-tag="{{plan}}">Plan Name</span></p>';

        const result = substituteHtmlMergeTagSamples(html, sampleTags);

        expect(result).toBe(
            '<p><span data-merge-tag="{{plan}}">Plan Name</span></p>',
        );
    });

    it('unwraps only the sampled tag when a string mixes both', () => {
        const html =
            '<p><span data-merge-tag="{{first_name}}">x</span> on <span data-merge-tag="{{plan}}">y</span></p>';

        expect(substituteHtmlMergeTagSamples(html, sampleTags)).toBe(
            '<p>Ada on <span data-merge-tag="{{plan}}">Plan Name</span></p>',
        );
    });

    it('leaves logic tag spans completely untouched', () => {
        // Logic needs evaluation, not substitution — explicitly out of scope.
        const html =
            '<p><span data-logic-merge-tag="{% if vip %}">IF</span><span data-merge-tag="{{first_name}}">First Name</span></p>';

        const result = substituteHtmlMergeTagSamples(html, sampleTags);

        expect(result).toContain('<span data-logic-merge-tag="{% if vip %}">IF</span>');
        expect(result).toContain('Ada');
    });

    it('escapes a sample containing markup so it cannot alter the HTML', () => {
        const nasty: MergeTag[] = [
            { label: 'Bio', value: '{{bio}}', sample: '<img src=x onerror="alert(1)">' },
        ];
        const html = '<p><span data-merge-tag="{{bio}}">Bio</span></p>';

        const result = substituteHtmlMergeTagSamples(html, nasty);

        expect(result).toBe('<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>');
        expect(result).not.toContain('<img');
    });

    it('leaves html with no merge tag spans byte-identical', () => {
        const html = '<p>Nothing dynamic here</p>';
        expect(substituteHtmlMergeTagSamples(html, sampleTags)).toBe(html);
    });

    it('does not mutate the input string', () => {
        const html = '<p><span data-merge-tag="{{first_name}}">First Name</span></p>';
        const before = html;

        substituteHtmlMergeTagSamples(html, sampleTags);

        expect(html).toBe(before);
    });
});

describe('substituteTextMergeTagSamples', () => {
    it('replaces a declared token with its sample', () => {
        expect(substituteTextMergeTagSamples('Hi {{first_name}}!', sampleTags)).toBe(
            'Hi Ada!',
        );
    });

    it('leaves a token with no sample as the raw token', () => {
        // Unlike the HTML path: here a missing sample stays visible, which is
        // what tells an author a sample is still unset.
        expect(substituteTextMergeTagSamples('Plan: {{plan}}', sampleTags)).toBe(
            'Plan: {{plan}}',
        );
    });

    it('replaces every occurrence of the same token', () => {
        expect(
            substituteTextMergeTagSamples('{{first_name}} {{first_name}}', sampleTags),
        ).toBe('Ada Ada');
    });

    it('substitutes inside a URL', () => {
        expect(
            substituteTextMergeTagSamples('https://x.test/u/{{first_name}}', sampleTags),
        ).toBe('https://x.test/u/Ada');
    });

    it('handles tokens containing regex metacharacters', () => {
        // Mailchimp/ampscript syntaxes use *|…|* and %%=…=%%; a RegExp-based
        // implementation would need escaping, split/join does not.
        const odd: MergeTag[] = [
            { label: 'First', value: '*|FNAME|*', sample: 'Ada' },
            { label: 'Amp', value: '%%=v(@x)=%%', sample: 'Grace' },
        ];

        expect(substituteTextMergeTagSamples('Hi *|FNAME|* and %%=v(@x)=%%', odd)).toBe(
            'Hi Ada and Grace',
        );
    });

    it('returns an empty string unchanged', () => {
        expect(substituteTextMergeTagSamples('', sampleTags)).toBe('');
    });

    it('leaves text with no tokens byte-identical', () => {
        expect(substituteTextMergeTagSamples('plain text', sampleTags)).toBe('plain text');
    });
});

describe('hasMergeTagSamples', () => {
    it('is true when any tag declares a sample', () => {
        expect(hasMergeTagSamples(sampleTags)).toBe(true);
    });

    it('is false when no tag declares one', () => {
        // The gate for the whole feature: no samples ⇒ Label view by default and
        // no toggle, so a consumer who never sets `sample` sees no change at all.
        expect(hasMergeTagSamples(tags)).toBe(false);
    });

    it('is false for an empty tag list', () => {
        expect(hasMergeTagSamples([])).toBe(false);
    });

    it('is true for an empty-string sample, which is a deliberate blank', () => {
        // `''` is a configured choice ("render nothing here"), unlike undefined.
        expect(
            hasMergeTagSamples([{ label: 'X', value: '{{x}}', sample: '' }]),
        ).toBe(true);
    });
});

// Regression (#543): a consumer-configured custom `mergeTags.syntax` whose tag
// values contain `<` / `>` — e.g. Smarty-style `<% $email %>` — reaches the
// attribute as literal characters, because HTML attribute serialization escapes
// only `&`, `"` and nbsp. The span scanner used to stop at the first `>`
// regardless of quoting, so neither Label nor Sample mode resolved anything.
describe('angle-bracket tag values (custom syntax)', () => {
    const smartyTags: MergeTag[] = [
        { label: 'E-Mail', value: '<% $email %>', sample: 'foo@example.com' },
        { label: 'Nickname', value: '[[a<b]]', sample: 'Ada' },
    ];

    const smartySyntax = {
        value: /<%\s*\$[^%]*%>/g,
        logic: /<%\s*(?!\$)(\w+)[^%]*%>/g,
    };

    it('resolves the label of a value containing `<` and `>`', () => {
        const html =
            '<p>Hi <span data-merge-tag="<% $email %>">stale</span>,</p>';
        expect(resolveHtmlMergeTagLabels(html, smartyTags)).toBe(
            '<p>Hi <span data-merge-tag="<% $email %>">E-Mail</span>,</p>',
        );
    });

    it('resolves the label of a value containing `<` only', () => {
        const html = '<span data-merge-tag="[[a<b]]">stale</span>';
        expect(resolveHtmlMergeTagLabels(html, smartyTags)).toBe(
            '<span data-merge-tag="[[a<b]]">Nickname</span>',
        );
    });

    it('substitutes the sample and unwraps the span', () => {
        const html =
            '<p>Hi <span data-merge-tag="<% $email %>">E-Mail</span>,</p>';
        expect(substituteHtmlMergeTagSamples(html, smartyTags)).toBe(
            '<p>Hi foo@example.com,</p>',
        );
    });

    it('keeps the span and shows the label when no sample is configured', () => {
        const html = '<span data-merge-tag="<% $phone %>">stale</span>';
        expect(substituteHtmlMergeTagSamples(html, smartyTags)).toBe(
            // Unknown tag: the label falls back to the raw value (escaped, since
            // it is being inlined as text), and the span survives.
            '<span data-merge-tag="<% $phone %>">&lt;% $phone %&gt;</span>',
        );
    });

    it('resolves a logic tag whose syntax contains `<` and `>`', () => {
        const html =
            '<span data-logic-merge-tag="<% if $active %>">stale</span>';
        expect(resolveHtmlLogicMergeTagLabels(html, smartySyntax)).toBe(
            '<span data-logic-merge-tag="<% if $active %>">IF</span>',
        );
    });

    it('resolves a tag nested inside a styled span', () => {
        const html =
            '<span style="color: red"><span data-merge-tag="<% $email %>">stale</span></span>';
        expect(resolveHtmlMergeTagLabels(html, smartyTags)).toBe(
            '<span style="color: red"><span data-merge-tag="<% $email %>">E-Mail</span></span>',
        );
    });

    it('runs in linear time when many tag values contain `>` (ReDoS regression)', () => {
        const adversarial =
            '<span data-merge-tag="<% $email %>">x</span>'.repeat(5_000);
        const start = Date.now();
        const result = resolveHtmlMergeTagLabels(adversarial, smartyTags);
        const elapsed = Date.now() - start;
        expect(result).toBe(
            '<span data-merge-tag="<% $email %>">E-Mail</span>'.repeat(5_000),
        );
        expect(elapsed).toBeLessThan(500);
    });
});

// Regression (#548). The editor serializes rich text with the tag value
// entity-encoded in the attribute, so stored content reads
// `data-merge-tag="&lt;% $email %&gt;"`. Comparing that raw against the
// configured `<% $email %>` missed, and the label fallback then wrote the
// escaped token *over* the correct label — the tag appeared to revert to its
// raw form the moment the block left edit mode.
describe('entity-encoded tag values in stored content', () => {
    const smartyTags: MergeTag[] = [
        { label: 'E-Mail', value: '<% $email %>', sample: 'test@example.com' },
    ];

    // Verbatim from the issue's `editor.getContent()`, `label`/`value`
    // attributes included — TipTap renders every node attr, so they are part
    // of the shape any fix has to cope with.
    const stored =
        '<p><span label="E-Mail" value="&lt;% $email %&gt;" data-merge-tag="&lt;% $email %&gt;" data-label="E-Mail">E-Mail</span></p>';

    it('resolves the label instead of echoing the escaped token', () => {
        expect(resolveHtmlMergeTagLabels(stored, smartyTags)).toBe(
            '<p><span label="E-Mail" value="&lt;% $email %&gt;" data-merge-tag="&lt;% $email %&gt;" data-label="E-Mail">E-Mail</span></p>',
        );
    });

    it('substitutes the sample rather than double-escaping the token', () => {
        // Previously produced `&amp;lt;% $email %&amp;gt;`, which renders on
        // screen as the literal text `&lt;% $email %&gt;`.
        expect(substituteHtmlMergeTagSamples(stored, smartyTags)).toBe(
            '<p>test@example.com</p>',
        );
    });

    it('resolves a logic tag stored with entity-encoded delimiters', () => {
        const html =
            '<span data-logic-merge-tag="&lt;% if $active %&gt;">stale</span>';
        expect(
            resolveHtmlLogicMergeTagLabels(html, {
                value: /<%\s*\$[^%]*%>/g,
                logic: /<%\s*(?!\$)(\w+)[^%]*%>/g,
            }),
        ).toBe(
            '<span data-logic-merge-tag="&lt;% if $active %&gt;">IF</span>',
        );
    });

    it('still resolves an unencoded attribute (#543 stays fixed)', () => {
        const html = '<span data-merge-tag="<% $email %>">stale</span>';
        expect(resolveHtmlMergeTagLabels(html, smartyTags)).toBe(
            '<span data-merge-tag="<% $email %>">E-Mail</span>',
        );
    });
});
