import { describe, expect, it } from 'vitest';
import {
    generateId,
    createTextBlock,
    createImageBlock,
    createButtonBlock,
    createDividerBlock,
    createSectionBlock,
    createVideoBlock,
    createSocialIconsBlock,
    createSpacerBlock,
    createHtmlBlock,
    createMenuBlock,
    createTableBlock,
    createCountdownBlock,
    createCustomBlock,
    createBlock,
    cloneBlock,
    type CustomBlockDefinition,
} from '../src';

describe('generateId', () => {
    it('returns a UUID string', () => {
        const id = generateId();
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('returns unique IDs', () => {
        const ids = new Set(Array.from({ length: 100 }, () => generateId()));
        expect(ids.size).toBe(100);
    });
});

describe('block factory functions', () => {
    it('creates a text block with defaults', () => {
        const block = createTextBlock();
        expect(block.type).toBe('text');
        expect(block.content).toBe('<p>Enter your text here</p>');
        expect(block.fontSize).toBe(16);
        expect(block.id).toMatch(/^[0-9a-f-]+$/);
    });

    it('creates a text block with partial overrides', () => {
        const block = createTextBlock({ fontSize: 24, color: '#000' });
        expect(block.fontSize).toBe(24);
        expect(block.color).toBe('#000');
        expect(block.type).toBe('text');
    });

    it('creates an image block with defaults', () => {
        const block = createImageBlock();
        expect(block.type).toBe('image');
        expect(block.src).toBe('');
        expect(block.width).toBe('full');
    });

    it('creates a button block with defaults', () => {
        const block = createButtonBlock();
        expect(block.type).toBe('button');
        expect(block.text).toBe('Click Here');
        expect(block.backgroundColor).toBe('#007bff');
    });

    it('creates a divider block with defaults', () => {
        const block = createDividerBlock();
        expect(block.type).toBe('divider');
        expect(block.lineStyle).toBe('solid');
    });

    it('creates a section block with defaults', () => {
        const block = createSectionBlock();
        expect(block.type).toBe('section');
        expect(block.columns).toBe('1');
        expect(block.children).toEqual([[]]);
    });

    it('creates a video block with defaults', () => {
        const block = createVideoBlock();
        expect(block.type).toBe('video');
        expect(block.url).toBe('');
    });

    it('creates a social icons block with defaults', () => {
        const block = createSocialIconsBlock();
        expect(block.type).toBe('social');
        expect(block.icons).toEqual([]);
    });

    it('creates a spacer block with defaults', () => {
        const block = createSpacerBlock();
        expect(block.type).toBe('spacer');
        expect(block.height).toBe(20);
    });

    it('creates an html block with defaults', () => {
        const block = createHtmlBlock();
        expect(block.type).toBe('html');
        expect(block.content).toBe('');
    });

    it('creates a menu block with defaults', () => {
        const block = createMenuBlock();
        expect(block.type).toBe('menu');
        expect(block.items).toEqual([]);
    });

    it('creates a table block with 3x3 grid', () => {
        const block = createTableBlock();
        expect(block.type).toBe('table');
        expect(block.rows).toHaveLength(3);
        expect(block.rows[0].cells).toHaveLength(3);
    });

    it('creates a countdown block with defaults', () => {
        const block = createCountdownBlock();
        expect(block.type).toBe('countdown');
        expect(block.showDays).toBe(true);
    });

    it('creates a custom block from definition', () => {
        const definition: CustomBlockDefinition = {
            type: 'product-card',
            name: 'Product Card',
            fields: [
                { key: 'title', label: 'Title', type: 'text', default: 'Hello' },
                { key: 'count', label: 'Count', type: 'number', default: 5 },
                { key: 'active', label: 'Active', type: 'boolean' },
            ],
            template: '<div>{{title}}</div>',
        };

        const block = createCustomBlock(definition);
        expect(block.type).toBe('custom');
        expect(block.customType).toBe('product-card');
        expect(block.fieldValues.title).toBe('Hello');
        expect(block.fieldValues.count).toBe(5);
        expect(block.fieldValues.active).toBe(false);
    });
});

describe('createBlock', () => {
    it('creates blocks by type string', () => {
        expect(createBlock('text').type).toBe('text');
        expect(createBlock('image').type).toBe('image');
        expect(createBlock('button').type).toBe('button');
        expect(createBlock('section').type).toBe('section');
        expect(createBlock('divider').type).toBe('divider');
        expect(createBlock('spacer').type).toBe('spacer');
        expect(createBlock('html').type).toBe('html');
        expect(createBlock('social').type).toBe('social');
        expect(createBlock('menu').type).toBe('menu');
        expect(createBlock('table').type).toBe('table');
        expect(createBlock('video').type).toBe('video');
        expect(createBlock('countdown').type).toBe('countdown');
    });

    it('throws for unknown block type', () => {
        expect(() => createBlock('unknown' as never)).toThrow('Unknown block type: unknown');
    });

    it('throws for custom block type (requires definition)', () => {
        expect(() => createBlock('custom' as never)).toThrow('Unknown block type: custom');
    });
});

describe('cloneBlock', () => {
    it('creates a deep copy with a new ID', () => {
        const original = createTextBlock({ content: '<p>Test</p>' });
        const cloned = cloneBlock(original);

        expect(cloned.id).not.toBe(original.id);
        expect(cloned.type).toBe('text');
        if (cloned.type === 'text') {
            expect(cloned.content).toBe('<p>Test</p>');
        }
    });

    it('recursively clones section children with new IDs', () => {
        const child = createTextBlock();
        const section = createSectionBlock({ children: [[child]] });
        const cloned = cloneBlock(section);

        expect(cloned.id).not.toBe(section.id);
        if (cloned.type === 'section') {
            expect(cloned.children[0][0].id).not.toBe(child.id);
        }
    });

    it('does not mutate the original', () => {
        const original = createButtonBlock({ text: 'Original' });
        const cloned = cloneBlock(original);
        if (cloned.type === 'button') {
            (cloned as { text: string }).text = 'Modified';
        }
        expect(original.text).toBe('Original');
    });

    it('recursively clones deeply nested sections (section within section)', () => {
        const innerChild = createTextBlock({ content: '<p>Inner</p>' });
        const innerSection = createSectionBlock({ children: [[innerChild]] });
        const outerSection = createSectionBlock({ children: [[innerSection]] });

        const cloned = cloneBlock(outerSection);

        expect(cloned.id).not.toBe(outerSection.id);
        if (cloned.type === 'section') {
            const clonedInner = cloned.children[0][0];
            expect(clonedInner.id).not.toBe(innerSection.id);
            if (clonedInner.type === 'section') {
                const clonedInnerChild = clonedInner.children[0][0];
                expect(clonedInnerChild.id).not.toBe(innerChild.id);
            }
        }
    });

    it('ensures ALL nested IDs are unique after cloning', () => {
        const child1 = createTextBlock();
        const child2 = createImageBlock();
        const child3 = createButtonBlock();
        const section = createSectionBlock({
            columns: '3',
            children: [[child1], [child2], [child3]],
        });
        const cloned = cloneBlock(section);

        const originalIds = [section.id, child1.id, child2.id, child3.id];
        const clonedIds: string[] = [cloned.id];
        if (cloned.type === 'section') {
            for (const col of cloned.children) {
                for (const block of col) {
                    clonedIds.push(block.id);
                }
            }
        }

        // No cloned ID should match any original ID
        for (const clonedId of clonedIds) {
            expect(originalIds).not.toContain(clonedId);
        }

        // All cloned IDs should be unique among themselves
        expect(new Set(clonedIds).size).toBe(clonedIds.length);
    });

    it('clones non-section block without touching children', () => {
        const block = createImageBlock({ src: 'https://example.com/img.png' });
        const cloned = cloneBlock(block);
        expect(cloned.id).not.toBe(block.id);
        if (cloned.type === 'image') {
            expect(cloned.src).toBe('https://example.com/img.png');
        }
    });
});

describe('createCustomBlock edge cases', () => {
    it('creates custom block with empty fields array', () => {
        const definition: CustomBlockDefinition = {
            type: 'empty-block',
            name: 'Empty Block',
            fields: [],
            template: '<div></div>',
        };
        const block = createCustomBlock(definition);
        expect(block.fieldValues).toEqual({});
        expect(block.customType).toBe('empty-block');
    });

    it('creates custom block with repeatable field defaults to empty array', () => {
        const definition: CustomBlockDefinition = {
            type: 'list-block',
            name: 'List Block',
            fields: [
                {
                    key: 'items',
                    label: 'Items',
                    type: 'repeatable',
                    fields: [{ key: 'name', label: 'Name', type: 'text' }],
                },
            ],
            template: '<div></div>',
        };
        const block = createCustomBlock(definition);
        expect(block.fieldValues.items).toEqual([]);
    });

    it('creates custom block with all field types using defaults', () => {
        const definition: CustomBlockDefinition = {
            type: 'full-block',
            name: 'Full Block',
            fields: [
                { key: 'title', label: 'Title', type: 'text' },
                { key: 'desc', label: 'Desc', type: 'textarea' },
                { key: 'img', label: 'Image', type: 'image' },
                { key: 'clr', label: 'Color', type: 'color' },
                { key: 'num', label: 'Number', type: 'number' },
                { key: 'sel', label: 'Select', type: 'select', options: [{ label: 'A', value: 'a' }] },
                { key: 'flag', label: 'Flag', type: 'boolean' },
            ],
            template: '<div></div>',
        };
        const block = createCustomBlock(definition);
        expect(block.fieldValues.title).toBe('');
        expect(block.fieldValues.desc).toBe('');
        expect(block.fieldValues.img).toBe('');
        expect(block.fieldValues.clr).toBe('');
        expect(block.fieldValues.num).toBe(0);
        expect(block.fieldValues.sel).toBe('');
        expect(block.fieldValues.flag).toBe(false);
    });

    it('creates custom block with dataSource sets dataSourceFetched', () => {
        const definition: CustomBlockDefinition = {
            type: 'data-block',
            name: 'Data Block',
            fields: [],
            template: '<div></div>',
            dataSource: {
                label: 'Fetch Data',
                onFetch: async () => null,
            },
        };
        const block = createCustomBlock(definition);
        expect(block.dataSourceFetched).toBe(false);
    });

    it('creates custom block without dataSource does not set dataSourceFetched', () => {
        const definition: CustomBlockDefinition = {
            type: 'simple-block',
            name: 'Simple Block',
            fields: [],
            template: '<div></div>',
        };
        const block = createCustomBlock(definition);
        expect(block).not.toHaveProperty('dataSourceFetched');
    });
});
