import './dom-stubs';

import { describe, expect, it } from 'vitest';
import { blockTypeIcons } from '../src/utils/blockTypeIcons';

const expectedKeys = [
  'section',
  'title',
  'paragraph',
  'image',
  'text',
  'button',
  'divider',
  'video',
  'social',
  'menu',
  'table',
  'spacer',
  'countdown',
  'html',
];

describe('blockTypeIcons', () => {
  it('has exactly 14 entries', () => {
    expect(Object.keys(blockTypeIcons)).toHaveLength(14);
  });

  it('contains all expected keys', () => {
    for (const key of expectedKeys) {
      expect(blockTypeIcons).toHaveProperty(key);
    }
  });

  it('each value is a Vue component object', () => {
    for (const key of expectedKeys) {
      const icon = blockTypeIcons[key];
      expect(icon, `${key} icon should be a component`).toEqual(
        expect.objectContaining({ name: expect.any(String) }),
      );
    }
  });

  it('has no unexpected keys', () => {
    const actualKeys = Object.keys(blockTypeIcons).sort();
    expect(actualKeys).toEqual([...expectedKeys].sort());
  });
});
