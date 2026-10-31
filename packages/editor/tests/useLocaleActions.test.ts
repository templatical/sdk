// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { useEditor, useHistory } from "@templatical/core";
import {
  applyOperationsInPlace,
  createDefaultTemplateContent,
  createTitleBlock,
  OperationError,
  safeClone,
} from "@templatical/types";
import { useLocaleActions } from "../src/composables/useLocaleActions";
const cleanups: (() => void)[] = [];
afterEach(() =>
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup()),
);
function open(onLocaleChange?: (locale: string) => void) {
  const seed = createDefaultTemplateContent();
  seed.settings.locale = "en";
  seed.settings.locales = ["de", "fr"];
  seed.blocks = [
    createTitleBlock({
      id: "t1",
      content: "Hello",
      l10n: {
        de: { text: { content: { value: "Hallo", sourceHash: "00000000" } } },
      },
    }),
  ];
  const scope = effectScope();
  const value = scope.run(() => {
    const editor = useEditor({
      content: seed,
      localization: { locales: ["de", "fr"] },
      onLocaleChange,
    });
    const history = useHistory({
      content: editor.content,
      setContent: editor.setContent,
    });
    cleanups.push(history.destroy);
    return { editor, history };
  })!;
  cleanups.push(() => scope.stop());
  return { ...value, scope };
}
describe("useLocaleActions", () => {
  it("makes the default in one undo step and moves the active view", () => {
    const { editor, history } = open();
    editor.setActiveLocale("fr");
    const before = safeClone(editor.content.value);
    const actions = useLocaleActions({ editor, history: () => history });
    expect(actions.setDefaultLocale("de")).toEqual({ applied: true });
    expect(editor.content.value.settings.locale).toBe("de");
    expect(editor.activeLocale.value).toBe(null);
    expect(editor.state.isDirty).toBe(true);
    history.undo();
    expect(editor.content.value).toEqual(before);
    expect(history.canUndo.value).toBe(false);
  });
  it("submits the exact explicit collaboration operation and moves the view on success", () => {
    const { editor, history } = open();
    const apply = vi.fn((ops) => {
      applyOperationsInPlace(editor.content.value, ops);
      return { applied: true as const, inverse: [] };
    });
    const actions = useLocaleActions({
      editor,
      history: () => history,
      collaboration: { core: { applyOperations: apply } },
    });
    expect(actions.setDefaultLocale("de")).toEqual({ applied: true });
    expect(apply).toHaveBeenCalledExactlyOnceWith(
      [{ op: "setDefaultLocale", locale: "de" }],
      {},
    );
    expect(editor.activeLocale.value).toBe(null);
    expect(history.canUndo.value).toBe(false);
  });
  it("leaves content, view, undo and redo untouched on a local refusal", () => {
    const { editor, history } = open();
    history.record();
    editor.content.value.settings.width = 640;
    history.undo();
    const before = safeClone(editor.content.value);
    const actions = useLocaleActions({ editor, history: () => history });
    expect(actions.setDefaultLocale("es")).toMatchObject({
      applied: false,
      error: { code: "invalid_operation" },
    });
    expect(editor.content.value).toEqual(before);
    expect(editor.activeLocale.value).toBe(null);
    expect(history.canUndo.value).toBe(false);
    expect(history.canRedo.value).toBe(true);
  });
  it("returns a collaboration refusal without moving the view or changing content", () => {
    const { editor, history } = open();
    const before = safeClone(editor.content.value);
    const error = new OperationError(
      "locked_by_others",
      0,
      "Other sessions hold locks on this template.",
    );
    const actions = useLocaleActions({
      editor,
      history: () => history,
      collaboration: {
        core: { applyOperations: () => ({ applied: false as const, error }) },
      },
    });
    expect(actions.setDefaultLocale("de")).toEqual({ applied: false, error });
    expect(editor.content.value).toEqual(before);
    expect(editor.activeLocale.value).toBe(null);
  });
});

describe("onLocaleChange on the effective language", () => {
  it("fires for Make default from the default view, its undo and its redo", () => {
    const onLocaleChange = vi.fn();
    const { editor, history } = open(onLocaleChange);
    const actions = useLocaleActions({ editor, history: () => history });
    expect(actions.setDefaultLocale("de")).toEqual({ applied: true });
    expect(editor.activeLocale.value).toBe(null);
    expect(onLocaleChange.mock.calls).toEqual([["de"]]);
    history.undo();
    expect(editor.content.value.settings.locale).toBe("en");
    expect(onLocaleChange.mock.calls).toEqual([["de"], ["en"]]);
    history.redo();
    expect(editor.content.value.settings.locale).toBe("de");
    expect(onLocaleChange.mock.calls).toEqual([["de"], ["en"], ["de"]]);
  });
  it("fires nothing when the active version is promoted", () => {
    const onLocaleChange = vi.fn();
    const { editor, history } = open(onLocaleChange);
    editor.setActiveLocale("de");
    expect(onLocaleChange.mock.calls).toEqual([["de"]]);
    const actions = useLocaleActions({ editor, history: () => history });
    expect(actions.setDefaultLocale("de")).toEqual({ applied: true });
    expect(editor.activeLocale.value).toBe(null);
    expect(onLocaleChange.mock.calls).toEqual([["de"]]);
  });
  it("still reports selecting a version and falling back to the default", () => {
    const onLocaleChange = vi.fn();
    const { editor } = open(onLocaleChange);
    editor.setActiveLocale("fr");
    editor.setActiveLocale("fr");
    editor.removeLocale("fr");
    expect(editor.activeLocale.value).toBe(null);
    expect(onLocaleChange.mock.calls).toEqual([["fr"], ["en"]]);
  });
});
