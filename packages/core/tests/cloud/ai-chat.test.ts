import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useAiChat } from '../../src/cloud/ai-chat';
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

/**
 * Build an SSE response whose body's `getReader()` is observable: returns
 * the spy on `cancel` so we can assert the consumer released the stream
 * after an early exit (e.g. an `error` event in the SSE payload).
 */
function createObservableSSEResponse(
  events: Array<{ type: string; [key: string]: unknown }>,
) {
  const lines = events.map((e) => `data: ${JSON.stringify(e)}\n`).join('\n');
  const encoder = new TextEncoder();
  const cancel = vi.fn(() => Promise.resolve());

  let emitted = false;
  const reader = {
    read: vi.fn(async () => {
      if (!emitted) {
        emitted = true;
        return { done: false, value: encoder.encode(lines) };
      }
      return { done: true, value: undefined };
    }),
    cancel,
    releaseLock: vi.fn(),
  };

  const response = {
    ok: true,
    status: 200,
    body: {
      getReader: () => reader,
    },
    json: () => Promise.resolve({}),
  } as unknown as Response;

  return { response, reader, cancel };
}

function createMockAuthManager(): AuthManager {
  return {
    projectId: 'proj-1',
    tenantSlug: 'acme',
    authenticatedFetch: vi.fn(),
    userConfig: { id: 'u1', name: 'User', signature: 'sig' },
  } as unknown as AuthManager;
}

const mockContent: TemplateContent = { rows: [], settings: {} } as unknown as TemplateContent;
const mockMergeTags = [{ label: 'Name', value: '{{name}}' }];

describe('useAiChat', () => {
  let authManager: AuthManager;
  let onApply: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    authManager = createMockAuthManager();
    onApply = vi.fn();
    onError = vi.fn();
  });

  describe('clearChat', () => {
    it('resets all state', () => {
      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      chat.messages.value = [{ id: '1', role: 'user', content: 'hi', timestamp: 1 }];
      chat.error.value = 'some error';
      chat.isLastChangeReverted.value = true;

      chat.clearChat();

      expect(chat.messages.value).toEqual([]);
      expect(chat.error.value).toBeNull();
      expect(chat.lastApplyMessageId.value).toBeNull();
      expect(chat.isLastChangeReverted.value).toBe(false);
    });
  });

  describe('toggleLastRevert', () => {
    it('toggles between previous and applied content and calls onApply', async () => {
      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      const resultContent = { rows: [{ id: 'new' }], settings: {} } as unknown as TemplateContent;

      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'text', text: 'Hello' },
          { type: 'done', text: 'Hello', content: resultContent, conversation_id: 'conv-1' },
        ]),
      );

      await chat.sendPrompt('make it better', mockContent, mockMergeTags);

      onApply.mockClear();

      // First toggle reverts to previous content
      chat.toggleLastRevert();
      expect(chat.isLastChangeReverted.value).toBe(true);
      expect(onApply).toHaveBeenCalledWith(mockContent);

      onApply.mockClear();

      // Second toggle re-applies the new content
      chat.toggleLastRevert();
      expect(chat.isLastChangeReverted.value).toBe(false);
      expect(onApply).toHaveBeenCalledWith(resultContent);
    });
  });

  describe('loadConversation', () => {
    it('skips when no templateId', async () => {
      const chat = useAiChat({
        authManager,
        getTemplateId: () => null,
        onApply,
      });

      await chat.loadConversation();

      expect(authManager.authenticatedFetch).not.toHaveBeenCalled();
    });

    it('fetches history and populates messages and conversationId', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            conversation_id: 'conv-42',
            data: [
              { id: 'm1', role: 'user', content: 'hi', created_at: '2025-01-01T00:00:00Z' },
              { id: 'm2', role: 'assistant', content: 'hello', created_at: '2025-01-01T00:00:01Z' },
            ],
          }),
      } as unknown as Response);

      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      await chat.loadConversation();

      expect(chat.messages.value).toHaveLength(2);
      expect(chat.messages.value[0]).toMatchObject({ id: 'm1', role: 'user', content: 'hi' });
      expect(chat.messages.value[1]).toMatchObject({ id: 'm2', role: 'assistant', content: 'hello' });
      expect(chat.isLoadingHistory.value).toBe(false);
    });
  });

  describe('sendPrompt', () => {
    it('throws when no templateId', async () => {
      const chat = useAiChat({
        authManager,
        getTemplateId: () => null,
        onApply,
      });

      await expect(chat.sendPrompt('hi', mockContent, mockMergeTags)).rejects.toThrow(
        'Template must be saved before using AI generation',
      );
    });

    it('adds user and assistant messages and streams SSE events', async () => {
      const resultContent = { rows: [{ id: 'r1' }] } as unknown as TemplateContent;

      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'text', text: 'Working...' },
          { type: 'done', text: 'Done!', content: resultContent, conversation_id: 'conv-1' },
        ]),
      );

      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      const result = await chat.sendPrompt('improve this', mockContent, mockMergeTags);

      expect(result).toEqual(resultContent);
      expect(onApply).toHaveBeenCalledWith(resultContent);
      expect(chat.isGenerating.value).toBe(false);
      expect(chat.messages.value).toHaveLength(2);
      expect(chat.messages.value[0].role).toBe('user');
      expect(chat.messages.value[0].content).toBe('improve this');
      expect(chat.messages.value[1].role).toBe('assistant');
      expect(chat.messages.value[1].content).toBe('Done!');
    });

    it('cancels the SSE reader when an error event aborts streaming', async () => {
      const { response, cancel } = createObservableSSEResponse([
        { type: 'error', message: 'stream aborted' },
      ]);
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(response);

      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
        onError,
      });

      await chat.sendPrompt('try this', mockContent, mockMergeTags);

      // The reader must be released even though the loop threw out before
      // consuming `done` — otherwise the underlying TCP socket and
      // unflushed buffer linger until GC.
      expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('sets error and failedPrompt and removes messages on failure', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([{ type: 'error', message: 'Something broke' }]),
      );

      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
        onError,
      });

      const result = await chat.sendPrompt('try this', mockContent, mockMergeTags);

      expect(result).toBeNull();
      expect(chat.error.value).toBe('Something broke');
      expect(chat.failedPrompt.value).toBe('try this');
      expect(chat.messages.value).toHaveLength(0);
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(chat.isGenerating.value).toBe(false);
    });

    it('handles 403 error', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Forbidden' }),
      } as unknown as Response);

      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
        onError,
      });

      const result = await chat.sendPrompt('hello', mockContent, mockMergeTags);

      expect(result).toBeNull();
      expect(chat.error.value).toBe('ai_generation_not_available');
      expect(chat.isGenerating.value).toBe(false);
    });

    it('handles response with null body', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: null,
        json: () => Promise.resolve({}),
      } as unknown as Response);

      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
        onError,
      });

      const result = await chat.sendPrompt('hi', mockContent, mockMergeTags);

      expect(result).toBeNull();
      expect(chat.error.value).toBe('Failed to read stream');
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('sets error when done event has no content', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'text', text: 'thinking...' },
          { type: 'done', text: 'result' },  // no content field
        ]),
      );

      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      const result = await chat.sendPrompt('hi', mockContent, mockMergeTags);

      expect(result).toBeNull();
      expect(chat.error.value).toBe('ai_apply_failed');
      expect(onApply).not.toHaveBeenCalled();
    });

    it('handles malformed JSON in SSE stream gracefully', async () => {
      // Build a stream with invalid JSON mixed in
      const encoder = new TextEncoder();
      const lines = 'data: {invalid json}\ndata: {"type":"done","text":"ok","content":{"blocks":[],"settings":{}},"conversation_id":"c1"}\n';
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(lines));
          controller.close();
        },
      });

      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: stream,
        json: () => Promise.resolve({}),
      } as unknown as Response);

      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      const result = await chat.sendPrompt('hi', mockContent, mockMergeTags);

      // Should skip invalid line and process valid done event
      expect(result).not.toBeNull();
      expect(onApply).toHaveBeenCalled();
    });

    it('ignores non-data lines in SSE stream', async () => {
      const encoder = new TextEncoder();
      const lines = 'event: ping\n: comment\ndata: {"type":"done","text":"ok","content":{"blocks":[],"settings":{}},"conversation_id":"c1"}\n';
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(lines));
          controller.close();
        },
      });

      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce({
        ok: true, status: 200, body: stream, json: () => Promise.resolve({}),
      } as unknown as Response);

      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      const result = await chat.sendPrompt('hi', mockContent, mockMergeTags);
      expect(result).not.toBeNull();
    });
  });

  describe('loadSuggestions', () => {
    it('streams SSE and extracts suggestions array (max 3)', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'done', suggestions: ['Improve CTA', 'Add personalization', 'Shorten subject', 'Extra one'] },
        ]),
      );

      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      await chat.loadSuggestions(mockContent, mockMergeTags);

      expect(chat.suggestions.value).toHaveLength(3);
      expect(chat.suggestions.value).toEqual(['Improve CTA', 'Add personalization', 'Shorten subject']);
      expect(chat.isLoadingSuggestions.value).toBe(false);
    });

    it('skips when no templateId', async () => {
      const chat = useAiChat({
        authManager,
        getTemplateId: () => null,
        onApply,
      });

      await chat.loadSuggestions(mockContent, mockMergeTags);

      expect(authManager.authenticatedFetch).not.toHaveBeenCalled();
    });

    it('handles non-OK response silently', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        body: null,
        json: () => Promise.resolve({}),
      } as unknown as Response);

      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      await chat.loadSuggestions(mockContent, mockMergeTags);

      expect(chat.suggestions.value).toEqual([]);
      expect(chat.isLoadingSuggestions.value).toBe(false);
    });

    it('handles null response body silently', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: null,
        json: () => Promise.resolve({}),
      } as unknown as Response);

      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      await chat.loadSuggestions(mockContent, mockMergeTags);

      expect(chat.suggestions.value).toEqual([]);
      expect(chat.isLoadingSuggestions.value).toBe(false);
    });

    it('handles fetch error silently', async () => {
      vi.mocked(authManager.authenticatedFetch).mockRejectedValueOnce(new Error('Network error'));

      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      await chat.loadSuggestions(mockContent, mockMergeTags);

      expect(chat.suggestions.value).toEqual([]);
      expect(chat.isLoadingSuggestions.value).toBe(false);
    });
  });

  describe('sendPrompt edge cases', () => {
    it('sends empty prompt string (no client-side validation)', async () => {
      const resultContent = { rows: [{ id: 'r1' }] } as unknown as TemplateContent;

      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'done', text: 'Result', content: resultContent, conversation_id: 'conv-1' },
        ]),
      );

      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      const result = await chat.sendPrompt('', mockContent, mockMergeTags);

      expect(result).toEqual(resultContent);
      expect(chat.messages.value[0].content).toBe('');
    });

    it('returns null when stream closes before done event (partial stream)', async () => {
      // Stream has text events but no done event - result stays null
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'text', text: 'Partial response...' },
        ]),
      );

      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      const result = await chat.sendPrompt('hi', mockContent, mockMergeTags);

      expect(result).toBeNull();
      // Messages should still be present (not removed since no error was thrown)
      expect(chat.messages.value).toHaveLength(2);
      expect(chat.isGenerating.value).toBe(false);
    });

    it('clears suggestions when sending a prompt', async () => {
      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      chat.suggestions.value = ['suggestion 1', 'suggestion 2'];

      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'done', text: 'Done', content: { rows: [] }, conversation_id: 'conv-1' },
        ]),
      );

      await chat.sendPrompt('hi', mockContent, mockMergeTags);

      expect(chat.suggestions.value).toEqual([]);
    });
  });

  describe('clearChat edge cases', () => {
    it('does not clear suggestions', () => {
      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      chat.suggestions.value = ['suggestion 1', 'suggestion 2'];

      chat.clearChat();

      expect(chat.suggestions.value).toEqual(['suggestion 1', 'suggestion 2']);
    });
  });

  describe('toggleLastRevert edge cases', () => {
    it('does not call onApply when no previous content (null lastPreviousContent)', () => {
      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      // No prior sendPrompt - both lastPreviousContent and lastAppliedContent are null
      chat.toggleLastRevert();

      expect(onApply).not.toHaveBeenCalled();
      expect(chat.isLastChangeReverted.value).toBe(true);
    });

    it('does not call onApply when re-applying with null lastAppliedContent', () => {
      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      // Force reverted state without actual content
      chat.isLastChangeReverted.value = true;

      chat.toggleLastRevert();

      expect(onApply).not.toHaveBeenCalled();
      expect(chat.isLastChangeReverted.value).toBe(false);
    });

    it('triple toggle: revert -> re-apply -> revert again', async () => {
      const chat = useAiChat({
        authManager,
        getTemplateId: () => 'tmpl-1',
        onApply,
      });

      const resultContent = { rows: [{ id: 'new' }], settings: {} } as unknown as TemplateContent;

      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'done', text: 'Hello', content: resultContent, conversation_id: 'conv-1' },
        ]),
      );

      await chat.sendPrompt('make it better', mockContent, mockMergeTags);
      onApply.mockClear();

      // First toggle: revert
      chat.toggleLastRevert();
      expect(chat.isLastChangeReverted.value).toBe(true);
      expect(onApply).toHaveBeenCalledWith(mockContent);

      onApply.mockClear();

      // Second toggle: re-apply
      chat.toggleLastRevert();
      expect(chat.isLastChangeReverted.value).toBe(false);
      expect(onApply).toHaveBeenCalledWith(resultContent);

      onApply.mockClear();

      // Third toggle: revert again
      chat.toggleLastRevert();
      expect(chat.isLastChangeReverted.value).toBe(true);
      expect(onApply).toHaveBeenCalledWith(mockContent);
    });
  });
});
