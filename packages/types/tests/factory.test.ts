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
        expect(block.id).toBeTruthy();
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
});
