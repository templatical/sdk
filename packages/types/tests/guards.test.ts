import { describe, expect, it } from 'vitest';
import {
    isButton,
    isCountdown,
    isCustomBlock,
    isDivider,
    isHtml,
    isImage,
    isMenu,
    isSection,
    isSocialIcons,
    isSpacer,
    isTable,
    isText,
    isVideo,
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
} from '../src';

describe('type guards', () => {
    it('isSection returns true for section blocks', () => {
        const block = createSectionBlock();
        expect(isSection(block)).toBe(true);
        expect(isText(block)).toBe(false);
    });

    it('isText returns true for text blocks', () => {
        const block = createTextBlock();
        expect(isText(block)).toBe(true);
        expect(isImage(block)).toBe(false);
    });

    it('isImage returns true for image blocks', () => {
        const block = createImageBlock();
        expect(isImage(block)).toBe(true);
        expect(isButton(block)).toBe(false);
    });

    it('isButton returns true for button blocks', () => {
        const block = createButtonBlock();
        expect(isButton(block)).toBe(true);
        expect(isDivider(block)).toBe(false);
    });

    it('isDivider returns true for divider blocks', () => {
        const block = createDividerBlock();
        expect(isDivider(block)).toBe(true);
    });

    it('isVideo returns true for video blocks', () => {
        const block = createVideoBlock();
        expect(isVideo(block)).toBe(true);
    });

    it('isSocialIcons returns true for social blocks', () => {
        const block = createSocialIconsBlock();
        expect(isSocialIcons(block)).toBe(true);
    });

    it('isSpacer returns true for spacer blocks', () => {
        const block = createSpacerBlock();
        expect(isSpacer(block)).toBe(true);
    });

    it('isHtml returns true for html blocks', () => {
        const block = createHtmlBlock();
        expect(isHtml(block)).toBe(true);
    });

    it('isMenu returns true for menu blocks', () => {
        const block = createMenuBlock();
        expect(isMenu(block)).toBe(true);
    });

    it('isTable returns true for table blocks', () => {
        const block = createTableBlock();
        expect(isTable(block)).toBe(true);
    });

    it('isCountdown returns true for countdown blocks', () => {
        const block = createCountdownBlock();
        expect(isCountdown(block)).toBe(true);
    });

    it('isCustomBlock returns true for custom blocks', () => {
        const block = {
            id: '1',
            type: 'custom' as const,
            customType: 'test',
            fieldValues: {},
            styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } },
        };
        expect(isCustomBlock(block)).toBe(true);
        expect(isText(block)).toBe(false);
    });
});
