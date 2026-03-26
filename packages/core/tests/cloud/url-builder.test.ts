import { describe, expect, it } from 'vitest';
import { buildUrl, API_ROUTES } from '../../src/cloud/url-builder';

describe('buildUrl', () => {
  it('replaces single placeholder', () => {
    expect(buildUrl('/api/{id}', { id: '42' })).toBe('/api/42');
  });

  it('replaces multiple placeholders', () => {
    expect(
      buildUrl('/api/{project}/tenants/{tenant}', {
        project: 'p1',
        tenant: 't1',
      }),
    ).toBe('/api/p1/tenants/t1');
  });

  it('URL-encodes parameter values', () => {
    expect(buildUrl('/api/{name}', { name: 'hello world' })).toBe(
      '/api/hello%20world',
    );
  });

  it('encodes special characters', () => {
    expect(buildUrl('/api/{q}', { q: 'a&b=c' })).toBe('/api/a%26b%3Dc');
  });

  it('replaces missing params with empty string', () => {
    expect(buildUrl('/api/{project}/tenants/{tenant}', { project: 'p1' })).toBe(
      '/api/p1/tenants/',
    );
  });

  it('returns template unchanged when no placeholders', () => {
    expect(buildUrl('/api/v1/health', {})).toBe('/api/v1/health');
  });

  it('handles empty params object', () => {
    expect(buildUrl('/api/{id}', {})).toBe('/api/');
  });
});

describe('API_ROUTES', () => {
  it('has health route without project/tenant prefix', () => {
    expect(API_ROUTES.health).toBe('/api/v1/health');
  });

  it('has template routes with correct structure', () => {
    expect(API_ROUTES['templates.store']).toContain('{project}');
    expect(API_ROUTES['templates.store']).toContain('{tenant}');
    expect(API_ROUTES['templates.store']).toContain('/templates');
  });

  it('has template-specific routes with template placeholder', () => {
    expect(API_ROUTES['templates.show']).toContain('{template}');
    expect(API_ROUTES['templates.update']).toContain('{template}');
    expect(API_ROUTES['templates.destroy']).toContain('{template}');
  });

  it('has snapshot routes with correct nesting', () => {
    expect(API_ROUTES['snapshots.index']).toContain('{template}/snapshots');
    expect(API_ROUTES['snapshots.restore']).toContain(
      '{snapshot}/restore',
    );
  });

  it('has comment routes with comment placeholder', () => {
    expect(API_ROUTES['comments.update']).toContain('{comment}');
    expect(API_ROUTES['comments.resolve']).toContain('{comment}/resolve');
  });

  it('has AI routes nested under template', () => {
    expect(API_ROUTES['ai.generate']).toContain('{template}/ai/generate');
    expect(API_ROUTES['ai.rewriteText']).toContain('{template}/ai/rewrite-text');
    expect(API_ROUTES['ai.score']).toContain('{template}/ai/score');
  });

  it('has media routes', () => {
    expect(API_ROUTES['media.upload']).toContain('/media/upload');
    expect(API_ROUTES['media.browse']).toContain('/media/browse');
    expect(API_ROUTES['media.update']).toContain('{media}');
  });

  it('has folder routes', () => {
    expect(API_ROUTES['folders.index']).toContain('/media/folders');
    expect(API_ROUTES['folders.update']).toContain('{mediaFolder}');
  });

  it('has saved module routes', () => {
    expect(API_ROUTES['savedModules.index']).toContain('/saved-modules');
    expect(API_ROUTES['savedModules.update']).toContain('{savedModule}');
  });

  it('builds a complete template URL', () => {
    const url = buildUrl(API_ROUTES['templates.show'], {
      project: 'proj-1',
      tenant: 'acme',
      template: 'tmpl-123',
    });
    expect(url).toBe(
      '/api/v1/projects/proj-1/tenants/acme/templates/tmpl-123',
    );
  });

  it('builds a complete snapshot restore URL', () => {
    const url = buildUrl(API_ROUTES['snapshots.restore'], {
      project: 'proj-1',
      tenant: 'acme',
      template: 'tmpl-1',
      snapshot: 'snap-1',
    });
    expect(url).toBe(
      '/api/v1/projects/proj-1/tenants/acme/templates/tmpl-1/snapshots/snap-1/restore',
    );
  });
});
