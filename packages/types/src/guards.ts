import type {
    Block,
    ButtonBlock,
    CountdownBlock,
    CustomBlock,
    DividerBlock,
    HtmlBlock,
    ImageBlock,
    MenuBlock,
    SectionBlock,
    SocialIconsBlock,
    SpacerBlock,
    TableBlock,
    TextBlock,
    VideoBlock,
} from './blocks';

export function isSection(block: Block): block is SectionBlock {
    return block.type === 'section';
}

export function isText(block: Block): block is TextBlock {
    return block.type === 'text';
}

export function isImage(block: Block): block is ImageBlock {
    return block.type === 'image';
}

export function isButton(block: Block): block is ButtonBlock {
    return block.type === 'button';
}

export function isDivider(block: Block): block is DividerBlock {
    return block.type === 'divider';
}

export function isVideo(block: Block): block is VideoBlock {
    return block.type === 'video';
}

export function isSocialIcons(block: Block): block is SocialIconsBlock {
    return block.type === 'social';
}

export function isSpacer(block: Block): block is SpacerBlock {
    return block.type === 'spacer';
}

export function isHtml(block: Block): block is HtmlBlock {
    return block.type === 'html';
}

export function isMenu(block: Block): block is MenuBlock {
    return block.type === 'menu';
}

export function isTable(block: Block): block is TableBlock {
    return block.type === 'table';
}

export function isCountdown(block: Block): block is CountdownBlock {
    return block.type === 'countdown';
}

export function isCustomBlock(block: Block): block is CustomBlock {
    return block.type === 'custom';
}
