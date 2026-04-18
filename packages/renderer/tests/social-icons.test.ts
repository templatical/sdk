import { describe, expect, it } from 'vitest';
import { SOCIAL_ICONS, generateSocialIconDataUri } from '../src/social-icons';

describe('generateSocialIconDataUri', () => {
  it('returns a valid data URI format for a known platform', () => {
    const result = generateSocialIconDataUri('facebook', 'solid', 32);
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('returns empty string for an unknown platform', () => {
    const result = generateSocialIconDataUri('nonexistent', 'solid', 32);
    expect(result).toBe('');
  });

  it('generates solid style with rect background and rx=3', () => {
    const result = generateSocialIconDataUri('facebook', 'solid', 32);
    const svg = atob(result.replace('data:image/svg+xml;base64,', ''));
    expect(svg).toContain('rx="3"');
    expect(svg).toContain('fill="#1877F2"');
    expect(svg).toContain('fill="#ffffff"');
  });

  it('generates circle style with circle element', () => {
    const result = generateSocialIconDataUri('twitter', 'circle', 32);
    const svg = atob(result.replace('data:image/svg+xml;base64,', ''));
    expect(svg).toContain('<circle');
    expect(svg).toContain('r="12"');
  });

  it('generates rounded style with rx=6', () => {
    const result = generateSocialIconDataUri('instagram', 'rounded', 32);
    const svg = atob(result.replace('data:image/svg+xml;base64,', ''));
    expect(svg).toContain('rx="6"');
  });

  it('generates square style with rx=0', () => {
    const result = generateSocialIconDataUri('linkedin', 'square', 32);
    const svg = atob(result.replace('data:image/svg+xml;base64,', ''));
    expect(svg).toContain('rx="0"');
  });

  it('generates outlined style with transparent fill and stroke', () => {
    const result = generateSocialIconDataUri('youtube', 'outlined', 32);
    const svg = atob(result.replace('data:image/svg+xml;base64,', ''));
    expect(svg).toContain('fill="transparent"');
    expect(svg).toContain('stroke="#FF0000"');
    // Outlined uses brand color for icon, not white
    expect(svg).toContain(`fill="#FF0000"`);
  });

  it('falls back to solid-like style for unknown style string', () => {
    const result = generateSocialIconDataUri('facebook', 'unknown-style', 32);
    const svg = atob(result.replace('data:image/svg+xml;base64,', ''));
    // Default case: rect with rx="3"
    expect(svg).toContain('rx="3"');
    expect(svg).toContain('fill="#ffffff"');
  });

  it('includes the size parameter in the SVG width and height', () => {
    const result = generateSocialIconDataUri('facebook', 'solid', 48);
    const svg = atob(result.replace('data:image/svg+xml;base64,', ''));
    expect(svg).toContain('width="48"');
    expect(svg).toContain('height="48"');
  });

  it('generates a data URI for all known platforms', () => {
    const platforms = Object.keys(SOCIAL_ICONS);
    expect(platforms.length).toBeGreaterThan(0);

    for (const platform of platforms) {
      const result = generateSocialIconDataUri(platform, 'solid', 32);
      expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
    }
  });

  it('decoded SVG contains the icon path data', () => {
    const result = generateSocialIconDataUri('facebook', 'solid', 32);
    const svg = atob(result.replace('data:image/svg+xml;base64,', ''));
    expect(svg).toContain(SOCIAL_ICONS.facebook.path);
  });

  it('uses the correct brand color per platform', () => {
    const result = generateSocialIconDataUri('instagram', 'solid', 32);
    const svg = atob(result.replace('data:image/svg+xml;base64,', ''));
    expect(svg).toContain(`fill="${SOCIAL_ICONS.instagram.color}"`);
  });

  it('includes transform for icon scaling', () => {
    const result = generateSocialIconDataUri('github', 'solid', 32);
    const svg = atob(result.replace('data:image/svg+xml;base64,', ''));
    expect(svg).toContain('translate(4.8, 4.8) scale(0.6)');
  });
});
