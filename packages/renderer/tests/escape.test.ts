import { describe, expect, it } from 'vitest';
import { escapeHtml, escapeAttr, convertMergeTagsToValues } from '../src';

describe('escapeHtml', () => {
  it('escapes HTML entities', () => {
    expect(escapeHtml('Hello <b>World</b> & "test"')).toBe(
      'Hello &lt;b&gt;World&lt;/b&gt; &amp; &quot;test&quot;',
    );
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });
});

describe('escapeAttr', () => {
  it('escapes attribute values', () => {
    expect(escapeAttr('test "value" & <tag>')).toBe(
      'test &quot;value&quot; &amp; &lt;tag&gt;',
    );
  });
});

describe('convertMergeTagsToValues', () => {
  it('replaces merge tag spans with their values', () => {
    const html = 'Hello <span data-merge-tag="{{name}}">Name</span>!';
    expect(convertMergeTagsToValues(html)).toBe('Hello {{name}}!');
  });

  it('replaces logic merge tag spans with their values', () => {
    const html = '<span data-logic-merge-tag="{% if active %}">IF</span>';
    expect(convertMergeTagsToValues(html)).toBe('{% if active %}');
  });

  it('handles multiple merge tags', () => {
    const html =
      '<span data-merge-tag="{{first}}">F</span> <span data-merge-tag="{{last}}">L</span>';
    expect(convertMergeTagsToValues(html)).toBe('{{first}} {{last}}');
  });

  it('returns empty string for empty input', () => {
    expect(convertMergeTagsToValues('')).toBe('');
  });

  it('returns unchanged string with no merge tags', () => {
    expect(convertMergeTagsToValues('Hello World')).toBe('Hello World');
  });
});
