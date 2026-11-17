import { describe, expect, it } from 'vitest';
import {
  createButtonBlock,
  createDefaultTemplateContent,
  createDividerBlock,
  createHtmlBlock,
  createImageBlock,
  createMenuBlock,
  createParagraphBlock,
  createSocialIconsBlock,
  createTableBlock,
  createTitleBlock,
  createVideoBlock,
  HEADING_LEVEL_FONT_SIZE,
} from '@templatical/types';
import type {
  Block,
  ButtonBlock,
  DividerBlock,
  HtmlBlock,
  ImageBlock,
  MenuBlock,
  ParagraphBlock,
  SocialIconsBlock,
  TableBlock,
  TemplateContent,
  TitleBlock,
  VideoBlock,
} from '@templatical/types';
import { renderBlock, renderToMjml, RenderContext } from '../src';

// Stored JSON can hold null (or nothing) where a block type says string: a
// backend that turns every "" into null writes `"alt": null`. The renderer
// treats such a field as "", so the block renders exactly as it would with an
// empty string instead of throwing.

const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);

const MISSING = [null, undefined] as const;

interface FieldCase<B extends Block> {
  name: string;
  make: () => B;
  set: (block: B, value: string) => void;
  /** A fragment of the output with the field rendered as "". */
  fragment: string;
}

function fieldCase<B extends Block>(entry: FieldCase<B>): FieldCase<Block> {
  return entry as unknown as FieldCase<Block>;
}

function renderWith<B extends Block>(
  entry: FieldCase<B>,
  value: string | null | undefined,
): string {
  const block = entry.make();
  entry.set(block, value as string);
  return renderBlock(block, ctx);
}

const image = (): ImageBlock =>
  createImageBlock({ src: 'https://example.com/a.png', alt: 'Logo' });
const video = (): VideoBlock =>
  createVideoBlock({ url: 'https://youtu.be/dQw4w9WgXcQ', alt: 'Clip' });
const button = (): ButtonBlock =>
  createButtonBlock({ text: 'Go', url: 'https://example.com' });
const title = (): TitleBlock =>
  createTitleBlock({ content: '<p>Hi</p>', level: 2, color: '#111111' });
const menu = (): MenuBlock =>
  createMenuBlock({
    items: [
      { id: 'a', text: 'A', url: 'https://a.example', openInNewTab: false, bold: false, underline: false },
      { id: 'b', text: 'B', url: 'https://b.example', openInNewTab: false, bold: false, underline: false },
    ],
  });
const table = (): TableBlock => {
  const block = createTableBlock({ hasHeaderRow: false });
  for (const row of block.rows) {
    for (const cell of row.cells) cell.content = 'x';
  }
  return block;
};
const social = (): SocialIconsBlock =>
  createSocialIconsBlock({
    icons: [{ id: 'f', platform: 'facebook', url: 'https://facebook.com/x' }],
  });

const FIELD_CASES: FieldCase<Block>[] = [
  fieldCase<ImageBlock>({ name: 'image alt', make: image, set: (b, v) => { b.alt = v; }, fragment: 'alt=""' }),
  fieldCase<ImageBlock>({ name: 'image align', make: image, set: (b, v) => { b.align = v as ImageBlock['align']; }, fragment: 'align=""' }),
  fieldCase<VideoBlock>({ name: 'video alt', make: video, set: (b, v) => { b.alt = v; }, fragment: 'alt=""' }),
  fieldCase<VideoBlock>({ name: 'video align', make: video, set: (b, v) => { b.align = v as VideoBlock['align']; }, fragment: 'align=""' }),
  fieldCase<VideoBlock>({
    name: 'video url with a custom thumbnail',
    make: () => ({ ...video(), thumbnailUrl: 'https://example.com/t.png' }),
    set: (b, v) => { b.url = v; },
    fragment: 'href=""',
  }),
  fieldCase<ButtonBlock>({ name: 'button text', make: button, set: (b, v) => { b.text = v; }, fragment: '\n></mj-button>' }),
  fieldCase<ButtonBlock>({ name: 'button url', make: button, set: (b, v) => { b.url = v; }, fragment: '<mj-button\n  background-color=' }),
  fieldCase<ButtonBlock>({ name: 'button textColor', make: button, set: (b, v) => { b.textColor = v; }, fragment: '\n  color=""' }),
  fieldCase<ButtonBlock>({ name: 'button backgroundColor', make: button, set: (b, v) => { b.backgroundColor = v; }, fragment: 'background-color="transparent"' }),
  fieldCase<TitleBlock>({
    name: 'title color',
    make: title,
    set: (b, v) => { b.color = v; },
    fragment: `font-size="${HEADING_LEVEL_FONT_SIZE[2]}px"\n  align=`,
  }),
  fieldCase<TitleBlock>({ name: 'title textAlign', make: title, set: (b, v) => { b.textAlign = v as TitleBlock['textAlign']; }, fragment: 'align=""' }),
  fieldCase<TitleBlock>({ name: 'title content', make: title, set: (b, v) => { b.content = v; }, fragment: '></h2></mj-text>' }),
  fieldCase<DividerBlock>({ name: 'divider color', make: createDividerBlock, set: (b, v) => { b.color = v; }, fragment: 'border-color=""' }),
  fieldCase<DividerBlock>({ name: 'divider lineStyle', make: createDividerBlock, set: (b, v) => { b.lineStyle = v as DividerBlock['lineStyle']; }, fragment: 'border-style=""' }),
  fieldCase<SocialIconsBlock>({ name: 'social align', make: social, set: (b, v) => { b.align = v as SocialIconsBlock['align']; }, fragment: 'align=""' }),
  fieldCase<SocialIconsBlock>({ name: 'social icon url', make: social, set: (b, v) => { b.icons[0].url = v; }, fragment: 'href=""' }),
  fieldCase<MenuBlock>({ name: 'menu textAlign', make: menu, set: (b, v) => { b.textAlign = v as MenuBlock['textAlign']; }, fragment: 'align=""' }),
  fieldCase<MenuBlock>({ name: 'menu separator', make: menu, set: (b, v) => { b.separator = v; }, fragment: 'px;"></span>' }),
  fieldCase<MenuBlock>({ name: 'menu separatorColor', make: menu, set: (b, v) => { b.separatorColor = v; }, fragment: '<span style="color: ; padding:' }),
  fieldCase<MenuBlock>({ name: 'menu item text', make: menu, set: (b, v) => { b.items[0].text = v; }, fragment: 'style="text-decoration: none"></a>' }),
  fieldCase<MenuBlock>({ name: 'menu item url', make: menu, set: (b, v) => { b.items[0].url = v; }, fragment: '<a href="" style=' }),
  fieldCase<TableBlock>({ name: 'table borderColor', make: table, set: (b, v) => { b.borderColor = v; }, fragment: 'px solid ; padding:' }),
  fieldCase<TableBlock>({ name: 'table textAlign', make: table, set: (b, v) => { b.textAlign = v as TableBlock['textAlign']; }, fragment: 'align=""' }),
  fieldCase<TableBlock>({ name: 'table cell content', make: table, set: (b, v) => { b.rows[0].cells[0].content = v; }, fragment: 'px"></td>' }),
];

describe('a null or undefined string field renders as ""', () => {
  for (const entry of FIELD_CASES) {
    for (const missing of MISSING) {
      it(`${entry.name}: ${String(missing)}`, () => {
        const rendered = renderWith(entry, missing);

        expect(rendered).toContain(entry.fragment);
        expect(rendered).toBe(renderWith(entry, ''));
      });
    }
  }
});

describe('a null or undefined field that empties its block renders nothing', () => {
  const EMPTYING: FieldCase<Block>[] = [
    fieldCase<ImageBlock>({ name: 'image src', make: image, set: (b, v) => { b.src = v; }, fragment: '' }),
    fieldCase<ParagraphBlock>({
      name: 'paragraph content',
      make: () => createParagraphBlock({ content: '<p>Hi</p>' }),
      set: (b, v) => { b.content = v; },
      fragment: '',
    }),
    fieldCase<HtmlBlock>({
      name: 'html content',
      make: () => createHtmlBlock({ content: '<b>Hi</b>' }),
      set: (b, v) => { b.content = v; },
      fragment: '',
    }),
  ];

  for (const entry of EMPTYING) {
    it(`${entry.name}: renders "" for "" as the baseline`, () => {
      expect(renderBlock(entry.make(), ctx)).not.toBe('');
      expect(renderWith(entry, '')).toBe('');
    });

    for (const missing of MISSING) {
      it(`${entry.name}: ${String(missing)}`, () => {
        expect(renderWith(entry, missing)).toBe('');
      });
    }
  }
});

describe('a null or undefined template setting renders as ""', () => {
  function contentWith(
    set: (content: TemplateContent) => void,
  ): TemplateContent {
    const content = createDefaultTemplateContent();
    content.blocks = [createParagraphBlock({ content: '<p>Hi</p>' })];
    set(content);
    return content;
  }

  for (const missing of MISSING) {
    it(`settings.backgroundColor: ${String(missing)}`, async () => {
      const rendered = await renderToMjml(
        contentWith((c) => { c.settings.backgroundColor = missing as unknown as string; }),
      );

      expect(rendered).toContain('px" background-color="">');
      expect(rendered).toBe(
        await renderToMjml(contentWith((c) => { c.settings.backgroundColor = ''; })),
      );
    });

    it(`settings.fontFamily: ${String(missing)}`, async () => {
      const rendered = await renderToMjml(
        contentWith((c) => { c.settings.fontFamily = missing as unknown as string; }),
      );

      expect(rendered).toContain('<mj-all font-family="" />');
      expect(rendered).toBe(
        await renderToMjml(contentWith((c) => { c.settings.fontFamily = ''; })),
      );
    });
  }
});
