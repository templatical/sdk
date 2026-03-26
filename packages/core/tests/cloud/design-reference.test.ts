import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useDesignReference } from '../../src/cloud/design-reference';
import type { AuthManager } from '../../src/cloud/auth';
import type { TemplateContent } from '@templatical/types';

function createSSEResponse(events: Array<{ type: string; [key: string]: unknown }>, status = 200) {
  const lines = events.map((e) => `data: ${JSON.stringify(e)}\n`).join('\n');
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    },
  });

  return {
    ok: status >= 200 && status < 300,
    status,
    body: stream,
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

function createMockAuthManager(): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
    userConfig: { id: 'u1', name: 'User', signature: 'sig' },
  } as unknown as AuthManager;
}

describe('useDesignReference', () => {
  let authManager: AuthManager;
  let onApply: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    authManager = createMockAuthManager();
    onApply = vi.fn();
    onError = vi.fn();
  });

  describe('reset', () => {
    it('clears state', () => {
      const dr = useDesignReference({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
        onError,
      });

      dr.error.value = 'some error';

      dr.reset();

      expect(dr.isGenerating.value).toBe(false);
      expect(dr.error.value).toBeNull();
    });
  });

  describe('generate', () => {
    it('throws when no templateId', async () => {
      const dr = useDesignReference({
        authManager,
        getTemplateId: () => null,
        onApply,
        onError,
      });

      await expect(dr.generate({ prompt: 'test' })).rejects.toThrow(
        'Template must be saved before using design reference',
      );
    });

    it('sends FormData with prompt only', async () => {
      const resultContent = { rows: [{ id: 'r1' }] } as unknown as TemplateContent;

      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([{ type: 'done', content: resultContent }]),
      );

      const dr = useDesignReference({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
        onError,
      });

      const result = await dr.generate({ prompt: 'modern design' });

      expect(result).toEqual(resultContent);
      expect(onApply).toHaveBeenCalledWith(resultContent);
      expect(dr.isGenerating.value).toBe(false);

      const fetchCall = vi.mocked(authManager.authenticatedFetch).mock.calls[0];
      const body = fetchCall[1]?.body as FormData;
      expect(body.get('prompt')).toBe('modern design');
      expect(body.has('image_upload')).toBe(false);
      expect(body.has('pdf_upload')).toBe(false);
    });

    it('sends FormData with image upload', async () => {
      const resultContent = { rows: [] } as unknown as TemplateContent;

      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([{ type: 'done', content: resultContent }]),
      );

      const dr = useDesignReference({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      const imageFile = new File(['image-data'], 'design.png', { type: 'image/png' });
      await dr.generate({ imageUpload: imageFile });

      const fetchCall = vi.mocked(authManager.authenticatedFetch).mock.calls[0];
      const body = fetchCall[1]?.body as FormData;
      expect(body.get('image_upload')).toBe(imageFile);
      expect(body.has('prompt')).toBe(false);
    });

    it('sends FormData with pdf upload', async () => {
      const resultContent = { rows: [] } as unknown as TemplateContent;

      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([{ type: 'done', content: resultContent }]),
      );

      const dr = useDesignReference({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      const pdfFile = new File(['pdf-data'], 'design.pdf', { type: 'application/pdf' });
      await dr.generate({ pdfUpload: pdfFile });

      const fetchCall = vi.mocked(authManager.authenticatedFetch).mock.calls[0];
      const body = fetchCall[1]?.body as FormData;
      expect(body.get('pdf_upload')).toBe(pdfFile);
    });

    it('sends FormData with all fields', async () => {
      const resultContent = { rows: [] } as unknown as TemplateContent;

      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([{ type: 'done', content: resultContent }]),
      );

      const dr = useDesignReference({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      const imageFile = new File(['img'], 'design.png', { type: 'image/png' });
      const pdfFile = new File(['pdf'], 'design.pdf', { type: 'application/pdf' });
      await dr.generate({ prompt: 'match this', imageUpload: imageFile, pdfUpload: pdfFile });

      const fetchCall = vi.mocked(authManager.authenticatedFetch).mock.calls[0];
      const body = fetchCall[1]?.body as FormData;
      expect(body.get('prompt')).toBe('match this');
      expect(body.get('image_upload')).toBe(imageFile);
      expect(body.get('pdf_upload')).toBe(pdfFile);
    });

    it('calls onApply on success', async () => {
      const resultContent = { rows: [{ id: 'new' }] } as unknown as TemplateContent;

      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([{ type: 'done', content: resultContent }]),
      );

      const dr = useDesignReference({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      await dr.generate({ prompt: 'test' });

      expect(onApply).toHaveBeenCalledWith(resultContent);
    });

    it('sets error and calls onError on failure', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([{ type: 'error', message: 'Design generation failed' }]),
      );

      const dr = useDesignReference({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
        onError,
      });

      const result = await dr.generate({ prompt: 'test' });

      expect(result).toBeNull();
      expect(dr.error.value).toBe('Design generation failed');
      expect(onError).toHaveBeenCalled();
      expect(dr.isGenerating.value).toBe(false);
    });

    it('handles 403 error', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Forbidden' }),
      } as unknown as Response);

      const dr = useDesignReference({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
        onError,
      });

      const result = await dr.generate({ prompt: 'test' });

      expect(result).toBeNull();
      expect(dr.error.value).toBe('ai_generation_not_available');
      expect(onError).toHaveBeenCalled();
      expect(dr.isGenerating.value).toBe(false);
    });
  });
});
