import { describe, expect, it } from 'vitest';
import {
  socialIcons,
  socialIconSizeMap,
  socialPlatformOptions,
} from '../src/constants/socialIcons';

describe('socialIcons', () => {
  it('has definitions for all platform options', () => {
    for (const platform of socialPlatformOptions) {
      expect(socialIcons[platform]).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          color: expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
          path: expect.any(String),
        }),
      );
      expect(socialIcons[platform].name.length).toBeGreaterThan(0);
      expect(socialIcons[platform].path.length).toBeGreaterThan(10);
    }
  });

  it('has 16 platforms', () => {
    expect(socialPlatformOptions).toHaveLength(16);
  });

  it('includes common platforms', () => {
    expect(socialPlatformOptions).toContain('facebook');
    expect(socialPlatformOptions).toContain('twitter');
    expect(socialPlatformOptions).toContain('instagram');
    expect(socialPlatformOptions).toContain('linkedin');
    expect(socialPlatformOptions).toContain('email');
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
