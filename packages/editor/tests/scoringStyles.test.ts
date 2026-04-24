import { describe, expect, it } from 'vitest';
import {
  scoreColor,
  scoreBgColor,
  severityColor,
  severityBgColor,
} from '../src/cloud/utils/scoringStyles';

describe('scoreColor', () => {
  it('returns success color for score 100 (max)', () => {
    expect(scoreColor(100)).toBe('var(--tpl-success)');
  });

  it('returns success color at 80 (lower success boundary)', () => {
    expect(scoreColor(80)).toBe('var(--tpl-success)');
  });

  it('returns warning color at 79 (just below success)', () => {
    expect(scoreColor(79)).toBe('var(--tpl-warning)');
  });

  it('returns warning color at 60 (lower warning boundary)', () => {
    expect(scoreColor(60)).toBe('var(--tpl-warning)');
  });

  it('returns danger color at 59 (just below warning)', () => {
    expect(scoreColor(59)).toBe('var(--tpl-danger)');
  });

  it('returns danger color at 0', () => {
    expect(scoreColor(0)).toBe('var(--tpl-danger)');
  });
});

describe('scoreBgColor', () => {
  it('returns success-light at 80 (boundary)', () => {
    expect(scoreBgColor(80)).toBe('var(--tpl-success-light)');
  });

  it('returns warning-light at 60 (boundary)', () => {
    expect(scoreBgColor(60)).toBe('var(--tpl-warning-light)');
  });

  it('returns danger-light at 59 (below warning)', () => {
    expect(scoreBgColor(59)).toBe('var(--tpl-danger-light)');
  });
});

describe('severityColor', () => {
  it('returns danger for "high"', () => {
    expect(severityColor('high')).toBe('var(--tpl-danger)');
  });

  it('returns warning for "medium"', () => {
    expect(severityColor('medium')).toBe('var(--tpl-warning)');
  });

  it('returns text-muted for "low"', () => {
    expect(severityColor('low')).toBe('var(--tpl-text-muted)');
  });

  it('returns text-muted for unknown severity (fallback)', () => {
    expect(severityColor('unknown')).toBe('var(--tpl-text-muted)');
  });
});

describe('severityBgColor', () => {
  it('returns danger-light for "high"', () => {
    expect(severityBgColor('high')).toBe('var(--tpl-danger-light)');
  });

  it('returns warning-light for "medium"', () => {
    expect(severityBgColor('medium')).toBe('var(--tpl-warning-light)');
  });

  it('returns bg-hover for "low"', () => {
    expect(severityBgColor('low')).toBe('var(--tpl-bg-hover)');
  });

  it('returns bg-hover for unknown severity (fallback)', () => {
    expect(severityBgColor('unknown')).toBe('var(--tpl-bg-hover)');
  });
});
