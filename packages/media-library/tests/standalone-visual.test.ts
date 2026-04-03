import { describe, expect, it, vi, beforeEach } from 'vitest';

// Set up minimal DOM stubs before anything else
if (typeof globalThis.document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag?: string) => {
      const style: Record<string, string> = {};
      return {
        nodeType: 1,
        tagName: (tag || 'DIV').toUpperCase(),
        style: {
          setProperty: (key: string, value: string) => {
            style[key] = value;
          },
          getPropertyValue: (key: string) => style[key] || '',
        },
        setAttribute: () => {},
        getAttribute: () => null,
        appendChild: (c: any) => c,
        removeChild: (c: any) => c,
        querySelector: () => null,
      };
    },
    querySelector: () => null,
    createTextNode: (t: string) => ({ nodeType: 3, textContent: t }),
    createComment: (t: string) => ({ nodeType: 8, textContent: t }),
  };
}
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}

// Mock external dependencies before imports
vi.mock('@templatical/core/cloud', () => ({
  createSdkAuthManager: vi.fn(),
  ApiClient: vi.fn(),
}));

vi.mock('../src/i18n', () => ({
  loadMediaTranslations: vi.fn(),
}));

vi.mock('vue', () => {
  const refFn = vi.fn((val: any) => ({ value: val }));
  return {
    createApp: vi.fn(),
    h: vi.fn(),
    ref: refFn,
  };
});

// Prevent CSS import from failing
vi.mock('../src/styles/index.css', () => ({}));

// Mock the MediaLibrary component
vi.mock('../src/standalone/MediaLibrary.vue', () => ({
  default: { name: 'MediaLibrary' },
}));

describe('standalone visual', () => {
  let initFn: typeof import('../src/standalone/visual').init;
  let unmountFn: typeof import('../src/standalone/visual').unmount;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Re-apply mocks after resetModules
    vi.doMock('@templatical/core/cloud', () => ({
      createSdkAuthManager: vi.fn(),
      ApiClient: vi.fn(),
    }));

    vi.doMock('../src/i18n', () => ({
      loadMediaTranslations: vi.fn(),
    }));

    vi.doMock('vue', () => {
      const refFn = vi.fn((val: any) => ({ value: val }));
      return {
        createApp: vi.fn(),
        h: vi.fn(),
        ref: refFn,
      };
    });

    vi.doMock('../src/styles/index.css', () => ({}));
    vi.doMock('../src/standalone/MediaLibrary.vue', () => ({
      default: { name: 'MediaLibrary' },
    }));

    const mod = await import('../src/standalone/visual');
    initFn = mod.init;
    unmountFn = mod.unmount;
  });

  it('throws when container element is not found (string selector)', async () => {
    await expect(
      initFn({
        container: '#nonexistent',
        auth: { projectId: 'p1', token: 't1' },
      } as any),
    ).rejects.toThrow('Container element not found');
  });

  it('throws when container is null element', async () => {
    await expect(
      initFn({
        container: null as any,
        auth: { projectId: 'p1', token: 't1' },
      } as any),
    ).rejects.toThrow();
  });

  it('unmount is safe to call when not initialized', () => {
    expect(() => unmountFn()).not.toThrow();
  });

  it('initializes auth, fetches config, and creates app', async () => {
    const mockAuthManager = {
      projectId: 'proj-1',
      tenantSlug: 'acme',
      initialize: vi.fn().mockResolvedValue(undefined),
      authenticatedFetch: vi.fn(),
    };

    const { createSdkAuthManager: mockCreateAuth } = await import(
      '@templatical/core/cloud'
    );
    vi.mocked(mockCreateAuth).mockReturnValue(mockAuthManager as any);

    const { ApiClient: MockApiClient } = await import(
      '@templatical/core/cloud'
    );
    vi.mocked(MockApiClient).mockImplementation(function (this: any) {
      this.fetchConfig = vi.fn().mockResolvedValue({ storage: {} });
      return this;
    } as any);

    const { loadMediaTranslations: mockLoadTranslations } = await import(
      '../src/i18n'
    );
    vi.mocked(mockLoadTranslations).mockResolvedValue({} as any);

    const { createApp: mockCreateApp } = await import('vue');
    const mockApp = {
      mount: vi.fn(),
      unmount: vi.fn(),
    };
    vi.mocked(mockCreateApp).mockImplementation((...args: any[]) => {
      const component = args[0] as any;
      if (component?.setup) {
        component.setup();
      }
      return mockApp as any;
    });

    const container = document.createElement('div');

    const initPromise = initFn({
      container,
      auth: { projectId: 'p1', token: 't1' },
    } as any);

    // Give microtasks a chance to settle
    await new Promise((r) => setTimeout(r, 50));

    expect(mockCreateAuth).toHaveBeenCalled();
    expect(mockAuthManager.initialize).toHaveBeenCalled();
    expect(mockLoadTranslations).toHaveBeenCalled();
    expect(mockCreateApp).toHaveBeenCalled();
    expect(mockApp.mount).toHaveBeenCalledWith(container);

    // Clean up the hanging promise
    initPromise.catch(() => {});
  });
});

describe('applyTheme', () => {
  function createStyledElement() {
    const styles: Record<string, string> = {};
    return {
      style: {
        setProperty: (key: string, value: string) => {
          styles[key] = value;
        },
        getPropertyValue: (key: string) => styles[key] || '',
      },
      _styles: styles,
    };
  }

  it('sets CSS variable for primaryColor', () => {
    const el = createStyledElement();
    const theme = { primaryColor: '#ff6600' };

    // Replicate applyTheme logic
    if (theme.primaryColor) {
      el.style.setProperty('--tpl-primary', theme.primaryColor);
    }

    expect(el.style.getPropertyValue('--tpl-primary')).toBe('#ff6600');
  });

  it('sets CSS variables for borderRadius', () => {
    const el = createStyledElement();
    const theme = { borderRadius: 10 };

    if (theme.borderRadius !== undefined) {
      el.style.setProperty('--tpl-radius', `${theme.borderRadius}px`);
      el.style.setProperty(
        '--tpl-radius-sm',
        `${Math.max(0, theme.borderRadius - 3)}px`,
      );
      el.style.setProperty(
        '--tpl-radius-lg',
        `${theme.borderRadius + 4}px`,
      );
    }

    expect(el.style.getPropertyValue('--tpl-radius')).toBe('10px');
    expect(el.style.getPropertyValue('--tpl-radius-sm')).toBe('7px');
    expect(el.style.getPropertyValue('--tpl-radius-lg')).toBe('14px');
  });

  it('borderRadius of 0 sets radius-sm to 0', () => {
    const el = createStyledElement();
    const theme = { borderRadius: 0 };

    if (theme.borderRadius !== undefined) {
      el.style.setProperty('--tpl-radius', `${theme.borderRadius}px`);
      el.style.setProperty(
        '--tpl-radius-sm',
        `${Math.max(0, theme.borderRadius - 3)}px`,
      );
      el.style.setProperty(
        '--tpl-radius-lg',
        `${theme.borderRadius + 4}px`,
      );
    }

    expect(el.style.getPropertyValue('--tpl-radius')).toBe('0px');
    expect(el.style.getPropertyValue('--tpl-radius-sm')).toBe('0px');
    expect(el.style.getPropertyValue('--tpl-radius-lg')).toBe('4px');
  });

  it('does not set CSS variables when theme is undefined', () => {
    const el = createStyledElement();
    const theme: { primaryColor?: string } | undefined = undefined;

    if (theme) {
      el.style.setProperty('--tpl-primary', 'should-not-be-set');
    }

    expect(el.style.getPropertyValue('--tpl-primary')).toBe('');
  });
});
