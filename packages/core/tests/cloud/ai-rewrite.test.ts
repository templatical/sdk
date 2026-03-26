import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useAiRewrite } from '../../src/cloud/ai-rewrite';
import type { AuthManager } from '../../src/cloud/auth';

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

const mockMergeTags = [{ label: 'Name', value: '{{name}}' }];

describe('useAiRewrite', () => {
  let authManager: AuthManager;

  beforeEach(() => {
    authManager = createMockAuthManager();
  });

  describe('reset', () => {
    it('clears all state', () => {
      const rw = useAiRewrite({ authManager, getTemplateId: () => 'tmpl-1' });

      rw.streamingText.value = 'partial';
      rw.previousContent.value = 'old';
      rw.rewrittenContent.value = 'new';
      rw.isReverted.value = true;
      rw.error.value = 'err';

      rw.reset();

      expect(rw.isRewriting.value).toBe(false);
      expect(rw.streamingText.value).toBe('');
      expect(rw.previousContent.value).toBeNull();
      expect(rw.rewrittenContent.value).toBeNull();
      expect(rw.isReverted.value).toBe(false);
      expect(rw.error.value).toBeNull();
    });
  });

  describe('undo', () => {
    it('returns previousContent when available', async () => {
      const rw = useAiRewrite({ authManager, getTemplateId: () => 'tmpl-1' });

      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'text', text: 'rewritten' },
          { type: 'done', content: '<p>rewritten</p>' },
        ]),
      );

      await rw.rewrite('<p>original</p>', 'make it bold', mockMergeTags);

      const result = rw.undo();

      expect(result).toBe('<p>original</p>');
      expect(rw.isReverted.value).toBe(true);
    });

    it('returns null when no previousContent', () => {
      const rw = useAiRewrite({ authManager, getTemplateId: () => 'tmpl-1' });

      const result = rw.undo();

      expect(result).toBeNull();
    });
  });

  describe('redo', () => {
    it('returns rewrittenContent when available', async () => {
      const rw = useAiRewrite({ authManager, getTemplateId: () => 'tmpl-1' });

      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'text', text: 'rewritten' },
          { type: 'done', content: '<p>rewritten</p>' },
        ]),
      );

      await rw.rewrite('<p>original</p>', 'make it bold', mockMergeTags);
      rw.undo();

      const result = rw.redo();

      expect(result).toBe('<p>rewritten</p>');
      expect(rw.isReverted.value).toBe(false);
    });

    it('returns null when no rewrittenContent', () => {
      const rw = useAiRewrite({ authManager, getTemplateId: () => 'tmpl-1' });

      const result = rw.redo();

      expect(result).toBeNull();
    });
  });

  describe('rewrite', () => {
    it('returns null when no templateId', async () => {
      const rw = useAiRewrite({ authManager, getTemplateId: () => null });

      const result = await rw.rewrite('content', 'instruction', mockMergeTags);

      expect(result).toBeNull();
      expect(authManager.authenticatedFetch).not.toHaveBeenCalled();
    });

    it('streams SSE text chunks and accumulates in streamingText', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'World' },
          { type: 'done', content: '<p>Hello World</p>' },
        ]),
      );

      const rw = useAiRewrite({ authManager, getTemplateId: () => 'tmpl-1' });

      const result = await rw.rewrite('<p>Hi</p>', 'expand it', mockMergeTags);

      expect(result).toBe('<p>Hello World</p>');
      expect(rw.streamingText.value).toBe('Hello World');
      expect(rw.previousContent.value).toBe('<p>Hi</p>');
      expect(rw.rewrittenContent.value).toBe('<p>Hello World</p>');
      expect(rw.isReverted.value).toBe(false);
      expect(rw.isRewriting.value).toBe(false);
    });

    it('handles 403 error', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Forbidden' }),
      } as unknown as Response);

      const rw = useAiRewrite({ authManager, getTemplateId: () => 'tmpl-1' });

      const result = await rw.rewrite('content', 'instruction', mockMergeTags);

      expect(result).toBeNull();
      expect(rw.error.value).toBe('ai_generation_not_available');
      expect(rw.isRewriting.value).toBe(false);
    });

    it('handles stream error events', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'text', text: 'partial' },
          { type: 'error', message: 'Generation failed' },
        ]),
      );

      const rw = useAiRewrite({ authManager, getTemplateId: () => 'tmpl-1' });

      const result = await rw.rewrite('content', 'instruction', mockMergeTags);

      expect(result).toBeNull();
      expect(rw.error.value).toBe('Generation failed');
      expect(rw.isRewriting.value).toBe(false);
    });

    it('handles response with null body', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: null,
        json: () => Promise.resolve({}),
      } as unknown as Response);

      const rw = useAiRewrite({ authManager, getTemplateId: () => 'tmpl-1' });
      const result = await rw.rewrite('content', 'instruction', mockMergeTags);

      expect(result).toBeNull();
      expect(rw.error.value).toBe('Failed to read stream');
      expect(rw.isRewriting.value).toBe(false);
    });

    it('does not set previousContent when done event has no content', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'done' },  // no content field
        ]),
      );

      const rw = useAiRewrite({ authManager, getTemplateId: () => 'tmpl-1' });
      const result = await rw.rewrite('original', 'instruction', mockMergeTags);

      expect(result).toBeNull();
      expect(rw.previousContent.value).toBeNull();
      expect(rw.rewrittenContent.value).toBeNull();
    });

    it('clears error state when starting a new rewrite', async () => {
      // First rewrite fails
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([{ type: 'error', message: 'First failure' }]),
      );

      const rw = useAiRewrite({ authManager, getTemplateId: () => 'tmpl-1' });
      await rw.rewrite('content', 'instruction', mockMergeTags);

      expect(rw.error.value).toBe('First failure');

      // Second rewrite succeeds - error should be cleared
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'done', content: '<p>success</p>' },
        ]),
      );

      await rw.rewrite('content', 'new instruction', mockMergeTags);

      expect(rw.error.value).toBeNull();
    });
  });

  describe('undo edge cases', () => {
    it('returns same previousContent on double undo', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'text', text: 'rewritten' },
          { type: 'done', content: '<p>rewritten</p>' },
        ]),
      );

      const rw = useAiRewrite({ authManager, getTemplateId: () => 'tmpl-1' });
      await rw.rewrite('<p>original</p>', 'make it bold', mockMergeTags);

      const first = rw.undo();
      const second = rw.undo();

      expect(first).toBe('<p>original</p>');
      expect(second).toBe('<p>original</p>');
      expect(rw.isReverted.value).toBe(true);
    });
  });

  describe('redo edge cases', () => {
    it('returns null when redo called without prior undo and no rewrite', () => {
      const rw = useAiRewrite({ authManager, getTemplateId: () => 'tmpl-1' });

      const result = rw.redo();

      expect(result).toBeNull();
    });
  });

  describe('rewrite -> undo -> new rewrite -> redo', () => {
    it('redo returns new rewrite content, not old one', async () => {
      const rw = useAiRewrite({ authManager, getTemplateId: () => 'tmpl-1' });

      // First rewrite
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'done', content: '<p>first rewrite</p>' },
        ]),
      );
      await rw.rewrite('<p>original</p>', 'instruction 1', mockMergeTags);

      // Undo first rewrite
      rw.undo();
      expect(rw.isReverted.value).toBe(true);

      // Second rewrite (replaces previous state)
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'done', content: '<p>second rewrite</p>' },
        ]),
      );
      await rw.rewrite('<p>original</p>', 'instruction 2', mockMergeTags);

      // Now undo second rewrite
      const undone = rw.undo();
      expect(undone).toBe('<p>original</p>');

      // Redo should return second rewrite content
      const redone = rw.redo();
      expect(redone).toBe('<p>second rewrite</p>');
    });
  });
});
