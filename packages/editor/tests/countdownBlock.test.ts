import './dom-stubs';

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const componentSource = readFileSync(
  resolve(__dirname, '../src/components/blocks/CountdownBlock.vue'),
  'utf-8',
);

describe('CountdownBlock.vue structure', () => {
  it('accepts block and viewport props', () => {
    expect(componentSource).toContain('block: CountdownBlockType');
    expect(componentSource).toContain('viewport: ViewportSize');
  });

  it('imports CountdownBlock type from @templatical/types', () => {
    expect(componentSource).toContain('CountdownBlock as CountdownBlockType');
  });

  it('shows empty state when no targetDate is set', () => {
    expect(componentSource).toContain('!block.targetDate');
    expect(componentSource).toContain('t.countdown.setDate');
  });

  it('shows expired hidden state', () => {
    expect(componentSource).toContain('isExpired && block.hideOnExpiry');
    expect(componentSource).toContain('t.countdown.hidden');
  });

  it('shows expired message state', () => {
    expect(componentSource).toContain('isExpired');
    expect(componentSource).toContain('block.expiredMessage');
  });

  it('renders segments with digits and labels', () => {
    expect(componentSource).toContain('segment.value');
    expect(componentSource).toContain('segment.label');
  });

  it('renders separator between segments', () => {
    expect(componentSource).toContain('block.separator');
  });

  it('applies digit styling from block properties', () => {
    expect(componentSource).toContain('block.digitFontSize');
    expect(componentSource).toContain('block.digitColor');
  });

  it('applies label styling from block properties', () => {
    expect(componentSource).toContain('block.labelFontSize');
    expect(componentSource).toContain('block.labelColor');
  });

  it('applies background color from block properties', () => {
    expect(componentSource).toContain('block.backgroundColor');
  });

  it('respects showDays toggle', () => {
    expect(componentSource).toContain('block.showDays');
  });

  it('respects showHours toggle', () => {
    expect(componentSource).toContain('block.showHours');
  });

  it('respects showMinutes toggle', () => {
    expect(componentSource).toContain('block.showMinutes');
  });

  it('respects showSeconds toggle', () => {
    expect(componentSource).toContain('block.showSeconds');
  });

  it('uses useI18n composable', () => {
    expect(componentSource).toContain("useI18n()");
  });

  it('uses useIntervalFn for automatic interval cleanup', () => {
    expect(componentSource).toContain('useIntervalFn');
  });

  it('computes remaining time from targetDate', () => {
    expect(componentSource).toContain('targetTime');
    expect(componentSource).toContain('remaining');
    expect(componentSource).toContain('days:');
    expect(componentSource).toContain('hours:');
    expect(componentSource).toContain('minutes:');
    expect(componentSource).toContain('seconds:');
  });

  it('pads digit values to 2 characters', () => {
    expect(componentSource).toContain("padStart(2");
  });

  it('supports custom font family', () => {
    expect(componentSource).toContain('block.fontFamily');
  });
});
