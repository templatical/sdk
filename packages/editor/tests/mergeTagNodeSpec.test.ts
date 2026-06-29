import { describe, expect, it } from 'vitest';
import { SYNTAX_PRESETS, type SyntaxPreset } from '@templatical/types';
import { mergeTagNodeSpec } from '../src/utils/mergeTagNodeSpec';

const liquid = SYNTAX_PRESETS.liquid;

describe('mergeTagNodeSpec', () => {
  it('returns a data mergeTagNode for a data tag value', () => {
    const spec = mergeTagNodeSpec('{{first_name}}', 'First Name', liquid);
    expect(spec).toEqual({
      type: 'mergeTagNode',
      attrs: { label: 'First Name', value: '{{first_name}}' },
    });
  });

  it('returns a logicMergeTagNode for a logic tag value, deriving the keyword', () => {
    const spec = mergeTagNodeSpec('{% if vip %}', 'VIP block', liquid);
    expect(spec).toEqual({
      type: 'logicMergeTagNode',
      attrs: { value: '{% if vip %}', keyword: 'IF' },
    });
  });

  it('derives ENDIF for a closing logic tag', () => {
    const spec = mergeTagNodeSpec('{% endif %}', 'End', liquid);
    expect(spec.type).toBe('logicMergeTagNode');
    expect(spec.attrs).toEqual({ value: '{% endif %}', keyword: 'ENDIF' });
  });

  it('ignores the label for logic tags', () => {
    const spec = mergeTagNodeSpec('{% for item in items %}', 'irrelevant', liquid);
    expect(spec.type).toBe('logicMergeTagNode');
    expect((spec.attrs as { keyword: string }).keyword).toBe('FOR');
    expect(JSON.stringify(spec)).not.toContain('irrelevant');
  });

  it('whitelists data attrs to exactly label + value', () => {
    const spec = mergeTagNodeSpec('{{email}}', 'Email', liquid);
    expect(Object.keys(spec.attrs).sort()).toEqual(['label', 'value']);
  });

  it('detects handlebars logic tags ({{#if}})', () => {
    const spec = mergeTagNodeSpec('{{#if vip}}', 'VIP', SYNTAX_PRESETS.handlebars);
    expect(spec).toEqual({
      type: 'logicMergeTagNode',
      attrs: { value: '{{#if vip}}', keyword: 'IF' },
    });
  });

  it('treats handlebars data tags ({{name}}) as data', () => {
    const spec = mergeTagNodeSpec(
      '{{first_name}}',
      'First Name',
      SYNTAX_PRESETS.handlebars,
    );
    expect(spec.type).toBe('mergeTagNode');
  });

  it('honors a custom syntax preset', () => {
    const custom: SyntaxPreset = {
      value: /\$\{.+?\}/g,
      logic: /\$\[\s*(\w+).*?\]/g,
    };
    expect(mergeTagNodeSpec('${user.name}', 'User', custom).type).toBe(
      'mergeTagNode',
    );
    const logic = mergeTagNodeSpec('$[IF vip]', 'x', custom);
    expect(logic.type).toBe('logicMergeTagNode');
    expect((logic.attrs as { keyword: string }).keyword).toBe('IF');
  });
});
