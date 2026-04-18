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
    isTitle,
    isParagraph,
    isVideo,
    createTitleBlock,
    createParagraphBlock,
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
        expect(isTitle(block)).toBe(false);
    });

    it('isTitle returns true for title blocks', () => {
        const block = createTitleBlock();
        expect(isTitle(block)).toBe(true);
        expect(isImage(block)).toBe(false);
    });

    it('isParagraph returns true for paragraph blocks', () => {
        const block = createParagraphBlock();
        expect(isParagraph(block)).toBe(true);
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
        expect(isTitle(block)).toBe(false);
    });
});

describe('type guards return false for wrong block types', () => {
    it('isTitle returns false for image block', () => {
        expect(isTitle(createImageBlock())).toBe(false);
    });

    it('isParagraph returns false for image block', () => {
        expect(isParagraph(createImageBlock())).toBe(false);
    });

    it('isImage returns false for title block', () => {
        expect(isImage(createTitleBlock())).toBe(false);
    });

    it('isButton returns false for section block', () => {
        expect(isButton(createSectionBlock())).toBe(false);
    });

    it('isDivider returns false for spacer block', () => {
        expect(isDivider(createSpacerBlock())).toBe(false);
    });

    it('isVideo returns false for image block', () => {
        expect(isVideo(createImageBlock())).toBe(false);
    });

    it('isSocialIcons returns false for menu block', () => {
        expect(isSocialIcons(createMenuBlock())).toBe(false);
    });

    it('isSpacer returns false for divider block', () => {
        expect(isSpacer(createDividerBlock())).toBe(false);
    });

    it('isHtml returns false for title block', () => {
        expect(isHtml(createTitleBlock())).toBe(false);
    });

    it('isMenu returns false for table block', () => {
        expect(isMenu(createTableBlock())).toBe(false);
    });

    it('isTable returns false for menu block', () => {
        expect(isTable(createMenuBlock())).toBe(false);
    });

    it('isCountdown returns false for paragraph block', () => {
        expect(isCountdown(createParagraphBlock())).toBe(false);
    });

    it('isCustomBlock returns false for title block', () => {
        expect(isCustomBlock(createTitleBlock())).toBe(false);
    });

    it('isSection returns false for paragraph block', () => {
        expect(isSection(createParagraphBlock())).toBe(false);
    });
});
