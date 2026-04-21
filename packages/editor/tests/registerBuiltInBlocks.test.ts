import './dom-stubs';
import { describe, expect, it, vi } from 'vitest';
import { registerBuiltInBlocks } from '../src/utils/registerBuiltInBlocks';
import { useBlockRegistry } from '../src/composables/useBlockRegistry';

const ALL_BLOCK_TYPES = [
  'section',
  'title',
  'paragraph',
  'image',
  'button',
  'divider',
  'video',
  'social',
  'menu',
  'table',
  'spacer',
  'html',
  'countdown',
];

function makeDummyComponent(name: string) {
  return { name, render: () => null } as any;
}

function makeFullComponentMap(): Record<string, any> {
  const map: Record<string, any> = {};
  for (const type of ALL_BLOCK_TYPES) {
    map[type] = makeDummyComponent(type);
  }
  return map;
}

describe('registerBuiltInBlocks', () => {
  it('registers all 13 block types when all components are provided', () => {
    const registry = useBlockRegistry();
    registerBuiltInBlocks(registry, makeFullComponentMap());

    for (const type of ALL_BLOCK_TYPES) {
      expect(registry.isRegistered(type)).toBe(true);
    }
    expect(registry.getSidebarItems()).toHaveLength(13);
  });

  it('each registered block creates a block of the correct type', () => {
    const registry = useBlockRegistry();
    registerBuiltInBlocks(registry, makeFullComponentMap());

    for (const type of ALL_BLOCK_TYPES) {
      const block = registry.createBlock(type);
      expect(block).not.toBeUndefined();
      expect(block!.type).toBe(type);
    }
  });

  it('each registered block resolves to the correct component', () => {
    const registry = useBlockRegistry();
    const componentMap = makeFullComponentMap();
    registerBuiltInBlocks(registry, componentMap);

    for (const type of ALL_BLOCK_TYPES) {
      const block = { id: 'test', type } as any;
      expect(registry.getComponent(block)).toBe(componentMap[type]);
    }
  });

  it('all sidebar items are marked as isCustom: false', () => {
    const registry = useBlockRegistry();
    registerBuiltInBlocks(registry, makeFullComponentMap());

    for (const item of registry.getSidebarItems()) {
      expect(item.isCustom).toBe(false);
    }
  });

  it('each sidebar item has a non-empty label', () => {
    const registry = useBlockRegistry();
    registerBuiltInBlocks(registry, makeFullComponentMap());

    for (const item of registry.getSidebarItems()) {
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it('skips block types that have no matching component in the map', () => {
    const registry = useBlockRegistry();
    const partialMap: Record<string, any> = {
      title: makeDummyComponent('title'),
      image: makeDummyComponent('image'),
      button: makeDummyComponent('button'),
    };

    registerBuiltInBlocks(registry, partialMap);

    expect(registry.isRegistered('title')).toBe(true);
    expect(registry.isRegistered('image')).toBe(true);
    expect(registry.isRegistered('button')).toBe(true);
    expect(registry.isRegistered('section')).toBe(false);
    expect(registry.isRegistered('paragraph')).toBe(false);
    expect(registry.isRegistered('divider')).toBe(false);
    expect(registry.getSidebarItems()).toHaveLength(3);
  });

  it('registers nothing when given an empty component map', () => {
    const registry = useBlockRegistry();
    registerBuiltInBlocks(registry, {});

    expect(registry.getSidebarItems()).toHaveLength(0);
    for (const type of ALL_BLOCK_TYPES) {
      expect(registry.isRegistered(type)).toBe(false);
    }
  });

  it('calls registry.registerBuiltIn once per block type with a well-formed registration', () => {
    const registry = useBlockRegistry();
    const spy = vi.spyOn(registry, 'registerBuiltIn');

    registerBuiltInBlocks(registry, makeFullComponentMap());

    expect(spy).toHaveBeenCalledTimes(13);
    for (const call of spy.mock.calls) {
      expect(ALL_BLOCK_TYPES).toContain(call[0]);
      expect(call[1]).toHaveProperty('component');
      expect(call[1]).toHaveProperty('createBlock');
      expect(call[1]).toHaveProperty('sidebarItem');
    }
  });
});
