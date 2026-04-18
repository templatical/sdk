import { describe, expect, it } from 'vitest';
import { useAiConfig } from '../../src/cloud/ai-config';

describe('useAiConfig', () => {
  describe('isFeatureEnabled', () => {
    it('returns false when config is false', () => {
      const { isFeatureEnabled } = useAiConfig(false);
      expect(isFeatureEnabled('chat')).toBe(false);
      expect(isFeatureEnabled('scoring')).toBe(false);
      expect(isFeatureEnabled('rewrite')).toBe(false);
    });

    it('returns true when config is undefined (defaults enabled)', () => {
      const { isFeatureEnabled } = useAiConfig(undefined);
      expect(isFeatureEnabled('chat')).toBe(true);
      expect(isFeatureEnabled('scoring')).toBe(true);
    });

    it('returns true for features not explicitly disabled', () => {
      const { isFeatureEnabled } = useAiConfig({ chat: false });
      expect(isFeatureEnabled('chat')).toBe(false);
      expect(isFeatureEnabled('scoring')).toBe(true);
    });

    it('returns false for explicitly disabled features', () => {
      const { isFeatureEnabled } = useAiConfig({
        chat: false,
        scoring: false,
        rewrite: false,
      });
      expect(isFeatureEnabled('chat')).toBe(false);
      expect(isFeatureEnabled('scoring')).toBe(false);
      expect(isFeatureEnabled('rewrite')).toBe(false);
    });
  });

  describe('hasAnyMenuFeature', () => {
    it('returns true when chat is enabled', () => {
      const { hasAnyMenuFeature } = useAiConfig({ chat: true });
      expect(hasAnyMenuFeature.value).toBe(true);
    });

    it('returns true when scoring is enabled', () => {
      const { hasAnyMenuFeature } = useAiConfig({ scoring: true });
      expect(hasAnyMenuFeature.value).toBe(true);
    });

    it('returns true when designToTemplate is enabled', () => {
      const { hasAnyMenuFeature } = useAiConfig({ designToTemplate: true });
      expect(hasAnyMenuFeature.value).toBe(true);
    });

    it('returns false when all menu features are disabled', () => {
      const { hasAnyMenuFeature } = useAiConfig({
        chat: false,
        scoring: false,
        designToTemplate: false,
      });
      expect(hasAnyMenuFeature.value).toBe(false);
    });

    it('returns false when config is false', () => {
      const { hasAnyMenuFeature } = useAiConfig(false);
      expect(hasAnyMenuFeature.value).toBe(false);
    });

    it('returns true when config is undefined', () => {
      const { hasAnyMenuFeature } = useAiConfig(undefined);
      expect(hasAnyMenuFeature.value).toBe(true);
    });

    it('ignores rewrite for menu feature check', () => {
      const { hasAnyMenuFeature } = useAiConfig({
        chat: false,
        scoring: false,
        designToTemplate: false,
        rewrite: true,
      });
      expect(hasAnyMenuFeature.value).toBe(false);
    });
  });
});
