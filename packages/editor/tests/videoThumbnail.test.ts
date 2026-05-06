import { describe, expect, it } from 'vitest';
import { parseVideoUrl, getVideoThumbnail } from '../src/utils/videoThumbnail';

describe('parseVideoUrl', () => {
  describe('YouTube', () => {
    it('parses standard watch URL', () => {
      const result = parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result.platform).toBe('youtube');
      expect(result.videoId).toBe('dQw4w9WgXcQ');
      expect(result.thumbnailUrl).toBe(
        'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      );
    });

    it('parses short URL', () => {
      const result = parseVideoUrl('https://youtu.be/dQw4w9WgXcQ');
      expect(result.platform).toBe('youtube');
      expect(result.videoId).toBe('dQw4w9WgXcQ');
    });

    it('parses embed URL', () => {
      const result = parseVideoUrl('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(result.platform).toBe('youtube');
      expect(result.videoId).toBe('dQw4w9WgXcQ');
    });

    it('parses shorts URL', () => {
      const result = parseVideoUrl('https://youtube.com/shorts/dQw4w9WgXcQ');
      expect(result.platform).toBe('youtube');
      expect(result.videoId).toBe('dQw4w9WgXcQ');
    });

    it('handles URL with extra query params', () => {
      const result = parseVideoUrl(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120',
      );
      expect(result.platform).toBe('youtube');
      expect(result.videoId).toBe('dQw4w9WgXcQ');
    });

    it('parses URL with uppercase host (case-insensitive domain)', () => {
      const result = parseVideoUrl(
        'https://WWW.YOUTUBE.COM/watch?v=dQw4w9WgXcQ',
      );
      expect(result.platform).toBe('youtube');
      expect(result.videoId).toBe('dQw4w9WgXcQ');
    });

    it('parses uppercase short URL', () => {
      const result = parseVideoUrl('https://YOUTU.BE/dQw4w9WgXcQ');
      expect(result.platform).toBe('youtube');
      expect(result.videoId).toBe('dQw4w9WgXcQ');
    });

    it('parses uppercase shorts URL', () => {
      const result = parseVideoUrl(
        'https://YOUTUBE.COM/shorts/dQw4w9WgXcQ',
      );
      expect(result.platform).toBe('youtube');
      expect(result.videoId).toBe('dQw4w9WgXcQ');
    });
  });

  describe('Vimeo', () => {
    it('parses standard Vimeo URL', () => {
      const result = parseVideoUrl('https://vimeo.com/123456789');
      expect(result.platform).toBe('vimeo');
      expect(result.videoId).toBe('123456789');
      expect(result.thumbnailUrl).toBe('https://vumbnail.com/123456789.jpg');
    });

    it('parses Vimeo video path URL', () => {
      const result = parseVideoUrl('https://vimeo.com/video/123456789');
      expect(result.platform).toBe('vimeo');
      expect(result.videoId).toBe('123456789');
    });

    it('parses uppercase Vimeo URL', () => {
      const result = parseVideoUrl('https://VIMEO.COM/123456789');
      expect(result.platform).toBe('vimeo');
      expect(result.videoId).toBe('123456789');
    });
  });

  describe('Unknown/Invalid', () => {
    it('returns unknown for empty string', () => {
      const result = parseVideoUrl('');
      expect(result.platform).toBe('unknown');
      expect(result.videoId).toBeNull();
      expect(result.thumbnailUrl).toBeNull();
    });

    it('returns unknown for non-video URL', () => {
      const result = parseVideoUrl('https://example.com/page');
      expect(result.platform).toBe('unknown');
      expect(result.videoId).toBeNull();
    });

    it('returns unknown for random text', () => {
      const result = parseVideoUrl('not a url');
      expect(result.platform).toBe('unknown');
    });
  });
});

describe('getVideoThumbnail', () => {
  it('returns custom thumbnail when provided', () => {
    const result = getVideoThumbnail(
      'https://youtube.com/watch?v=abc',
      'https://custom.com/thumb.jpg',
    );
    expect(result).toBe('https://custom.com/thumb.jpg');
  });

  it('returns auto-detected thumbnail for YouTube', () => {
    const result = getVideoThumbnail('https://youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result).toBe(
      'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    );
  });

  it('returns auto-detected thumbnail for Vimeo', () => {
    const result = getVideoThumbnail('https://vimeo.com/123456');
    expect(result).toBe('https://vumbnail.com/123456.jpg');
  });

  it('returns null for unknown URL without custom thumbnail', () => {
    const result = getVideoThumbnail('https://example.com/video');
    expect(result).toBeNull();
  });

  it('prefers custom thumbnail over auto-detected', () => {
    const result = getVideoThumbnail(
      'https://youtube.com/watch?v=abc',
      'https://my-cdn.com/custom.png',
    );
    expect(result).toBe('https://my-cdn.com/custom.png');
  });
});
