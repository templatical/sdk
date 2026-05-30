// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { ref, computed } from "vue";
import { mount } from "@vue/test-utils";
import {
  EDITOR_KEY,
  TRANSLATIONS_KEY,
  FONTS_MANAGER_KEY,
  THEME_STYLES_KEY,
  UI_THEME_KEY,
  BLOCK_DEFAULTS_KEY,
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  ON_REQUEST_MERGE_TAG_KEY,
  ON_REQUEST_MEDIA_KEY,
  DISPLAY_CONDITIONS_KEY,
  ALLOW_CUSTOM_CONDITIONS_KEY,
  CAPABILITIES_KEY,
} from "../src/keys";
import { SYNTAX_PRESETS } from "@templatical/types";
import { makeStubTranslations } from "./helpers/translations";
import TableBlock from "../src/components/blocks/TableBlock.vue";

function createTableBlock(rows: Array<{ id: string; cells: Array<{ id: string; content: string }> }>) {
  return {
    id: "table-1",
    type: "table" as const,
    rows,
    hasHeaderRow: false,
    fontSize: 14,
    color: "#000",
    textAlign: "left" as const,
    fontFamily: "",
    borderWidth: 1,
    borderColor: "#ccc",
    cellPadding: 8,
    headerBackgroundColor: "",
  } as any;
}

function tableProvides(editor: any) {
  return {
    [EDITOR_KEY as symbol]: editor,
    [TRANSLATIONS_KEY as symbol]: makeStubTranslations(),
    [FONTS_MANAGER_KEY as symbol]: {
      fonts: ref([{ label: "Default", value: "" }]),
      loadCustomFonts: async () => {},
      cleanupFontLinks: () => {},
      setCustomFontsEnabled: () => {},
    },
    [THEME_STYLES_KEY as symbol]: computed(() => ({})),
    [UI_THEME_KEY as symbol]: computed(() => "light"),
    [BLOCK_DEFAULTS_KEY as symbol]: undefined,
    [MERGE_TAGS_KEY as symbol]: [],
    [MERGE_TAG_SYNTAX_KEY as symbol]: SYNTAX_PRESETS.liquid,
    [ON_REQUEST_MERGE_TAG_KEY as symbol]: null,
    [ON_REQUEST_MEDIA_KEY as symbol]: null,
    [DISPLAY_CONDITIONS_KEY as symbol]: [],
    [ALLOW_CUSTOM_CONDITIONS_KEY as symbol]: false,
    [CAPABILITIES_KEY as symbol]: {},
  };
}

function mountTable(block: any, editor: any, attachTo: Element = document.body) {
  return mount(TableBlock as any, {
    props: { block, viewport: "desktop" },
    attachTo,
    global: { provide: tableProvides(editor) },
  });
}

describe("TableBlock", () => {
  it("does not overwrite an actively-focused cell when the prop content updates", async () => {
    const block = createTableBlock([
      { id: "r1", cells: [{ id: "c1", content: "initial" }] },
    ]);
    const editor = {
      selectBlock: vi.fn(),
      updateBlock: vi.fn(),
    };

    const wrapper = mountTable(block, editor);
    const cell = wrapper.find('td[contenteditable="true"]');
    expect(cell.exists()).toBe(true);
    expect(cell.text()).toBe("initial");

    // Simulate user focusing the cell and typing — DOM is now the source
    // of truth for the cell's text.
    const cellEl = cell.element as HTMLElement;
    cellEl.focus();
    cellEl.textContent = "user typed text";

    // Sanity: the focused cell holds the user's in-progress text.
    expect(document.activeElement).toBe(cellEl);
    expect(cellEl.textContent).toBe("user typed text");

    // External update lands while the user is still focused (collab event,
    // peer edit, undo replay, autosave round-trip). The block prop content
    // changes from "initial" to "external update".
    await wrapper.setProps({
      block: createTableBlock([
        { id: "r1", cells: [{ id: "c1", content: "external update" }] },
      ]),
      viewport: "desktop",
    });

    // Bug: with `v-text="cell.content"` Vue overwrites the focused cell's
    // text, destroying the user's keystrokes. The fix should leave the
    // focused cell untouched.
    expect(document.activeElement).toBe(cellEl);
    expect(cellEl.textContent).toBe("user typed text");
  });

  it("does not overwrite an actively-focused cell when mounted in a shadow root", async () => {
    // The editor mounts in an open shadow root by default. Inside a shadow
    // root, document.activeElement resolves to the HOST, never the inner <td>,
    // so an `ownerDocument.activeElement === el` guard never fires and the
    // directive clobbers the user's in-progress keystrokes. The guard must use
    // el.getRootNode().activeElement, which returns the focused cell.
    const block = createTableBlock([
      { id: "r1", cells: [{ id: "c1", content: "initial" }] },
    ]);
    const editor = { selectBlock: vi.fn(), updateBlock: vi.fn() };

    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const mountPoint = document.createElement("div");
    shadow.appendChild(mountPoint);

    const wrapper = mountTable(block, editor, mountPoint);
    const cellEl = wrapper.find('td[contenteditable="true"]')
      .element as HTMLElement;

    cellEl.focus();
    cellEl.textContent = "user typed text";

    // Inside the shadow root, the root node tracks the focused cell while the
    // document only sees the host — exactly why ownerDocument.activeElement
    // is wrong here.
    expect((cellEl.getRootNode() as ShadowRoot).activeElement).toBe(cellEl);

    await wrapper.setProps({
      block: createTableBlock([
        { id: "r1", cells: [{ id: "c1", content: "external update" }] },
      ]),
      viewport: "desktop",
    });

    expect(cellEl.textContent).toBe("user typed text");

    wrapper.unmount();
    host.remove();
  });

  it("renders external content updates into cells that are NOT focused", async () => {
    const block = createTableBlock([
      { id: "r1", cells: [{ id: "c1", content: "initial" }] },
    ]);
    const editor = {
      selectBlock: vi.fn(),
      updateBlock: vi.fn(),
    };

    const wrapper = mountTable(block, editor);
    const cell = wrapper.find('td[contenteditable="true"]');
    expect((cell.element as HTMLElement).textContent).toBe("initial");

    // No focus — purely external update.
    await wrapper.setProps({
      block: createTableBlock([
        { id: "r1", cells: [{ id: "c1", content: "external update" }] },
      ]),
      viewport: "desktop",
    });

    expect((cell.element as HTMLElement).textContent).toBe("external update");
  });
});
