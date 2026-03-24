import type { Block } from './blocks';

export interface TemplateSettings {
    width: number;
    backgroundColor: string;
    fontFamily: string;
    preheaderText?: string;
}

export interface TemplateContent {
    blocks: Block[];
    settings: TemplateSettings;
}

export function createDefaultTemplateContent(
    defaultFontFamily = 'Arial, sans-serif',
): TemplateContent {
    return {
        blocks: [],
        settings: {
            width: 600,
            backgroundColor: '#ffffff',
            fontFamily: defaultFontFamily,
        },
    };
}
