import { describe, expect, it } from 'vitest';
import { createDefaultTemplateContent } from '../src';

describe('createDefaultTemplateContent', () => {
    it('creates empty template with default settings', () => {
        const content = createDefaultTemplateContent();
        expect(content.blocks).toEqual([]);
        expect(content.settings.width).toBe(600);
        expect(content.settings.backgroundColor).toBe('#ffffff');
        expect(content.settings.fontFamily).toBe('Arial, sans-serif');
    });

    it('accepts custom default font family', () => {
        const content = createDefaultTemplateContent('Helvetica, sans-serif');
        expect(content.settings.fontFamily).toBe('Helvetica, sans-serif');
    });
});
