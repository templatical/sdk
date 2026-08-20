import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mjml2html from 'mjml';
import {
  createCountdownBlock,
  createDefaultTemplateContent,
  createParagraphBlock,
  createSectionBlock,
  createTitleBlock,
  createVideoBlock,
} from '@templatical/types';
import type { Block, TemplateContent } from '@templatical/types';
import {
  RenderContext,
  UNRENDERABLE_MARKER_PREFIX,
  renderBlock,
  renderToMjml,
  renderUnrenderableBlock,
} from '../src';

const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);

function makeContent(blocks: Block[]): TemplateContent {
  return { ...createDefaultTemplateContent(), blocks };
}

async function compile(mjml: string): Promise<string> {
  const result = await mjml2html(mjml, { validationLevel: 'strict' });
  expect(result.errors).toEqual([]);
  return result.html;
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

describe('blockRenderers overrides', () => {
  it('an override wins over the built-in renderer for that type', async () => {
    const paragraph = createParagraphBlock({ content: '<p>Built-in output</p>' });
    const mjml = await renderToMjml(makeContent([paragraph]), {
      blockRenderers: {
        paragraph: () => '<mj-text>OVERRIDDEN</mj-text>',
      },
    });

    expect(mjml).toContain('<mj-text>OVERRIDDEN</mj-text>');
    expect(mjml).not.toContain('Built-in output');
  });

  it('types without an override still use their built-in renderer', async () => {
    const title = createTitleBlock({ content: '<p>Untouched heading</p>', level: 2 });
    const paragraph = createParagraphBlock({ content: '<p>Body copy</p>' });
    const mjml = await renderToMjml(makeContent([title, paragraph]), {
      blockRenderers: {
        paragraph: () => '<mj-text>OVERRIDDEN</mj-text>',
      },
    });

    // Fall-through: the title keeps the built-in <h2> wrapper.
    expect(mjml).toContain('<h2');
    expect(mjml).toContain('Untouched heading');
    expect(mjml).toContain('OVERRIDDEN');
    expect(mjml).not.toContain('Body copy');
  });

  it('receives the block and the active context, narrowed to the column width', async () => {
    const seen: { id: string; width: number }[] = [];
    const child = createParagraphBlock({ content: '<p>In a column</p>' });
    const section = createSectionBlock({ columns: '2', children: [[child], []] });

    await renderToMjml(makeContent([section]), {
      blockRenderers: {
        paragraph: (block, context) => {
          seen.push({ id: block.id, width: context.containerWidth });
          return '<mj-text>x</mj-text>';
        },
      },
    });

    expect(seen).toEqual([{ id: child.id, width: 300 }]);
  });

  it('an override for countdown replaces the placeholder marker entirely', async () => {
    const countdown = createCountdownBlock();
    const mjml = await renderToMjml(makeContent([countdown]), {
      blockRenderers: {
        countdown: (block) =>
          `<mj-image src="https://cloud.example/countdown/${block.id}.gif" />`,
      },
    });

    expect(mjml).toContain(
      `<mj-image src="https://cloud.example/countdown/${countdown.id}.gif" />`,
    );
    expect(mjml).not.toContain(UNRENDERABLE_MARKER_PREFIX);
    expect(warn).not.toHaveBeenCalled();
  });

  it('an override owns the hidden-on-all-viewports decision', () => {
    const hidden = createVideoBlock({ visibility: { desktop: false, mobile: false } });
    const overrideCtx = new RenderContext(600, [], 'Arial, sans-serif', true, new Map(), undefined, {
      video: () => '<mj-text>rendered anyway</mj-text>',
    });

    // The built-in video renderer returns '' for this block; the override is
    // consulted first, so it is reached and its output is what lands.
    expect(renderBlock(hidden, ctx)).toBe('');
    expect(renderBlock(hidden, overrideCtx)).toBe('<mj-text>rendered anyway</mj-text>');
  });

  it('overrides survive into nested section columns', async () => {
    const child = createCountdownBlock();
    const section = createSectionBlock({ columns: '1', children: [[child]] });
    const mjml = await renderToMjml(makeContent([section]), {
      blockRenderers: { countdown: () => '<mj-text>TICK</mj-text>' },
    });

    expect(mjml).toContain('<mj-text>TICK</mj-text>');
    expect(mjml).not.toContain(UNRENDERABLE_MARKER_PREFIX);
  });

  it('an empty map behaves exactly like no map at all', async () => {
    const blocks = [createTitleBlock({ content: '<p>Same</p>' })];
    const withEmpty = await renderToMjml(makeContent(blocks), { blockRenderers: {} });
    const without = await renderToMjml(makeContent(blocks));
    expect(withEmpty).toBe(without);
  });
});

describe('unrenderable blocks', () => {
  it('emits an mj-raw marker naming the type and id, and warns once', () => {
    const block = createCountdownBlock();
    expect(renderUnrenderableBlock(block)).toBe(
      `<mj-raw><!-- ${UNRENDERABLE_MARKER_PREFIX} type="countdown" id="${block.id}" --></mj-raw>`,
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe(
      `[Templatical] No renderer for block type "countdown" (id: ${block.id}). ` +
        'A placeholder comment was emitted in its place. Pass a `blockRenderers` ' +
        'entry for this type to render it.',
    );
  });

  it('collapses comment-terminating sequences so the marker cannot leak', () => {
    const block = {
      id: 'a--><script>x</script>',
      type: 'we--ird' as never,
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    } as Block;

    const result = renderUnrenderableBlock(block);
    expect(result).toBe(
      `<mj-raw><!-- ${UNRENDERABLE_MARKER_PREFIX} type="we-ird" id="a-scriptx/script" --></mj-raw>`,
    );
    // One comment open, one comment close — nothing escaped into body position.
    // `--!?>` rather than `-->`: `--!>` closes a comment too (the spec's
    // "comment end bang state"), so counting only `-->` would miss a leak
    // through the other terminator.
    expect(result.match(/--!?>/g)).toHaveLength(1);
    // …and the one terminator present is the marker's own.
    expect(result).not.toContain('--!>');
  });

  /**
   * Stripping `<` and `>` can bring two hyphens together that the collapse pass
   * already walked past: `-<-` is neither `--` nor a bracket pair on its own,
   * but becomes `--` once the bracket goes. Order matters — strip first, then
   * collapse — or the sanitizer reintroduces the sequence it exists to remove.
   *
   * Not exploitable on its own, because every `>` is stripped and a comment
   * needs one to close. It is emitted markup either way, and a `--` inside a
   * comment is non-conforming, so the marker should not carry one.
   */
  it('does not reintroduce a double hyphen when stripping brackets', () => {
    const block = {
      id: '-<-<-',
      type: 'a-<-b' as never,
      styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    } as Block;

    const result = renderUnrenderableBlock(block);

    expect(result).toBe(
      `<mj-raw><!-- ${UNRENDERABLE_MARKER_PREFIX} type="a-b" id="-" --></mj-raw>`,
    );
    // Exactly one comment terminator in either spelling, and no stray `--`
    // between the comment's own `<!--` and `-->`.
    expect(result.match(/--!?>/g)).toHaveLength(1);
    const body = result.slice(
      result.indexOf('<!--') + '<!--'.length,
      result.indexOf('-->'),
    );
    expect(body).not.toContain('--');
  });

  it('a top-level countdown renders inside a section and survives an mjml compile', async () => {
    const countdown = createCountdownBlock();
    const mjml = await renderToMjml(makeContent([countdown]));

    expect(mjml).toContain(
      `<mj-raw><!-- ${UNRENDERABLE_MARKER_PREFIX} type="countdown" id="${countdown.id}" --></mj-raw>`,
    );

    const html = await compile(mjml);
    expect(html).toContain(`${UNRENDERABLE_MARKER_PREFIX} type="countdown"`);
    expect(html).toContain(countdown.id);
  });

  it('a countdown inside a section column survives an mjml compile', async () => {
    const countdown = createCountdownBlock();
    const section = createSectionBlock({ columns: '1', children: [[countdown]] });
    const mjml = await renderToMjml(makeContent([section]));

    const html = await compile(mjml);
    expect(html).toContain(`${UNRENDERABLE_MARKER_PREFIX} type="countdown"`);
  });

  it('does not swallow the rest of the template', async () => {
    const mjml = await renderToMjml(
      makeContent([
        createTitleBlock({ content: '<p>Before</p>' }),
        createCountdownBlock(),
        createParagraphBlock({ content: '<p>After</p>' }),
      ]),
    );

    const html = await compile(mjml);
    expect(html).toContain('Before');
    expect(html).toContain('After');
    expect(html).toContain(UNRENDERABLE_MARKER_PREFIX);
  });
});
