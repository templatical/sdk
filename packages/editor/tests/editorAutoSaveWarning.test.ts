// @vitest-environment happy-dom
//
// `templates.autoSave: true` only means something when the provider can
// actually persist. A `save: false` provider is a supported, deliberate
// shape (a read-only store) — `requestAutoSave()` already no-ops on every
// tick for one, so the warning below is the only signal a consumer gets
// that the setting does nothing.
//
// Also covers the sibling warning for `changeDebounce`, and the timer's own
// wiring: `changeDebounce` reaching `useAutoSave` with no `templates`
// provider at all is what makes `onChange`-only pacing possible, so that
// path is pinned behaviourally rather than by a source-string check.

import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import {
  createDefaultTemplateContent,
  type Template,
  type TemplatePatch,
  type TemplatesProvider,
} from "@templatical/types";
import { useAutoSave } from "@templatical/core";
import Editor from "../src/Editor.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";
import { logger } from "../src/utils/logger";

// A passthrough spy: `useAutoSave` runs for real (so the timer it sets up is
// the real one), but its call arguments are recorded, which is the only way
// to observe what `Editor.vue` actually built for it from outside the
// component's closure.
vi.mock("@templatical/core", async () => {
  const actual =
    await vi.importActual<typeof import("@templatical/core")>(
      "@templatical/core",
    );
  return {
    ...actual,
    useAutoSave: vi.fn(actual.useAutoSave),
  };
});

async function mountEditor(templates: TemplatesProvider) {
  const translations = await loadTranslations("en");
  return mount(Editor, {
    props: {
      config: {
        container: document.createElement("div"),
        content: createDefaultTemplateContent(),
        templates,
      },
      translations,
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
}

// A second helper because `mountEditor` above always sets `templates` — the
// two describe blocks below need configs that either omit it entirely or
// pair it with `changeDebounce`.
async function mountEditorWithConfig(config: Record<string, unknown>) {
  const translations = await loadTranslations("en");
  return mount(Editor, {
    props: {
      config: {
        container: document.createElement("div"),
        content: createDefaultTemplateContent(),
        ...config,
      },
      translations,
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
}

describe("Editor.vue warns when autoSave is on but the provider can't save", () => {
  it("warns for a provider whose save is false", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const provider: TemplatesProvider = {
      load: vi.fn(async (id: string): Promise<Template> => ({
        id,
        content: createDefaultTemplateContent(),
      })),
      create: false,
      save: false,
      autoSave: true,
    };

    await mountEditor(provider);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(
      "config.templates.autoSave is on but this provider's save is false",
    );
  });

  it("does not warn for a provider with a real save function", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const callsBefore = warn.mock.calls.length;
    const provider: TemplatesProvider = {
      load: vi.fn(async (id: string): Promise<Template> => ({
        id,
        content: createDefaultTemplateContent(),
      })),
      create: false,
      save: vi.fn(
        async (id: string, patch: TemplatePatch): Promise<Template> => ({
          id,
          content: patch.content ?? createDefaultTemplateContent(),
        }),
      ),
      autoSave: true,
    };

    await mountEditor(provider);

    expect(warn.mock.calls.length - callsBefore).toBe(0);
  });
});

describe("Editor.vue's shared timer reaches useAutoSave with no templates provider", () => {
  it("passes config.changeDebounce through to useAutoSave when config.templates is absent", async () => {
    // `changeDebounce` sits at the config root instead of inside `templates`
    // precisely so it stays reachable here — a provider-less consumer using
    // only `onChange` still needs to set the cadence.
    vi.mocked(useAutoSave).mockClear();

    await mountEditorWithConfig({
      onChange: vi.fn(),
      changeDebounce: 500,
    });

    expect(vi.mocked(useAutoSave)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(useAutoSave).mock.calls[0][0]).toMatchObject({
      debounce: 500,
    });
  });
});

describe("Editor.vue warns when changeDebounce has nothing to consume it", () => {
  it("warns when a provider is present, autoSave is unset, and there is no onChange", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const callsBefore = warn.mock.calls.length;
    const provider: TemplatesProvider = {
      load: vi.fn(async (id: string): Promise<Template> => ({
        id,
        content: createDefaultTemplateContent(),
      })),
      create: false,
      save: vi.fn(
        async (id: string, patch: TemplatePatch): Promise<Template> => ({
          id,
          content: patch.content ?? createDefaultTemplateContent(),
        }),
      ),
      // autoSave intentionally left unset — the provably-inert combination.
    };

    await mountEditorWithConfig({ templates: provider, changeDebounce: 500 });

    expect(warn.mock.calls.length - callsBefore).toBe(1);
    expect(warn.mock.calls[warn.mock.calls.length - 1][0]).toContain(
      "config.changeDebounce is set but nothing will use it",
    );
  });

  it("does not warn when autoSave: false is explicit", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const callsBefore = warn.mock.calls.length;
    const provider: TemplatesProvider = {
      load: vi.fn(async (id: string): Promise<Template> => ({
        id,
        content: createDefaultTemplateContent(),
      })),
      create: false,
      save: vi.fn(
        async (id: string, patch: TemplatePatch): Promise<Template> => ({
          id,
          content: patch.content ?? createDefaultTemplateContent(),
        }),
      ),
      autoSave: false,
    };

    await mountEditorWithConfig({ templates: provider, changeDebounce: 500 });

    expect(warn.mock.calls.length - callsBefore).toBe(0);
  });
});
