import { describe, expect, it } from 'vitest';
import { createVideoBlock } from '@templatical/types';
import { renderBlock, RenderContext } from '../src';

const ctx = new RenderContext(600, [], 'Arial, sans-serif', true);

describe('renderVideo', () => {
  it('extracts YouTube thumbnail from watch URL', () => {
    const block = createVideoBlock({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
    expect(result).toContain('href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
  });

  it('extracts YouTube thumbnail from youtu.be short URL', () => {
    const block = createVideoBlock({
      url: 'https://youtu.be/dQw4w9WgXcQ',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
  });

  it('extracts YouTube thumbnail from embed URL', () => {
    const block = createVideoBlock({
      url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
  });

  it('extracts YouTube thumbnail from shorts URL', () => {
    const block = createVideoBlock({
      url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
  });

  it('extracts Vimeo thumbnail from standard URL', () => {
    const block = createVideoBlock({
      url: 'https://vimeo.com/123456789',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('vumbnail.com/123456789.jpg');
    expect(result).toContain('href="https://vimeo.com/123456789"');
  });

  it('extracts Vimeo thumbnail from /video/ prefix URL', () => {
    const block = createVideoBlock({
      url: 'https://vimeo.com/video/123456789',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('vumbnail.com/123456789.jpg');
  });

  it('uses custom thumbnail when provided, overriding auto-detected', () => {
    const block = createVideoBlock({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnailUrl: 'https://example.com/custom-thumb.jpg',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('src="https://example.com/custom-thumb.jpg"');
    expect(result).not.toContain('img.youtube.com');
  });

  it('returns empty for malformed URL with no custom thumbnail', () => {
    const block = createVideoBlock({
      url: 'https://example.com/not-a-video',
      thumbnailUrl: '',
    });
    const result = renderBlock(block, ctx);
    expect(result).toBe('');
  });

  it('returns empty for empty URL and no thumbnail', () => {
    const block = createVideoBlock({ url: '', thumbnailUrl: '' });
    const result = renderBlock(block, ctx);
    expect(result).toBe('');
  });

  it('returns empty for hidden block', () => {
    const block = createVideoBlock({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      visibility: { desktop: false, tablet: false, mobile: false },
    });
    const result = renderBlock(block, ctx);
    expect(result).toBe('');
  });

  it('uses container width when width is full', () => {
    const block = createVideoBlock({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      width: 'full',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('width="600px"');
  });

  it('uses numeric width when specified', () => {
    const block = createVideoBlock({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      width: 400,
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('width="400px"');
  });

  it('escapes alt text in output', () => {
    const block = createVideoBlock({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      alt: 'My "great" video & more',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('alt="My &quot;great&quot; video &amp; more"');
  });

  it('includes target="_blank" for the video link', () => {
    const block = createVideoBlock({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    const result = renderBlock(block, ctx);
    expect(result).toContain('target="_blank"');
  });

  describe('edge cases', () => {
    it('returns empty string for empty url with no thumbnail', () => {
      const block = createVideoBlock({ url: '' });
      const result = renderBlock(block, ctx);
      expect(result).toBe('');
    });

    it('handles YouTube URL with extra query params', () => {
      const block = createVideoBlock({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PLtest',
      });
      const result = renderBlock(block, ctx);
      expect(result).toContain('img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
    });

    it('returns empty string for non-video URL with no thumbnail', () => {
      const block = createVideoBlock({
        url: 'https://example.com/not-a-video',
      });
      const result = renderBlock(block, ctx);
      expect(result).toBe('');
    });
  });
});
