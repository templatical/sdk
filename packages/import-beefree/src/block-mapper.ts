import {
    createTextBlock,
    createImageBlock,
    createButtonBlock,
    createDividerBlock,
    createSpacerBlock,
    createHtmlBlock,
    createSocialIconsBlock,
    createMenuBlock,
    createTableBlock,
    createVideoBlock,
    generateId,
} from '@templatical/types';
import type {
    Block,
    SocialPlatform,
    SocialIcon,
    MenuItemData,
    TableRowData,
    TableCellData,
    SpacingValue,
} from '@templatical/types';
import type {
    BeeFreeeModule,
    BeeFreeeModuleDescriptor,
    ImportReportEntry,
} from './types';
import {
    parsePxValue,
    parseColor,
    parseBorderTop,
    extractPadding,
    parseWidthPercent,
    parseFontFamily,
} from './style-parser';

/**
 * Maps BeeFree module type strings to short keys.
 */
const MODULE_TYPE_MAP: Record<string, string> = {
    'mailup-bee-newsletter-modules-text': 'text',
    'mailup-bee-newsletter-modules-paragraph': 'text',
    'mailup-bee-newsletter-modules-heading': 'heading',
    'mailup-bee-newsletter-modules-list': 'list',
    'mailup-bee-newsletter-modules-image': 'image',
    'mailup-bee-newsletter-modules-button': 'button',
    'mailup-bee-newsletter-modules-divider': 'divider',
    'mailup-bee-newsletter-modules-spacer': 'spacer',
    'mailup-bee-newsletter-modules-html': 'html',
    'mailup-bee-newsletter-modules-social': 'social',
    'mailup-bee-newsletter-modules-video': 'video',
    'mailup-bee-newsletter-modules-menu': 'menu',
    'mailup-bee-newsletter-modules-table': 'table',
};

const SOCIAL_PLATFORM_MAP: Record<string, SocialPlatform> = {
    facebook: 'facebook',
    twitter: 'twitter',
    x: 'twitter',
    instagram: 'instagram',
    linkedin: 'linkedin',
    youtube: 'youtube',
    tiktok: 'tiktok',
    pinterest: 'pinterest',
    email: 'email',
    whatsapp: 'whatsapp',
    telegram: 'telegram',
    discord: 'discord',
    snapchat: 'snapchat',
    reddit: 'reddit',
    github: 'github',
    dribbble: 'dribbble',
    behance: 'behance',
};

type Align = 'left' | 'center' | 'right';
type FontWeight = 'normal' | 'bold';
type LineStyle = 'solid' | 'dashed' | 'dotted';

function toAlign(value: string | undefined, fallback: Align = 'left'): Align {
    if (value === 'left' || value === 'center' || value === 'right')
        return value;
    return fallback;
}

function toFontWeight(
    value: string | undefined,
    fallback: FontWeight = 'normal',
): FontWeight {
    if (value === 'bold') return 'bold';
    return fallback;
}

function toLineStyle(
    value: string | undefined,
    fallback: LineStyle = 'solid',
): LineStyle {
    if (value === 'solid' || value === 'dashed' || value === 'dotted')
        return value;
    return fallback;
}

function defaultMargin(): SpacingValue {
    return { top: 0, right: 0, bottom: 0, left: 0 };
}

function makeStyles(
    descriptor: BeeFreeeModuleDescriptor,
): Block['styles'] {
    const padding = extractPadding(descriptor.style);
    const bg = parseColor(descriptor.style?.['background-color']);
    return {
        padding,
        margin: defaultMargin(),
        ...(bg ? { backgroundColor: bg } : {}),
    };
}

function convertText(descriptor: BeeFreeeModuleDescriptor): Block {
    const textContent =
        descriptor.text ?? descriptor.paragraph ?? descriptor.list;
    const html = textContent?.html ?? '';
    const style = textContent?.style ?? {};

    return createTextBlock({
        content: html,
        fontSize: parsePxValue(style['font-size']) || 16,
        color: parseColor(style.color) || '#333333',
        textAlign: toAlign(style['text-align']),
        fontWeight: toFontWeight(style['font-weight']),
        fontFamily: parseFontFamily(style['font-family']) || undefined,
        styles: makeStyles(descriptor),
    });
}

function convertHeading(descriptor: BeeFreeeModuleDescriptor): Block {
    const heading = descriptor.heading;
    if (!heading) return convertText(descriptor);

    const style = heading.style ?? {};
    const tag = heading.title ?? 'h2';
    const text = heading.text ?? '';
    const content = text.startsWith('<') ? text : `<${tag}>${text}</${tag}>`;

    return createTextBlock({
        content,
        fontSize: parsePxValue(style['font-size']) || 24,
        color: parseColor(style.color) || '#333333',
        textAlign: toAlign(style['text-align']),
        fontWeight: toFontWeight(style['font-weight'], 'bold'),
        fontFamily: parseFontFamily(style['font-family']) || undefined,
        styles: makeStyles(descriptor),
    });
}

function convertImage(descriptor: BeeFreeeModuleDescriptor): Block {
    const image = descriptor.image;
    if (!image) {
        return createImageBlock({ styles: makeStyles(descriptor) });
    }

    return createImageBlock({
        src: image.src || '',
        alt: image.alt || '',
        width: parsePxValue(image.width) || 600,
        align: toAlign(image.style?.['text-align'], 'center'),
        linkUrl: image.href || undefined,
        styles: makeStyles(descriptor),
    });
}

function convertButton(descriptor: BeeFreeeModuleDescriptor): Block {
    const button = descriptor.button;
    if (!button) {
        return createButtonBlock({ styles: makeStyles(descriptor) });
    }

    const style = button.style ?? {};
    const label = button.label?.replace(/<[^>]*>/g, '') ?? 'Button';

    return createButtonBlock({
        text: label,
        url: button.href || '#',
        backgroundColor: parseColor(style['background-color']) || '#4f46e5',
        textColor: parseColor(style.color) || '#ffffff',
        borderRadius: parsePxValue(style['border-radius']),
        fontSize: parsePxValue(style['font-size']) || 16,
        fontFamily: parseFontFamily(style['font-family']) || undefined,
        buttonPadding: {
            top: parsePxValue(style['padding-top']) || 12,
            right: parsePxValue(style['padding-right']) || 24,
            bottom: parsePxValue(style['padding-bottom']) || 12,
            left: parsePxValue(style['padding-left']) || 24,
        },
        styles: makeStyles(descriptor),
    });
}

function convertDivider(descriptor: BeeFreeeModuleDescriptor): Block {
    const divider = descriptor.divider;
    const style = divider?.style ?? {};
    const border = parseBorderTop(style['border-top']);

    return createDividerBlock({
        lineStyle: toLineStyle(border.style),
        color: border.color,
        thickness: border.width || 1,
        width: parseWidthPercent(style.width),
        styles: makeStyles(descriptor),
    });
}

function convertSpacer(descriptor: BeeFreeeModuleDescriptor): Block {
    const spacer = descriptor.spacer;
    const height = parsePxValue(spacer?.style?.height) || 20;

    return createSpacerBlock({
        height,
        styles: makeStyles(descriptor),
    });
}

function convertHtml(descriptor: BeeFreeeModuleDescriptor): Block {
    const html = descriptor.html?.html ?? '';

    return createHtmlBlock({
        content: html,
        styles: makeStyles(descriptor),
    });
}

function convertSocial(
    descriptor: BeeFreeeModuleDescriptor,
    warnings: string[],
): Block {
    const iconsList = descriptor.iconsList;
    if (!iconsList?.icons) {
        return createSocialIconsBlock({ styles: makeStyles(descriptor) });
    }

    const icons: SocialIcon[] = [];

    for (const beeIcon of iconsList.icons) {
        const id = (beeIcon.id ?? beeIcon.name ?? '').toLowerCase();
        const platform = SOCIAL_PLATFORM_MAP[id];

        if (!platform) {
            warnings.push(
                `Unrecognized social icon "${beeIcon.name || id}" was skipped.`,
            );
            continue;
        }

        icons.push({
            id: generateId(),
            platform,
            url: beeIcon.image?.href || '#',
        });
    }

    return createSocialIconsBlock({
        icons,
        styles: makeStyles(descriptor),
    });
}

function convertVideo(descriptor: BeeFreeeModuleDescriptor): Block {
    const video = descriptor.video;
    if (!video) {
        return createVideoBlock({ styles: makeStyles(descriptor) });
    }

    return createVideoBlock({
        url: video.src || '',
        thumbnailUrl: video.thumbnail || '',
        alt: video.alt || '',
        width: parsePxValue(video.style?.width) || 600,
        align: toAlign(video.style?.['text-align'], 'center'),
        styles: makeStyles(descriptor),
    });
}

function convertMenu(descriptor: BeeFreeeModuleDescriptor): Block {
    const menu = descriptor.menu;
    if (!menu) {
        return createMenuBlock({ styles: makeStyles(descriptor) });
    }

    const style = menu.style ?? {};

    const items: MenuItemData[] = (menu.items ?? []).map((item) => ({
        id: generateId(),
        text: item.text || '',
        url: item.link || item.href || '#',
        openInNewTab: item.target === '_blank',
        bold: false,
        underline: false,
    }));

    return createMenuBlock({
        items,
        separator: menu.separator || '|',
        separatorColor: parseColor(menu.separatorColor) || '#999999',
        fontSize: parsePxValue(style['font-size']) || 14,
        color: parseColor(style.color) || '#333333',
        fontFamily: parseFontFamily(style['font-family']) || undefined,
        textAlign: toAlign(style['text-align'], 'center'),
        styles: makeStyles(descriptor),
    });
}

function convertTable(descriptor: BeeFreeeModuleDescriptor): Block {
    const table = descriptor.table;
    if (!table) {
        return createTableBlock({ styles: makeStyles(descriptor) });
    }

    const style = table.style ?? {};

    const rows: TableRowData[] = (table.rows ?? []).map((row) => ({
        id: generateId(),
        cells: (row.cells ?? []).map(
            (cell): TableCellData => ({
                id: generateId(),
                content: cell.content ?? cell.html ?? '',
            }),
        ),
    }));

    return createTableBlock({
        rows,
        hasHeaderRow: table.hasHeaderRow ?? false,
        headerBackgroundColor:
            parseColor(table.headerBackgroundColor) || undefined,
        borderColor: parseColor(style['border-color']) || '#dddddd',
        borderWidth: parsePxValue(style['border-width']) || 1,
        cellPadding:
            typeof table.cellPadding === 'number'
                ? table.cellPadding
                : parsePxValue(table.cellPadding as string) || 8,
        fontSize: parsePxValue(style['font-size']) || 14,
        color: parseColor(style.color) || '#333333',
        textAlign: toAlign(style['text-align']),
        styles: makeStyles(descriptor),
    });
}

function convertHtmlFallback(module: BeeFreeeModule): Block {
    // Attempt to extract any HTML content from the descriptor
    const descriptor = module.descriptor;
    let html = '';

    // Try common content fields
    if (descriptor.text?.html) html = descriptor.text.html;
    else if (descriptor.html?.html) html = descriptor.html.html;
    else if (descriptor.heading?.text) html = descriptor.heading.text;
    else
        html = `<!-- Unsupported BeeFree module: ${module.type} -->`;

    return createHtmlBlock({
        content: html,
        styles: makeStyles(descriptor),
    });
}

/**
 * Converts a single BeeFree module to a Templatical block.
 * Returns the block and a report entry.
 */
export function convertModule(
    module: BeeFreeeModule,
    warnings: string[],
): { block: Block; entry: ImportReportEntry } {
    const mappedType = MODULE_TYPE_MAP[module.type];
    const descriptor = module.descriptor;

    if (!mappedType) {
        return {
            block: convertHtmlFallback(module),
            entry: {
                beeFreeModuleType: module.type,
                templaticalBlockType: 'html',
                status: 'html-fallback',
                note: `Unknown module type "${module.type}" converted to HTML block.`,
            },
        };
    }

    let block: Block;
    let isApproximation = false;

    switch (mappedType) {
        case 'text':
        case 'list':
            block = convertText(descriptor);
            break;
        case 'heading':
            block = convertHeading(descriptor);
            break;
        case 'image':
            block = convertImage(descriptor);
            break;
        case 'button':
            block = convertButton(descriptor);
            break;
        case 'divider':
            block = convertDivider(descriptor);
            break;
        case 'spacer':
            block = convertSpacer(descriptor);
            break;
        case 'html':
            block = convertHtml(descriptor);
            break;
        case 'social':
            block = convertSocial(descriptor, warnings);
            break;
        case 'video':
            block = convertVideo(descriptor);
            break;
        case 'menu':
            block = convertMenu(descriptor);
            isApproximation = true; // menu styles are approximate
            break;
        case 'table':
            block = convertTable(descriptor);
            break;
        default:
            block = convertHtmlFallback(module);
            return {
                block,
                entry: {
                    beeFreeModuleType: module.type,
                    templaticalBlockType: 'html',
                    status: 'html-fallback',
                },
            };
    }

    return {
        block,
        entry: {
            beeFreeModuleType: module.type,
            templaticalBlockType: block.type,
            status: isApproximation ? 'approximated' : 'converted',
        },
    };
}
