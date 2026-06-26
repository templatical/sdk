import { describe, expect, it } from 'vitest';
import {
  socialIcons,
  socialIconSizeMap,
  socialPlatformOptions,
} from '../src/constants/socialIcons';

describe('socialIcons', () => {
  it('has glyph definitions (color + path only) for all platform options', () => {
    for (const platform of socialPlatformOptions) {
      // toEqual (not objectContaining) asserts the glyph is exactly
      // { color, path } — no stray `name` leaked back in from the old shape.
      expect(socialIcons[platform]).toEqual({
        color: expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
        path: expect.any(String),
      });
      expect(socialIcons[platform].path.length).toBeGreaterThan(10);
    }
  });

  it('platform options and glyph keys are in lockstep', () => {
    expect([...socialPlatformOptions].sort()).toEqual(
      Object.keys(socialIcons).sort(),
    );
  });

  it('has 17 platforms', () => {
    expect(socialPlatformOptions).toHaveLength(17);
  });

  it('includes common platforms', () => {
    expect(socialPlatformOptions).toContain('facebook');
    expect(socialPlatformOptions).toContain('twitter');
    expect(socialPlatformOptions).toContain('instagram');
    expect(socialPlatformOptions).toContain('linkedin');
    expect(socialPlatformOptions).toContain('email');
    expect(socialPlatformOptions).toContain('website');
  });

  it('icon definitions have non-empty SVG paths', () => {
    for (const platform of socialPlatformOptions) {
      expect(socialIcons[platform].path.length).toBeGreaterThan(10);
    }
  });
});

describe('socialIconSizeMap', () => {
  it('has three sizes', () => {
    expect(Object.keys(socialIconSizeMap)).toEqual(['small', 'medium', 'large']);
  });

  it('sizes increase', () => {
    expect(socialIconSizeMap.small).toBeLessThan(socialIconSizeMap.medium);
    expect(socialIconSizeMap.medium).toBeLessThan(socialIconSizeMap.large);
  });

  it('has expected pixel values', () => {
    expect(socialIconSizeMap.small).toBe(24);
    expect(socialIconSizeMap.medium).toBe(32);
    expect(socialIconSizeMap.large).toBe(48);
  });
});
