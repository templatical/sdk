// Regression test for the conditional that decides whether MergeTagSuggestion
// is appended to the rich text editors' extensions array. Replicates the gate
// rather than booting a real TipTap editor (loadExtensions is async + dynamic).
import { describe, expect, it } from 'vitest';
import type { MergeTag, SyntaxPreset } from '@templatical/types';
import { SYNTAX_PRESETS, getSyntaxTriggerChar } from '@templatical/types';

interface GateInput {
  mergeTags: MergeTag[];
  syntax: SyntaxPreset;
  autocompleteEnabled: boolean;
}

/** Mirrors the gate used in ParagraphEditor.vue + TitleEditor.vue. */
function shouldAppendSuggestion(input: GateInput): boolean {
  const triggerChar = getSyntaxTriggerChar(input.syntax);
  return (
    input.autocompleteEnabled &&
    triggerChar !== null &&
    input.mergeTags.length > 0
  );
}

const tags: MergeTag[] = [{ label: 'First', value: '{{first}}' }];

describe('MergeTagSuggestion gate', () => {
  it('appends when all conditions met (liquid)', () => {
    expect(
      shouldAppendSuggestion({
        mergeTags: tags,
        syntax: SYNTAX_PRESETS.liquid,
        autocompleteEnabled: true,
      }),
    ).toBe(true);
  });

  it('appends with handlebars', () => {
    expect(
      shouldAppendSuggestion({
        mergeTags: tags,
        syntax: SYNTAX_PRESETS.handlebars,
        autocompleteEnabled: true,
      }),
    ).toBe(true);
  });

  it('appends with mailchimp', () => {
    expect(
      shouldAppendSuggestion({
        mergeTags: tags,
        syntax: SYNTAX_PRESETS.mailchimp,
        autocompleteEnabled: true,
      }),
    ).toBe(true);
  });

  it('appends with ampscript', () => {
    expect(
      shouldAppendSuggestion({
        mergeTags: tags,
        syntax: SYNTAX_PRESETS.ampscript,
        autocompleteEnabled: true,
      }),
    ).toBe(true);
  });

  it('does NOT append when mergeTags is empty', () => {
    expect(
      shouldAppendSuggestion({
        mergeTags: [],
        syntax: SYNTAX_PRESETS.liquid,
        autocompleteEnabled: true,
      }),
    ).toBe(false);
  });

  it('does NOT append when syntax is custom (no trigger char)', () => {
    const custom: SyntaxPreset = {
      value: /<<.+?>>/g,
      logic: /<%.+?%>/g,
    };
    expect(
      shouldAppendSuggestion({
        mergeTags: tags,
        syntax: custom,
        autocompleteEnabled: true,
      }),
    ).toBe(false);
  });

  it('does NOT append when autocomplete is disabled by consumer', () => {
    expect(
      shouldAppendSuggestion({
        mergeTags: tags,
        syntax: SYNTAX_PRESETS.liquid,
        autocompleteEnabled: false,
      }),
    ).toBe(false);
  });

  it('all gates required: tags+syntax pass but flag off → false', () => {
    expect(
      shouldAppendSuggestion({
        mergeTags: tags,
        syntax: SYNTAX_PRESETS.handlebars,
        autocompleteEnabled: false,
      }),
    ).toBe(false);
  });

  it('all gates required: flag+syntax pass but no tags → false', () => {
    expect(
      shouldAppendSuggestion({
        mergeTags: [],
        syntax: SYNTAX_PRESETS.handlebars,
        autocompleteEnabled: true,
      }),
    ).toBe(false);
  });
});

describe('MergeTagSuggestion wired into editors', () => {
  // Sentinel: ensure the suggestion extension is referenced in both rich
  // text editors. Logic of the gate is covered by `shouldAppendSuggestion`
  // tests above — this just guards against accidental deletion of the
  // wiring, without coupling to the exact gate expression.
  it('ParagraphEditor configures MergeTagSuggestion', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      'src/components/blocks/ParagraphEditor.vue',
      'utf8',
    );
    expect(src).toContain('MergeTagSuggestion.configure');
  });

  it('TitleEditor configures MergeTagSuggestion', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      'src/components/blocks/TitleEditor.vue',
      'utf8',
    );
    expect(src).toContain('MergeTagSuggestion.configure');
  });
});
