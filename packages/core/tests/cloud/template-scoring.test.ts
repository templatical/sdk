import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useTemplateScoring } from '../../src/cloud/template-scoring';
import type { AuthManager } from '../../src/cloud/auth';
import type { ScoringResult, TemplateContent } from '@templatical/types';

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

const mockContent: TemplateContent = { rows: [], settings: {} } as unknown as TemplateContent;
const mockMergeTags = [{ label: 'Name', value: '{{name}}' }];

const mockScoringResult: ScoringResult = {
  score: 85,
  categories: {
    spam: {
      score: 90,
      findings: [
        { id: 'f1', severity: 'warning', message: 'Spammy words', blockId: 'b1', category: 'spam', suggestion: 'Remove spam words' },
      ],
    },
    readability: {
      score: 80,
      findings: [
        { id: 'f2', severity: 'error', message: 'Too long', blockId: 'b2', category: 'readability', suggestion: 'Shorten text' },
      ],
    },
    accessibility: { score: 90, findings: [] },
    bestPractices: { score: 80, findings: [] },
  },
};

describe('useTemplateScoring', () => {
  let authManager: AuthManager;

  beforeEach(() => {
    authManager = createMockAuthManager();
  });

  describe('reset', () => {
    it('clears all state', () => {
      const scoring = useTemplateScoring({ authManager, getTemplateId: () => 'tmpl-1' });

      scoring.scoringResult.value = mockScoringResult;
      scoring.error.value = 'err';
      scoring.fixStreamingText.value = 'partial';

      scoring.reset();

      expect(scoring.isScoring.value).toBe(false);
      expect(scoring.scoringResult.value).toBeNull();
      expect(scoring.error.value).toBeNull();
      expect(scoring.fixingFindingId.value).toBeNull();
      expect(scoring.fixStreamingText.value).toBe('');
      expect(scoring.fixError.value).toBeNull();
    });
  });

  describe('removeFinding', () => {
    it('removes finding from category', () => {
      const scoring = useTemplateScoring({ authManager, getTemplateId: () => 'tmpl-1' });
      scoring.scoringResult.value = JSON.parse(JSON.stringify(mockScoringResult));

      scoring.removeFinding('spam', 'f1');

      expect(scoring.scoringResult.value!.categories.spam.findings).toHaveLength(0);
    });

    it('no-ops when result is null', () => {
      const scoring = useTemplateScoring({ authManager, getTemplateId: () => 'tmpl-1' });

      // Should not throw
      scoring.removeFinding('spam', 'f1');
    });

    it('no-ops when category is missing', () => {
      const scoring = useTemplateScoring({ authManager, getTemplateId: () => 'tmpl-1' });
      scoring.scoringResult.value = {
        score: 100,
        categories: {} as ScoringResult['categories'],
      };

      // Should not throw
      scoring.removeFinding('spam', 'f1');
    });
  });

  describe('score', () => {
    it('returns null when no templateId', async () => {
      const scoring = useTemplateScoring({ authManager, getTemplateId: () => null });

      const result = await scoring.score(mockContent, mockMergeTags);

      expect(result).toBeNull();
      expect(authManager.authenticatedFetch).not.toHaveBeenCalled();
    });

    it('streams SSE to get result and enriches findings with category field', async () => {
      // The result from SSE won't have category on findings - the code adds it
      const sseResult = {
        score: 85,
        categories: {
          spam: {
            score: 90,
            findings: [
              { id: 'f1', severity: 'warning', message: 'Spammy words', blockId: 'b1', suggestion: 'Fix it' },
            ],
          },
          readability: { score: 80, findings: [] },
          accessibility: { score: 90, findings: [] },
          bestPractices: { score: 80, findings: [] },
        },
      };

      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([{ type: 'done', result: sseResult }]),
      );

      const scoring = useTemplateScoring({ authManager, getTemplateId: () => 'tmpl-1' });

      const result = await scoring.score(mockContent, mockMergeTags);

      expect(result).not.toBeNull();
      expect(result!.score).toBe(85);
      expect(result!.categories.spam.findings[0].category).toBe('spam');
      expect(scoring.scoringResult.value).toEqual(result);
      expect(scoring.isScoring.value).toBe(false);
    });

    it('handles 403 error', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Forbidden' }),
      } as unknown as Response);

      const scoring = useTemplateScoring({ authManager, getTemplateId: () => 'tmpl-1' });

      const result = await scoring.score(mockContent, mockMergeTags);

      expect(result).toBeNull();
      expect(scoring.error.value).toBe('ai_generation_not_available');
      expect(scoring.isScoring.value).toBe(false);
    });

    it('handles SSE error events', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([{ type: 'error', message: 'Scoring failed' }]),
      );

      const scoring = useTemplateScoring({ authManager, getTemplateId: () => 'tmpl-1' });

      const result = await scoring.score(mockContent, mockMergeTags);

      expect(result).toBeNull();
      expect(scoring.error.value).toBe('Scoring failed');
      expect(scoring.isScoring.value).toBe(false);
    });
  });

  describe('fixFinding', () => {
    it('streams SSE fix text and returns result on done', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([
          { type: 'text', text: 'Fixed ' },
          { type: 'text', text: 'content' },
          { type: 'done', content: '<p>Fixed content</p>' },
        ]),
      );

      const scoring = useTemplateScoring({ authManager, getTemplateId: () => 'tmpl-1' });

      const finding = {
        id: 'f1',
        severity: 'warning' as const,
        message: 'Spammy',
        blockId: 'b1',
        category: 'spam' as const,
        suggestion: 'Remove spam',
      };

      const result = await scoring.fixFinding('<p>Spammy content</p>', finding, mockMergeTags);

      expect(result).toBe('<p>Fixed content</p>');
      expect(scoring.fixStreamingText.value).toBe('Fixed content');
      expect(scoring.fixingFindingId.value).toBeNull();
    });

    it('sets fixError on failure', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([{ type: 'error', message: 'Fix failed' }]),
      );

      const scoring = useTemplateScoring({ authManager, getTemplateId: () => 'tmpl-1' });

      const finding = {
        id: 'f1',
        severity: 'warning' as const,
        message: 'Spammy',
        blockId: 'b1',
        category: 'spam' as const,
        suggestion: 'Remove spam',
      };

      const result = await scoring.fixFinding('<p>content</p>', finding, mockMergeTags);

      expect(result).toBeNull();
      expect(scoring.fixError.value).toBe('Fix failed');
      expect(scoring.fixingFindingId.value).toBeNull();
    });

    it('resets fixingFindingId in finally', async () => {
      vi.mocked(authManager.authenticatedFetch).mockResolvedValueOnce(
        createSSEResponse([{ type: 'done', content: 'fixed' }]),
      );

      const scoring = useTemplateScoring({ authManager, getTemplateId: () => 'tmpl-1' });

      const finding = {
        id: 'f99',
        severity: 'error' as const,
        message: 'Issue',
        blockId: 'b1',
        category: 'readability' as const,
        suggestion: 'Fix it',
      };

      await scoring.fixFinding('content', finding, mockMergeTags);

      expect(scoring.fixingFindingId.value).toBeNull();
    });

    it('returns null when no templateId', async () => {
      const scoring = useTemplateScoring({ authManager, getTemplateId: () => null });

      const finding = {
        id: 'f1',
        severity: 'warning' as const,
        message: 'Spammy',
        blockId: 'b1',
        category: 'spam' as const,
        suggestion: 'Remove spam',
      };

      const result = await scoring.fixFinding('content', finding, mockMergeTags);

      expect(result).toBeNull();
    });
  });
});
