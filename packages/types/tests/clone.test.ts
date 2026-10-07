import { describe, expect, it } from 'vitest';
import { createCustomBlock, safeClone, type CustomBlockDefinition } from '../src';

describe('safeClone', () => {
    it('deep-clones plain data (no shared references with the source)', () => {
        const source = { blocks: [{ id: 'a', nested: { v: 1 } }] };

        const clone = safeClone(source);

        expect(clone).toEqual(source);
        expect(clone).not.toBe(source);
        expect(clone.blocks).not.toBe(source.blocks);
        expect(clone.blocks[0].nested).not.toBe(source.blocks[0].nested);

        clone.blocks[0].nested.v = 99;
        expect(source.blocks[0].nested.v).toBe(1);
    });

    it('survives a Sortable expando cycle and drops the back-ref (issue #203)', () => {
        // HTMLDivElement.SortableXXX -> instance -> el -> div, the exact shape
        // a drag inside a section leaks into block data. A naked JSON.stringify
        // would throw `Converting circular structure to JSON`.
        const sortableInstance: { el: unknown } = { el: null };
        const leakedDiv: Record<string, unknown> = {
            Sortable1781247283888: sortableInstance,
        };
        sortableInstance.el = leakedDiv;
        const para = { id: 'p', type: 'paragraph', content: '<p>hi</p>', leaked: leakedDiv };

        // Pre-condition: a naked stringify of the same input throws.
        expect(() => JSON.stringify(para)).toThrow(/circular structure/i);

        let clone!: typeof para;
        expect(() => {
            clone = safeClone(para);
        }).not.toThrow();

        // Real data preserved; only the cyclic `el` back-ref is omitted.
        expect(clone.content).toBe('<p>hi</p>');
        expect(clone.type).toBe('paragraph');
        expect((clone.leaked as Record<string, unknown>).Sortable1781247283888).toEqual({});
    });

    it('drops a direct self-reference instead of throwing', () => {
        const ring: Record<string, unknown> = { keep: 'value' };
        ring.self = ring;

        const clone = safeClone(ring);

        expect(clone.keep).toBe('value');
        expect(clone.self).toBeUndefined();
    });

    it('copies an object reached by two paths into both places', () => {
        // Two blocks sharing one styles object is still tree data once
        // serialized; dropping the second visit loses that block's styles.
        const shared = { padding: 8 };
        const source = {
            blocks: [
                { id: 'a', styles: shared },
                { id: 'b', styles: shared },
            ],
        };

        const clone = safeClone(source);

        expect(clone.blocks[0].styles).toEqual({ padding: 8 });
        expect(clone.blocks[1].styles).toEqual({ padding: 8 });
        expect(clone.blocks[0].styles).not.toBe(clone.blocks[1].styles);
    });

    it('keeps the repeatable default two custom blocks of one type share', () => {
        // createCustomBlock hands every block the definition's own `default`
        // array, so `getContent()` and undo meet it once per block.
        const definition: CustomBlockDefinition = {
            type: 'list',
            name: 'List',
            template: '',
            fields: [
                {
                    key: 'items',
                    type: 'repeatable',
                    label: 'Items',
                    fields: [{ key: 't', type: 'text', label: 'T' }],
                    default: [{ t: 'one' }],
                },
            ],
        };
        const first = createCustomBlock(definition);
        const second = createCustomBlock(definition);

        const clone = safeClone({ blocks: [first, second] });

        expect(clone.blocks.map((block) => block.fieldValues.items)).toEqual([
            [{ t: 'one' }],
            [{ t: 'one' }],
        ]);
    });

    it('drops a reference back to an ancestor further up the tree', () => {
        const parent: Record<string, unknown> = { id: 'p' };
        const child: Record<string, unknown> = { id: 'c', up: parent };
        parent.child = child;
        parent.after = { id: 'sibling' };

        const clone = safeClone(parent);
        const clonedChild = clone.child as Record<string, unknown>;

        expect(clonedChild.id).toBe('c');
        expect(clonedChild.up).toBeUndefined();
        expect(clone.after).toEqual({ id: 'sibling' });
    });
});
