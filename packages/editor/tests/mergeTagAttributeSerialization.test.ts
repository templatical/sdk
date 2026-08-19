// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { generateHTML, generateJSON } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

// The node views are irrelevant to serialization (generateHTML goes through the
// schema's toDOM, not the node view) but the modules import them.
vi.mock('../src/extensions/MergeTagNodeView.vue', () => ({ default: {} }));
vi.mock('../src/extensions/LogicMergeTagNodeView.vue', () => ({ default: {} }));

import { MergeTagNode } from '../src/extensions/MergeTagNode';
import { LogicMergeTagNode } from '../src/extensions/LogicMergeTagNode';

const mergeTags = [{ label: 'First Name', value: '{{first_name}}' }];

const extensions = [
  StarterKit,
  MergeTagNode.configure({ mergeTags }),
  LogicMergeTagNode,
];

function attributeNamesOf(html: string, selector: string): string[] {
  const host = document.createElement('div');
  host.innerHTML = html;
  const el = host.querySelector(selector);
  if (!el) {
    throw new Error(`no element matched ${selector} in: ${html}`);
  }
  return el.getAttributeNames().sort();
}

function docWith(node: Record<string, unknown>) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [node] }],
  };
}

describe('merge tag attribute serialization', () => {
  describe('MergeTagNode', () => {
    it('serializes only the canonical data-* pair', () => {
      const html = generateHTML(
        docWith({
          type: 'mergeTagNode',
          attrs: { label: 'First Name', value: '{{first_name}}' },
        }),
        extensions,
      );

      expect(attributeNamesOf(html, 'span[data-merge-tag]')).toEqual([
        'data-label',
        'data-merge-tag',
      ]);
    });

    it('still parses content carrying legacy label / value attributes', () => {
      const json = generateJSON(
        '<p><span label="First Name" value="{{first_name}}" data-merge-tag="{{first_name}}" data-label="First Name">First Name</span></p>',
        extensions,
      );

      const node = (json as any).content[0].content[0];
      expect(node.type).toBe('mergeTagNode');
      expect(node.attrs).toEqual({
        label: 'First Name',
        value: '{{first_name}}',
      });
    });

    it('drops the legacy attributes on re-serialization and keeps the label', () => {
      const legacy =
        '<p><span label="First Name" value="{{first_name}}" data-merge-tag="{{first_name}}" data-label="First Name">First Name</span></p>';

      const html = generateHTML(generateJSON(legacy, extensions), extensions);

      expect(attributeNamesOf(html, 'span[data-merge-tag]')).toEqual([
        'data-label',
        'data-merge-tag',
      ]);

      const host = document.createElement('div');
      host.innerHTML = html;
      const span = host.querySelector('span[data-merge-tag]')!;
      expect(span.getAttribute('data-merge-tag')).toBe('{{first_name}}');
      expect(span.getAttribute('data-label')).toBe('First Name');
      expect(span.textContent).toBe('First Name');
    });
  });

  describe('LogicMergeTagNode', () => {
    it('serializes only the canonical data-* pair', () => {
      const html = generateHTML(
        docWith({
          type: 'logicMergeTagNode',
          attrs: { value: '{% if vip %}', keyword: 'IF' },
        }),
        extensions,
      );

      expect(attributeNamesOf(html, 'span[data-logic-merge-tag]')).toEqual([
        'data-keyword',
        'data-logic-merge-tag',
      ]);
    });

    it('still parses content carrying legacy value / keyword attributes', () => {
      const json = generateJSON(
        '<p><span value="{% if vip %}" keyword="IF" data-logic-merge-tag="{% if vip %}" data-keyword="IF">IF</span></p>',
        extensions,
      );

      const node = (json as any).content[0].content[0];
      expect(node.type).toBe('logicMergeTagNode');
      expect(node.attrs).toEqual({ value: '{% if vip %}', keyword: 'IF' });
    });

    it('drops the legacy attributes on re-serialization and keeps the keyword', () => {
      const legacy =
        '<p><span value="{% if vip %}" keyword="IF" data-logic-merge-tag="{% if vip %}" data-keyword="IF">IF</span></p>';

      const html = generateHTML(generateJSON(legacy, extensions), extensions);

      expect(attributeNamesOf(html, 'span[data-logic-merge-tag]')).toEqual([
        'data-keyword',
        'data-logic-merge-tag',
      ]);

      const host = document.createElement('div');
      host.innerHTML = html;
      const span = host.querySelector('span[data-logic-merge-tag]')!;
      expect(span.getAttribute('data-logic-merge-tag')).toBe('{% if vip %}');
      expect(span.getAttribute('data-keyword')).toBe('IF');
      expect(span.textContent).toBe('IF');
    });
  });
});
