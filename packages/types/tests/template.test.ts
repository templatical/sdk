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

    it('uses default font family when called with no arguments', () => {
        const content = createDefaultTemplateContent();
        expect(content.settings.fontFamily).toBe('Arial, sans-serif');
    });

    it('accepts empty string as font family', () => {
        const content = createDefaultTemplateContent('');
        expect(content.settings.fontFamily).toBe('');
    });

    it('does not include preheaderText by default', () => {
        const content = createDefaultTemplateContent();
        expect(content.settings.preheaderText).toBeUndefined();
    });

    it('returns independent objects on each call', () => {
        const content1 = createDefaultTemplateContent();
        const content2 = createDefaultTemplateContent();
        content1.blocks.push({
            id: '1',
            type: 'text',
            content: 'test',
            fontSize: 14,
            color: '#000',
            textAlign: 'left',
            fontWeight: 'normal',
            styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
        } as any);
        expect(content2.blocks).toEqual([]);
    });

    it('settings object has expected shape', () => {
        const content = createDefaultTemplateContent();
        expect(content.settings).toEqual({
            width: 600,
            backgroundColor: '#ffffff',
            fontFamily: 'Arial, sans-serif',
        });
    });
});

describe('createDefaultTemplateContent with templateDefaults', () => {
    it('applies templateDefaults overrides', () => {
        const content = createDefaultTemplateContent('Arial, sans-serif', {
            width: 640,
            backgroundColor: '#f5f5f5',
        });
        expect(content.settings.width).toBe(640);
        expect(content.settings.backgroundColor).toBe('#f5f5f5');
        expect(content.settings.fontFamily).toBe('Arial, sans-serif');
    });

    it('templateDefaults fontFamily overrides defaultFontFamily parameter', () => {
        const content = createDefaultTemplateContent('Helvetica, sans-serif', {
            fontFamily: 'Georgia, serif',
        });
        expect(content.settings.fontFamily).toBe('Georgia, serif');
    });

    it('applies preheaderText from templateDefaults', () => {
        const content = createDefaultTemplateContent('Arial, sans-serif', {
            preheaderText: 'Hello world',
        });
        expect(content.settings.preheaderText).toBe('Hello world');
    });

    it('returns defaults when templateDefaults is undefined', () => {
        const content = createDefaultTemplateContent('Arial, sans-serif', undefined);
        expect(content.settings.width).toBe(600);
        expect(content.settings.backgroundColor).toBe('#ffffff');
    });

    it('returns defaults when templateDefaults is empty', () => {
        const content = createDefaultTemplateContent('Arial, sans-serif', {});
        expect(content.settings.width).toBe(600);
        expect(content.settings.backgroundColor).toBe('#ffffff');
    });

    it('only overrides specified properties', () => {
        const content = createDefaultTemplateContent('Arial, sans-serif', {
            width: 700,
        });
        expect(content.settings.width).toBe(700);
        expect(content.settings.backgroundColor).toBe('#ffffff');
        expect(content.settings.fontFamily).toBe('Arial, sans-serif');
    });
});
