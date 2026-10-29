// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { localeCoverage, safeClone, sourceHash } from "@templatical/types";
import { languages } from "../../../apps/playground/src/scenes/author/languages";
import { chooseLanguage, openLanguages } from "./helpers/localization";

// The scene's storage/collaboration adapters are unrelated to its content fixture.
vi.mock("../../../apps/playground/src/host/providers", () => ({
  templatesProviderFor: () => undefined,
  commentsProviderFor: () => undefined,
  PLAYGROUND_USER: { id: "playground-user", name: "Playground User" },
}));
vi.mock("../../../apps/playground/src/host/collaboration/client", () => ({
  createSharedCollaboration: () => {
    throw new Error("Unexpected collaboration setup");
  },
}));

it("retains the stale German entry after typing the scene's translation into the default title", async () => {
  const ctx = { search: new URLSearchParams() };
  const content = languages.content!(ctx);
  const { wrapper, editor } = await openLanguages({
    content,
    localization: languages.config(ctx).localization,
  });
  document.body.appendChild(wrapper.element);
  const title = () => wrapper.get('[data-block-id="languages-title"]');
  const original = safeClone(
    editor.content.value.blocks[0].l10n!.de.text!.content,
  );
  await title().get(".tpl-text-content").trigger("dblclick");
  const richText = await vi.waitFor(
    () => {
      const dom = title().find('[contenteditable="true"]');
      const instance = dom.exists()
        ? (dom.element as HTMLElement & { editor?: TiptapEditor }).editor
        : undefined;
      expect(instance).toBeDefined();
      return instance!;
    },
    { timeout: 15_000 },
  );
  richText.commands.selectAll();
  for (const text of "Willkommen zur Herbstkollektion") {
    const { view } = richText;
    const { from, to } = view.state.selection;
    const handled = view.someProp("handleTextInput", (handler) =>
      handler(view, from, to, text, () => view.state.tr.insertText(text)),
    );
    if (!handled) view.dispatch(view.state.tr.insertText(text));
    await nextTick();
  }
  await flushPromises();
  expect(editor.content.value.blocks[0]).toMatchObject({
    content: original.value,
    l10n: { de: { text: { content: original } } },
  });
  expect(localeCoverage(editor.content.value, "de").stale).toContain(
    "languages-title/content",
  );
  await chooseLanguage(wrapper, "de");
  expect(
    title()
      .get('[data-testid="locale-chip"][data-state="stale"]')
      .attributes("aria-label"),
  ).toContain("Out of date");
  await title().get('[data-testid="locale-chip"]').trigger("click");
  await wrapper.get('[data-testid="locale-keep"]').trigger("click");
  expect(editor.content.value.blocks[0].l10n?.de.text?.content).toEqual({
    value: original.value,
    sourceHash: sourceHash(original.value),
  });
  expect(localeCoverage(editor.content.value, "de").translated).toContain(
    "languages-title/content",
  );
});
