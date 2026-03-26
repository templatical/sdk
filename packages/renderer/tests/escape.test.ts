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

  it('handles nested merge tag spans', () => {
    // Outer span with inner content that includes another span
    const html = '<span data-merge-tag="{{outer}}"><span data-merge-tag="{{inner}}">Inner</span></span>';
    const result = convertMergeTagsToValues(html);
    // The /s flag makes .*? match across the inner </span>, so the outer
    // replacement consumes everything up to the first </span> it finds.
    // The outer tag value replaces the whole thing, leaving a trailing </span>.
    expect(result).toBe('{{outer}}</span>');
  });

  it('handles malformed HTML with unclosed spans gracefully', () => {
    const html = '<span data-merge-tag="{{name}}">unclosed';
    // The regex requires a closing </span>, so this should not match
    const result = convertMergeTagsToValues(html);
    expect(result).toBe(html);
  });

  it('handles merge tag with extra attributes', () => {
    const html = '<span class="tag" data-merge-tag="{{name}}" style="color:red">Label</span>';
    expect(convertMergeTagsToValues(html)).toBe('{{name}}');
  });

  it('handles logic merge tag with extra attributes', () => {
    const html = '<span class="logic" data-logic-merge-tag="{% if active %}" style="color:blue">IF</span>';
    expect(convertMergeTagsToValues(html)).toBe('{% if active %}');
  });
});
