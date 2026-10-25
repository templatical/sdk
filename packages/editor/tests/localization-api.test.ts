// @vitest-environment happy-dom
import { resolve } from "node:path";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { VueDraggable } from "vue-draggable-plus";
import {
  createDefaultTemplateContent,
  createTitleBlock,
  createSectionBlock,
  safeClone,
  sourceHash,
  type TemplateContent,
  type CustomBlockDefinition,
} from "@templatical/types";
import {
  init,
  type TemplaticalEditor,
  type TemplaticalEditorConfig,
} from "../src/index";
import Editor from "../src/Editor.vue";
import Canvas from "../src/components/Canvas.vue";
import TitleBlock from "../src/components/blocks/TitleBlock.vue";
import BlockWrapper from "../src/components/blocks/BlockWrapper.vue";
import RightSidebar from "../src/components/RightSidebar.vue";
import SectionBlock from "../src/components/blocks/SectionBlock.vue";
import { useFonts } from "../src/composables";
import { loadTranslations } from "../src/i18n";
import { FakeCollaborationServer } from "../../core/tests/helpers/fake-collaboration-server";
import {
  AGENT,
  openClient,
  settle,
} from "../../core/tests/helpers/collaboration-harness";
import { EDITOR_KEY, HISTORY_KEY } from "../src/keys";
import {
  normalizeContentForConfig,
  normalizeRemoteOperations,
} from "../src/utils/normalizeMergeTagMarkup";

function content(): TemplateContent {
  const result = createDefaultTemplateContent();
  result.settings.locale = "en";
  result.settings.locales = ["de"];
  result.settings.l10n = {
    de: {
      set: {
        direction: "rtl",
        backgroundColor: "#123456",
        textColor: "#ffffff",
      },
    },
  };
  result.blocks = [
    createTitleBlock({
      id: "t1",
      content: "<p>Hello</p>",
      l10n: {
        de: {
          text: {
            content: {
              value: "<p>Hallo</p>",
              source: sourceHash("<p>Hello</p>"),
            },
          },
          set: {
            styles: { padding: { top: 25, right: 0, bottom: 0, left: 0 } },
          },
        },
      },
    }),
  ];
  return result;
}
const handles: TemplaticalEditor[] = [];
const wrappers: VueWrapper[] = [];
afterEach(() => {
  for (const handle of handles.splice(0)) handle.unmount();
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  document.body.innerHTML = "";
});
async function open(config: Partial<TemplaticalEditorConfig> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const handle = await init({
    container,
    shadowDom: false,
    content: content(),
    localization: { locales: ["de", "fr"] },
    ...config,
  });
  handles.push(handle);
  return { handle, container };
}
async function real(config: Partial<TemplaticalEditorConfig> = {}) {
  const wrapper = mount(Editor, {
    props: {
      config: {
        container: document.createElement("div"),
        content: content(),
        localization: { locales: ["de", "fr"] },
        ...config,
      },
      translations: await loadTranslations("en"),
      fontsManager: useFonts(undefined),
    } as never,
    global: { stubs: { teleport: true } },
  });
  wrappers.push(wrapper);
  const canvas = wrapper.findComponent(Canvas);
  const editor = (canvas.vm as any).$.provides[EDITOR_KEY as symbol];
  return { wrapper, editor, canvas };
}

describe("localization API", () => {
  it("starts at default, switches the canvas and notifies only a real change", async () => {
    const onLocaleChange = vi.fn();
    const { handle, container } = await open({ onLocaleChange });
    expect(handle.getLocale()).toBe("en");
    handle.setLocale("de");
    await nextTick();
    expect(handle.getLocale()).toBe("de");
    expect(container.querySelector(".tpl-canvas")?.textContent).toContain(
      "Hallo",
    );
    expect(onLocaleChange).toHaveBeenCalledExactlyOnceWith("de");
    handle.setLocale("de");
    expect(onLocaleChange).toHaveBeenCalledTimes(1);
    expect(() => handle.setLocale("fr")).toThrow(
      expect.objectContaining({ code: "unknown_locale" }),
    );
  });

  it("renders a requested language with the local renderer", async () => {
    const { handle } = await open();
    expect(await handle.toMjml({ locale: "de" })).toContain("Hallo");
    expect(await handle.toMjml()).toContain("Hello");
  });

  it("keeps layers byte-identical with localization off and refuses non-default views", async () => {
    const seed = content();
    const before = JSON.stringify(seed);
    const { handle } = await open({ localization: undefined, content: seed });
    expect(() => handle.setLocale("de")).toThrow(
      expect.objectContaining({ code: "unknown_locale" }),
    );
    expect(handle.getLocale()).toBe("en");
    expect(JSON.stringify(handle.getContent())).toBe(before);
  });

  it.each([undefined, { locales: ["de"] }])(
    "edits a skill example without introducing localization: %j",
    async (localization) => {
      const seed = JSON.parse(
        readFileSync(
          resolve(
            import.meta.dirname,
            "../../../skills/templatical/reference/examples/newsletter.json",
          ),
          "utf8",
        ),
      ) as TemplateContent;
      const expected = safeClone(seed);
      const locate = (blocks: any[]): any =>
        blocks
          .flatMap((block) => [
            block,
            ...(block.children?.flatMap((column: any) =>
              Array.isArray(column) ? column : [column],
            ) ?? []),
          ])
          .find((block) => block.type === "title");
      const title = locate(expected.blocks);
      title.content = "Edited default";
      const { editor, wrapper } = await real({ content: seed, localization });
      expect((wrapper.vm as any).getLocale()).toBe(
        seed.settings.locale ?? "en",
      );
      editor.updateBlock(title.id, { content: title.content });
      expect(JSON.stringify((wrapper.vm as any).getContent())).toBe(
        JSON.stringify(expected),
      );
    },
  );

  it("rejects an invalid enabled language before mounting", async () => {
    const container = document.createElement("div");
    await expect(
      init({ container, localization: { locales: ["de_DE"] } }),
    ).rejects.toThrow();
    expect(container.shadowRoot).toBeNull();
  });

  it("projects block props, wrapper styling, sidebar fields and canvas settings", async () => {
    const { wrapper, editor } = await real();
    editor.setActiveLocale("de");
    editor.selectBlock("t1");
    await nextTick();
    expect(wrapper.findComponent(TitleBlock).props("block")).toMatchObject({
      content: "<p>Hallo</p>",
    });
    expect(wrapper.findComponent(BlockWrapper).props("block")).toHaveProperty(
      "l10n.de",
    );
    expect(
      (
        wrapper.findComponent(BlockWrapper).find(".tpl-block-content")
          .element as HTMLElement
      ).style.paddingTop,
    ).toBe("25px");
    expect(
      wrapper.findComponent(RightSidebar).props("selectedBlock"),
    ).toMatchObject({ content: "<p>Hallo</p>" });
    expect(wrapper.findComponent(RightSidebar).props("settings")).toMatchObject(
      { locale: "de", direction: "rtl" },
    );
    const canvas = wrapper.find(".tpl-canvas");
    expect(canvas.attributes("lang")).toBe("de");
    expect(canvas.attributes("dir")).toBe("rtl");
    expect(
      (wrapper.find(".tpl-canvas-bg").element as HTMLElement).style
        .backgroundColor,
    ).toBe("#123456");
  });

  it.each(["drag", "resize", "cross-section"])(
    "shows one structure notice for %s and keeps base data",
    async (kind) => {
      const seed = content();
      const child = seed.blocks[0];
      seed.blocks = [
        createSectionBlock({ id: "s1", columns: "2", children: [[child], []] }),
        createSectionBlock({ id: "s2", children: [[]] }),
      ];
      const { wrapper, editor } = await real({ content: seed });
      editor.setActiveLocale("de");
      await nextTick();
      if (kind === "drag") {
        const section = wrapper.findAllComponents(SectionBlock)[0];
        const lists = section.findAllComponents({ name: "VueDraggable" });
        lists[1].vm.$emit("update:modelValue", [child]);
        lists[0].vm.$emit("update:modelValue", []);
      } else if (kind === "resize")
        editor.updateBlock("s1", { columns: "1", children: [[child]] });
      else editor.moveBlock("t1", 0, "s2", 0);
      await nextTick();
      expect(wrapper.text()).toContain(
        "Structure changes apply to every language",
      );
      expect(wrapper.findAll('[data-testid="structure-notice"]')).toHaveLength(
        1,
      );
      expect(JSON.stringify(editor.content.value)).toContain("<p>Hello</p>");
      editor.addBlock(createTitleBlock());
      await nextTick();
      expect(wrapper.findAll('[data-testid="structure-notice"]')).toHaveLength(
        1,
      );
    },
  );

  it.each(["toMjml", "toHtml", "compileMjml"] as const)(
    "projects custom text before the render provider %s branch",
    async (method) => {
      const seed = content();
      seed.blocks = [
        {
          id: "c1",
          type: "custom",
          styles: createTitleBlock().styles,
          customType: "greeting",
          fieldValues: { headline: "Hello" },
          l10n: {
            de: {
              text: {
                "fieldValues.headline": {
                  value: "Hallo",
                  source: sourceHash("Hello"),
                },
              },
            },
          },
        } as any,
      ];
      const customBlocks = [
        {
          type: "greeting",
          name: "Greeting",
          fields: [{ key: "headline", type: "text", label: "Headline" }],
          template: "<p>{{ headline }}</p>",
        },
      ] as CustomBlockDefinition[];
      const render =
        method === "compileMjml"
          ? { compileMjml: async (mjml: string) => mjml }
          : {
              [method]: async (payload: any) => JSON.stringify(payload.content),
            };
      const { handle } = await open({ content: seed, customBlocks, render });
      const output = await (method === "toMjml"
        ? handle.toMjml({ locale: "de" })
        : handle.toHtml({ locale: "de" }));
      expect(output).toContain("Hallo");
      expect(output).not.toContain("l10n");
    },
  );
});

describe("localized merge-tag load normalization", () => {
  it("restamps only a current source while keeping genuinely stale translations stale", async () => {
    const seed = content();
    seed.blocks = [
      createTitleBlock({
        id: "t1",
        content: "<p>Hello {{name}}</p>",
        l10n: {
          de: {
            text: {
              content: {
                value: "<p>Hallo {{name}}</p>",
                source: sourceHash("<p>Hello {{name}}</p>"),
              },
            },
          },
          fr: {
            text: {
              content: { value: "<p>Salut {{name}}</p>", source: "old" },
            },
          },
        },
      }),
    ];
    seed.settings.locales = ["de", "fr"];
    const normalized = normalizeContentForConfig(seed, undefined);
    const title = normalized.blocks[0] as any;
    expect(title.l10n.de.text.content.source).toBe(sourceHash(title.content));
    expect(title.l10n.de.text.content.value).toContain("data-merge-tag");
    expect(title.l10n.fr.text.content.source).toBe("old");
    expect(seed.blocks[0]).toMatchObject({ content: "<p>Hello {{name}}</p>" });
    const { handle } = await open({ content: seed });
    const saved = handle.getContent();
    expect(saved).toEqual(normalized);
    const directory = mkdtempSync(resolve(import.meta.dirname, ".locale-cli-"));
    try {
      const file = resolve(directory, "template.json");
      writeFileSync(file, JSON.stringify(saved));
      const result = spawnSync(
        process.execPath,
        [
          resolve(import.meta.dirname, "../../template-tools/dist/bin.js"),
          "validate",
          file,
          "--locale",
          "de",
          "--json",
        ],
        { encoding: "utf8" },
      );
      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(result.stdout).not.toContain("localization.stale");
      expect(result.stdout).not.toContain("localization.merge-tags-differ");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("normalizes rich locale operation expect values as well as text", () => {
    const operation = {
      op: "updateBlockLocale",
      blockId: "t1",
      locale: "de",
      text: { content: { value: "<p>Neu {{name}}</p>", source: "hash" } },
      expect: {
        text: {
          content: { value: "<p>Alt {{name}}</p>", source: "hash" },
          absent: null,
        },
      },
    } as const;
    const [normalized] = normalizeRemoteOperations(
      [operation],
      content(),
      undefined,
    );
    expect((normalized as any).expect.text.content.value).toContain(
      "data-merge-tag",
    );
    expect((normalized as any).text.content.value).toContain("data-merge-tag");
    expect((normalized as any).expect.text.absent).toBeNull();
    const [missing] = normalizeRemoteOperations(
      [{ ...operation, expect: { text: { content: null } } }],
      content(),
      undefined,
    );
    expect((missing as any).expect.text.content).toBeNull();
    expect(operation.expect.text.content.value).toBe("<p>Alt {{name}}</p>");
  });
});

describe("locale lifecycle and collaboration locks", () => {
  it.each([
    "load",
    "setContent",
    "local remove",
    "local remove with peer lock",
    "remote remove",
    "undo",
  ])(
    "returns to default and re-requests the lock after %s",
    async (transition) => {
      const seed = content();
      if (transition === "undo") {
        delete seed.settings.locales;
        delete seed.settings.l10n;
        delete seed.blocks[0].l10n;
      }
      if (transition === "local remove with peer lock")
        seed.blocks.push(createTitleBlock({ id: "peer", content: "Peer" }));
      const server = new FakeCollaborationServer(seed);
      const provider = server.provider("Ada");
      const acquire = vi.spyOn(provider, "acquireLock");
      const release = vi.spyOn(provider, "releaseLock");
      const onLocaleChange = vi.fn();
      const { wrapper, editor } = await real({
        content: seed,
        templates: server.templatesProvider(),
        collaboration: provider,
        user: { id: "ada", name: "Ada" },
        onLocaleChange,
      });
      await (wrapper.vm as any).load(server.templateId);
      await settle();
      if (transition === "undo") {
        editor.addLocale("de");
        await new Promise((resolve) => setTimeout(resolve, 350));
        await settle();
      }
      if (transition === "local remove with peer lock") {
        const peer = await openClient(server, "Grace");
        onTestFinished(() => {
          peer.collaboration.destroy();
          peer.scope.stop();
        });
        peer.editor.selectBlock("peer");
        await settle();
        server.deliverAll();
        await settle();
        expect(editor.isBlockLocked("peer")).toBe(true);
      }
      editor.selectBlock("t1");
      await settle();
      editor.setActiveLocale("de");
      await settle();
      expect(release).toHaveBeenCalledWith(server.templateId, "t1", null);
      expect(acquire).toHaveBeenLastCalledWith(server.templateId, "t1", "de");
      const fallback = safeClone(seed);
      delete fallback.settings.locales;
      delete fallback.settings.l10n;
      delete fallback.blocks[0].l10n;
      if (transition === "load") {
        server.content = fallback;
        await (wrapper.vm as any).load(server.templateId);
      } else if (transition === "setContent") editor.setContent(fallback);
      else if (transition.startsWith("local remove")) editor.removeLocale("de");
      else if (transition === "remote remove") {
        server.pushAs(AGENT, [{ op: "removeLocale", locale: "de" }]);
        server.deliverAll();
      } else {
        const history = (wrapper.findComponent(Canvas).vm as any).$.provides;
        const { HISTORY_KEY } = await import("../src/keys");
        history[HISTORY_KEY as symbol].undo();
      }
      await settle();
      await flushPromises();
      if (transition.startsWith("local remove")) {
        expect(server.submitted.flatMap((batch) => batch.ops)).toEqual([
          { op: "removeLocale", locale: "de" },
        ]);
        expect(server.content).toEqual(fallback);
        expect(server.content.settings).not.toHaveProperty("locales");
        expect(editor.content.value).toEqual(fallback);
      }
      expect(editor.activeLocale.value).toBeNull();
      expect(onLocaleChange).toHaveBeenLastCalledWith("en");
      expect(release).toHaveBeenCalledWith(server.templateId, "t1", "de");
      expect(acquire).toHaveBeenLastCalledWith(server.templateId, "t1", null);
    },
  );
});

it("uses resolved section children in preview without enabling localization", async () => {
  const seed = createDefaultTemplateContent();
  seed.blocks = [
    createSectionBlock({
      id: "preview-section",
      children: [
        [
          createTitleBlock({ id: "keep", content: "Before resolve" }),
          createTitleBlock({ id: "remove", content: "Conditional child" }),
        ],
      ],
    }),
  ];
  const { editor, wrapper, canvas } = await real({
    localization: undefined,
    content: seed,
    resolvePreview: async ({ content }) => {
      const section = content.blocks[0] as any;
      section.children = [
        [{ ...section.children[0][0], content: "Resolved child" }],
      ];
      return content;
    },
  });
  const before = JSON.stringify(editor.content.value);
  editor.setPreviewMode(true);
  await flushPromises();
  await nextTick();
  expect(canvas.text()).toContain("Resolved child");
  expect(canvas.text()).not.toContain("Before resolve");
  expect(canvas.text()).not.toContain("Conditional child");
  expect(JSON.stringify(editor.content.value)).toBe(before);
  editor.setPreviewMode(false);
  await nextTick();
  expect(wrapper.findComponent(SectionBlock).text()).toContain(
    "Conditional child",
  );
});

describe("root drag routing", () => {
  it.each([true, false])(
    "guards root reorder in an enabled=%s language",
    async (enabled) => {
      const seed = content();
      seed.blocks.push(createTitleBlock({ id: "t2", content: "Second" }));
      const { editor, wrapper, canvas } = await real({
        content: seed,
        localization: { locales: enabled ? ["de"] : ["fr"] },
      });
      editor.setActiveLocale("de");
      await nextTick();
      const before = safeClone(editor.content.value);
      const history = (canvas.vm as any).$.provides[HISTORY_KEY as symbol];
      const replace = vi.spyOn(editor, "setContent");
      canvas
        .findComponent(VueDraggable)
        .vm.$emit(
          "update:modelValue",
          [...editor.content.value.blocks].reverse(),
        );
      canvas.findComponent(VueDraggable).vm.$emit("update", {
        oldIndex: 0,
        newIndex: 1,
        data: before.blocks[0],
      });
      await nextTick();
      expect(replace).not.toHaveBeenCalled();
      expect(editor.content.value.blocks.map((b: any) => b.id)).toEqual(
        enabled ? ["t2", "t1"] : ["t1", "t2"],
      );
      expect(wrapper.findAll('[data-testid="structure-notice"]')).toHaveLength(
        enabled ? 1 : 0,
      );
      if (enabled) {
        history.undo();
        expect(editor.content.value).toEqual(before);
        expect(history.canUndo.value).toBe(false);
      } else {
        expect(history.canUndo.value).toBe(false);
        expect(history.canRedo.value).toBe(false);
      }
    },
  );

  it.each(
    [true, false].flatMap((enabled) =>
      [true, false].flatMap((toRoot) =>
        [true, false].map((sourceFirst) => ({ enabled, toRoot, sourceFirst })),
      ),
    ),
  )(
    "guards cross-list drop $toRoot with enabled=$enabled and sourceFirst=$sourceFirst",
    async ({ enabled, toRoot, sourceFirst }) => {
      const seed = content();
      const title = seed.blocks[0];
      seed.blocks = toRoot
        ? [createSectionBlock({ id: "s1", children: [[title]] })]
        : [title, createSectionBlock({ id: "s1", children: [[]] })];
      const { editor, wrapper, canvas } = await real({
        content: seed,
        localization: { locales: enabled ? ["de"] : ["fr"] },
      });
      editor.setActiveLocale("de");
      await nextTick();
      const before = safeClone(editor.content.value);
      const history = (canvas.vm as any).$.provides[HISTORY_KEY as symbol];
      const replace = vi.spyOn(editor, "setContent");
      const root = canvas.findComponent(VueDraggable);
      const column = wrapper
        .findComponent(SectionBlock)
        .findComponent(VueDraggable);
      const section = editor.content.value.blocks.find(
        (b: any) => b.id === "s1",
      );
      const source = () =>
        (toRoot ? column : root).vm.$emit(
          "update:modelValue",
          toRoot ? [] : [section],
        );
      const target = () =>
        (toRoot ? root : column).vm.$emit(
          "update:modelValue",
          toRoot ? [section, title] : [title],
        );
      if (sourceFirst) {
        source();
        target();
      } else {
        target();
        source();
      }
      await nextTick();
      expect(replace).not.toHaveBeenCalled();
      if (enabled) {
        expect(editor.findBlockLocation("t1")).toEqual(
          toRoot
            ? { targetSectionId: undefined, columnIndex: undefined, index: 1 }
            : { targetSectionId: "s1", columnIndex: 0, index: 0 },
        );
        const moved = toRoot
          ? editor.content.value.blocks[1]
          : editor.content.value.blocks[0].children[0][0];
        expect(moved).toEqual(title);
        expect(
          wrapper.findAll('[data-testid="structure-notice"]'),
        ).toHaveLength(1);
        history.undo();
        expect(editor.content.value).toEqual(before);
        expect(history.canUndo.value).toBe(false);
      } else {
        expect(editor.content.value).toEqual(before);
        expect(wrapper.find('[data-testid="structure-notice"]').exists()).toBe(
          false,
        );
        expect(history.canUndo.value).toBe(false);
        expect(history.canRedo.value).toBe(false);
      }
    },
  );

  it.each(["reorder", "to root", "to column"])(
    "refuses %s through a peer lock in another language",
    async (kind) => {
      const seed = content();
      seed.settings.locales = ["de", "fr"];
      const title = seed.blocks[0];
      seed.blocks =
        kind === "reorder"
          ? [title, createTitleBlock({ id: "second" })]
          : kind === "to root"
            ? [createSectionBlock({ id: "s1", children: [[title]] })]
            : [title, createSectionBlock({ id: "s1", children: [[]] })];
      const server = new FakeCollaborationServer(seed);
      const { wrapper, canvas, editor } = await real({
        content: seed,
        templates: server.templatesProvider(),
        collaboration: server.provider("Ada"),
        user: { id: "ada", name: "Ada" },
      });
      await (wrapper.vm as any).load(server.templateId);
      await settle();
      const peer = await openClient(server, "Grace");
      onTestFinished(() => {
        peer.collaboration.destroy();
        peer.scope.stop();
      });
      peer.collaboration.setLockLocale("fr");
      peer.editor.selectBlock("t1");
      await settle();
      server.deliverAll();
      editor.setActiveLocale("de");
      await nextTick();
      expect(editor.isBlockLocked("t1")).toBe(false);
      const before = safeClone(editor.content.value);
      const root = canvas.findComponent(VueDraggable);
      if (kind === "reorder") {
        root.vm.$emit(
          "update:modelValue",
          [...editor.content.value.blocks].reverse(),
        );
        root.vm.$emit("update", { oldIndex: 0, newIndex: 1, data: title });
      } else if (kind === "to root")
        root.vm.$emit("update:modelValue", [
          ...editor.content.value.blocks,
          title,
        ]);
      else
        wrapper
          .findComponent(SectionBlock)
          .findComponent(VueDraggable)
          .vm.$emit("update:modelValue", [title]);
      await nextTick();
      await settle();
      expect(editor.content.value).toEqual(before);
      expect(wrapper.find('[data-testid="structure-notice"]').exists()).toBe(
        false,
      );
      expect(server.submitted).toHaveLength(0);
    },
  );
});

describe("Sortable adjacent reorder identity", () => {
  it.each(["root", "column"])(
    "uses the dragged identity for both directions at the %s",
    async (location) => {
      for (const oldIndex of [0, 1])
        for (const locked of ["none", "dragged", "other"]) {
          const seed = content();
          seed.settings.locales = ["de", "fr"];
          const pair = [
            createTitleBlock({ id: "a", content: "A" }),
            createTitleBlock({ id: "b", content: "B" }),
          ];
          seed.blocks =
            location === "root"
              ? pair
              : [createSectionBlock({ id: "s1", children: [pair] })];
          const server = new FakeCollaborationServer(seed);
          const { wrapper, canvas, editor } = await real({
            content: seed,
            templates: server.templatesProvider(),
            collaboration: server.provider("Ada"),
            user: { id: "ada", name: "Ada" },
          });
          await (wrapper.vm as any).load(server.templateId);
          await settle();
          if (locked !== "none") {
            const peer = await openClient(server, "Grace");
            onTestFinished(() => {
              peer.collaboration.destroy();
              peer.scope.stop();
            });
            peer.collaboration.setLockLocale("fr");
            peer.editor.selectBlock(
              pair[locked === "dragged" ? oldIndex : 1 - oldIndex].id,
            );
            await settle();
            server.deliverAll();
          }
          editor.setActiveLocale("de");
          await nextTick();
          const list =
            location === "root"
              ? canvas.findComponent(VueDraggable)
              : wrapper.findComponent(SectionBlock).findComponent(VueDraggable);
          const move = vi.spyOn(editor, "moveBlock");
          list.vm.$emit("update:modelValue", [...pair].reverse());
          list.vm.$emit("update", {
            oldIndex,
            newIndex: 1 - oldIndex,
            oldDraggableIndex: oldIndex,
            newDraggableIndex: 1 - oldIndex,
            data: pair[oldIndex],
          });
          await nextTick();
          await settle();
          const blocks =
            location === "root"
              ? editor.content.value.blocks
              : editor.content.value.blocks[0].children[0];
          expect
            .soft(
              server.submitted
                .flatMap((batch) => batch.ops)
                .filter((op) => op.op === "moveBlock")
                .map((op) => op.blockId),
              `${location}, outgoing move with lock ${locked}`,
            )
            .toEqual(locked === "dragged" ? [] : [pair[oldIndex].id]);
          expect
            .soft(
              blocks.map((block: any) => block.id),
              `${location}, dragged ${pair[oldIndex].id}, lock ${locked}`,
            )
            .toEqual(locked === "dragged" ? ["a", "b"] : ["b", "a"]);
          if (locked !== "dragged")
            expect
              .soft(
                move.mock.calls.map(([id, index]) => [id, index]),
                `${location}, dragged identity with lock ${locked}`,
              )
              .toEqual([[pair[oldIndex].id, 1 - oldIndex]]);
          wrapper.unmount();
          wrappers.splice(wrappers.indexOf(wrapper), 1);
        }
    },
  );
});
