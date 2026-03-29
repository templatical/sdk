import { describe, expect, it } from 'vitest';
import { useBlockRegistry } from '../src/composables/useBlockRegistry';
import type { Block, CustomBlockDefinition } from '@templatical/types';
import { defineComponent } from 'vue';

const DummyComponent = defineComponent({ template: '<div>test</div>' });

function createMockBlock(type: string, id = 'b1'): Block {
  return { id, type } as Block;
}

function createCustomBlockDef(
  type: string,
  name: string,
): CustomBlockDefinition {
  return {
    type,
    name,
    template: '<div>{{title}}</div>',
    fields: [{ key: 'title', type: 'text', label: 'Title', default: '' }],
  } as CustomBlockDefinition;
}

describe('useBlockRegistry', () => {
  describe('registerBuiltIn', () => {
    it('registers a built-in block type', () => {
      const registry = useBlockRegistry();

      registry.registerBuiltIn('text', {
        component: DummyComponent,
        createBlock: () => createMockBlock('text'),
        sidebarItem: { type: 'text', label: 'Text', isCustom: false },
      });

      expect(registry.isRegistered('text')).toBe(true);
    });

    it('getComponent returns the registered component', () => {
      const registry = useBlockRegistry();

      registry.registerBuiltIn('image', {
        component: DummyComponent,
        createBlock: () => createMockBlock('image'),
        sidebarItem: { type: 'image', label: 'Image', isCustom: false },
      });

      const component = registry.getComponent(createMockBlock('image'));
      expect(component).toBe(DummyComponent);
    });

    it('createBlock returns a new block instance', () => {
      const registry = useBlockRegistry();

      registry.registerBuiltIn('text', {
        component: DummyComponent,
        createBlock: () => createMockBlock('text', 'new-id'),
        sidebarItem: { type: 'text', label: 'Text', isCustom: false },
      });

      const block = registry.createBlock('text');
      expect(block).not.toBeNull();
      expect(block!.type).toBe('text');
      expect(block!.id).toBe('new-id');
    });
  });

  describe('registerCustom', () => {
    it('registers a custom block with custom: prefix', () => {
      const registry = useBlockRegistry();
      const def = createCustomBlockDef('hero', 'Hero Banner');

      registry.registerCustom(def, DummyComponent);

      expect(registry.isRegistered('custom:hero')).toBe(true);
      expect(registry.isRegistered('hero')).toBe(false);
    });

    it('getComponent resolves custom blocks via customType', () => {
      const registry = useBlockRegistry();
      const def = createCustomBlockDef('hero', 'Hero Banner');

      registry.registerCustom(def, DummyComponent);

      const block = { id: 'b1', type: 'custom', customType: 'hero' } as any;
      expect(registry.getComponent(block)).toBe(DummyComponent);
    });

    it('getDefinition returns the original definition', () => {
      const registry = useBlockRegistry();
      const def = createCustomBlockDef('hero', 'Hero Banner');

      registry.registerCustom(def, DummyComponent);

      const retrieved = registry.getDefinition('hero');
      expect(retrieved).toBe(def);
    });
  });

  describe('getSidebarItems', () => {
    it('returns built-in before custom items', () => {
      const registry = useBlockRegistry();

      registry.registerBuiltIn('text', {
        component: DummyComponent,
        createBlock: () => createMockBlock('text'),
        sidebarItem: { type: 'text', label: 'Text', isCustom: false },
      });

      registry.registerCustom(
        createCustomBlockDef('hero', 'Hero'),
        DummyComponent,
      );

      const items = registry.getSidebarItems();
      expect(items).toHaveLength(2);
      expect(items[0].isCustom).toBe(false);
      expect(items[1].isCustom).toBe(true);
    });

    it('custom sidebar items have correct metadata', () => {
      const registry = useBlockRegistry();
      const def = createCustomBlockDef('hero', 'Hero Banner');
      def.icon = '🎯';
      def.description = 'A hero banner';

      registry.registerCustom(def, DummyComponent);

      const items = registry.getSidebarItems();
      const heroItem = items.find((i) => i.type === 'custom:hero');
      expect(heroItem).not.toBeUndefined();
      expect(heroItem!.label).toBe('Hero Banner');
      expect(heroItem!.isCustom).toBe(true);
      expect(heroItem!.icon).toBe('🎯');
      expect(heroItem!.description).toBe('A hero banner');
    });
  });

  describe('edge cases', () => {
    it('isRegistered returns false for unknown type', () => {
      const registry = useBlockRegistry();
      expect(registry.isRegistered('unknown')).toBe(false);
    });

    it('getComponent returns undefined for unknown block', () => {
      const registry = useBlockRegistry();
      expect(registry.getComponent(createMockBlock('unknown'))).toBeUndefined();
    });

    it('createBlock returns undefined for unknown type', () => {
      const registry = useBlockRegistry();
      expect(registry.createBlock('unknown')).toBeUndefined();
    });

    it('getDefinition returns undefined for unknown custom type', () => {
      const registry = useBlockRegistry();
      expect(registry.getDefinition('unknown')).toBeUndefined();
    });
  });

  describe('renderCustomBlock', () => {
    it('returns fallback HTML when definition not found', async () => {
      const registry = useBlockRegistry();
      const block = {
        id: 'b1',
        type: 'custom',
        customType: 'nonexistent',
        fieldValues: {},
      } as any;

      const html = await registry.renderCustomBlock(block);
      expect(html).toContain('Block definition not found');
    });

    it('renders template with field values', async () => {
      const registry = useBlockRegistry();
      const def = createCustomBlockDef('hero', 'Hero');

      registry.registerCustom(def, DummyComponent);

      const block = {
        id: 'b1',
        type: 'custom',
        customType: 'hero',
        fieldValues: { title: 'Hello World' },
      } as any;

      const html = await registry.renderCustomBlock(block);
      expect(html).toContain('Hello World');
    });
  });

  describe('getSidebarItems (additional)', () => {
    it('returns empty array when nothing registered', () => {
      const registry = useBlockRegistry();
      const items = registry.getSidebarItems();
      expect(items).toEqual([]);
    });

    it('returns only built-in items when no custom blocks', () => {
      const registry = useBlockRegistry();

      registry.registerBuiltIn('text', {
        component: DummyComponent,
        createBlock: () => createMockBlock('text'),
        sidebarItem: { type: 'text', label: 'Text', isCustom: false },
      });

      registry.registerBuiltIn('image', {
        component: DummyComponent,
        createBlock: () => createMockBlock('image'),
        sidebarItem: { type: 'image', label: 'Image', isCustom: false },
      });

      const items = registry.getSidebarItems();
      expect(items).toHaveLength(2);
      expect(items.every((i) => !i.isCustom)).toBe(true);
    });

    it('returns only custom items when no built-in blocks', () => {
      const registry = useBlockRegistry();

      registry.registerCustom(createCustomBlockDef('hero', 'Hero'), DummyComponent);
      registry.registerCustom(createCustomBlockDef('cta', 'CTA'), DummyComponent);

      const items = registry.getSidebarItems();
      expect(items).toHaveLength(2);
      expect(items.every((i) => i.isCustom)).toBe(true);
    });
  });

  describe('overwriting registrations', () => {
    it('overwrites existing built-in registration', () => {
      const registry = useBlockRegistry();

      const OtherComponent = defineComponent({ template: '<span>other</span>' });

      registry.registerBuiltIn('text', {
        component: DummyComponent,
        createBlock: () => createMockBlock('text'),
        sidebarItem: { type: 'text', label: 'Text', isCustom: false },
      });

      registry.registerBuiltIn('text', {
        component: OtherComponent,
        createBlock: () => createMockBlock('text'),
        sidebarItem: { type: 'text', label: 'Rich Text', isCustom: false },
      });

      expect(registry.isRegistered('text')).toBe(true);
      expect(registry.getComponent(createMockBlock('text'))).toBe(OtherComponent);
      const items = registry.getSidebarItems();
      expect(items).toHaveLength(1);
      expect(items[0].label).toBe('Rich Text');
    });

    it('overwrites existing custom registration', () => {
      const registry = useBlockRegistry();

      const OtherComponent = defineComponent({ template: '<span>other</span>' });

      const def1 = createCustomBlockDef('hero', 'Hero v1');
      const def2 = createCustomBlockDef('hero', 'Hero v2');

      registry.registerCustom(def1, DummyComponent);
      registry.registerCustom(def2, OtherComponent);

      expect(registry.isRegistered('custom:hero')).toBe(true);
      const block = { id: 'b1', type: 'custom', customType: 'hero' } as any;
      expect(registry.getComponent(block)).toBe(OtherComponent);
      expect(registry.getDefinition('hero')?.name).toBe('Hero v2');
    });
  });

  describe('getDefinition (additional)', () => {
    it('returns undefined for built-in types', () => {
      const registry = useBlockRegistry();

      registry.registerBuiltIn('text', {
        component: DummyComponent,
        createBlock: () => createMockBlock('text'),
        sidebarItem: { type: 'text', label: 'Text', isCustom: false },
      });

      // getDefinition looks up "custom:text" which is not registered
      expect(registry.getDefinition('text')).toBeUndefined();
    });
  });

  describe('getComponent for custom blocks', () => {
    it('returns undefined for unregistered custom block type', () => {
      const registry = useBlockRegistry();
      const block = { id: 'b1', type: 'custom', customType: 'unknown' } as any;
      expect(registry.getComponent(block)).toBeUndefined();
    });
  });

  describe('createBlock from custom registration', () => {
    it('creates a custom block via registration key', () => {
      const registry = useBlockRegistry();
      const def = createCustomBlockDef('hero', 'Hero');

      registry.registerCustom(def, DummyComponent);

      const block = registry.createBlock('custom:hero');
      expect(block).not.toBeNull();
      expect(block!.type).toBe('custom');
      expect((block as any).customType).toBe('hero');
    });
  });
});
