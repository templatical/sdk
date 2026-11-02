// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import {
  createDefaultTemplateContent,
  createImageBlock,
  createParagraphBlock,
  createSlotBlock,
  createWrapperBlock,
  resolveLocale,
  sourceHash,
} from "@templatical/types";
import {
  useEditorCore,
  type BaseEditorReturn,
} from "../src/composables/useEditorCore";
import TestEmailModal from "../src/components/TestEmailModal.vue";
import { EDITOR_KEY, LAYOUT_KEY } from "../src/keys";
import { buildRenderPayload } from "../src/utils/renderProvider";
import { imageRoom, sectionBandWidth } from "../src/utils/imageRoom";
import { mountEditor } from "./helpers/mount";
import en from "../src/i18n/locales/en";

vi.mock("@templatical/core", () => ({
  useHistory: () => ({ isNavigating: ref(false), destroy: vi.fn() }),
  useHistoryInterceptor: vi.fn(),
  useBlockActions: () => ({}),
  useConditionPreview: () => ({ reset: vi.fn() }),
}));

function fixtures() {
  const content = createDefaultTemplateContent(undefined, { locale: "en" });
  content.settings.locales = ["de", "fr"];
  content.blocks = [createImageBlock({ id: "image" })];
  const layout = createDefaultTemplateContent(undefined, { locale: "en" });
  layout.settings.locales = ["de"];
  layout.blocks = [
    createWrapperBlock({
      styles: { padding: { top: 0, bottom: 0, left: 0, right: 0 } },
      l10n: { de: { set: { "styles.padding.left": 50 } } },
      children: [
        createSlotBlock(),
        createParagraphBlock({
          content: "Unsubscribe",
          l10n: {
            de: {
              text: {
                content: {
                  value: "Abmelden",
                  sourceHash: sourceHash("Unsubscribe"),
                },
              },
            },
          },
        }),
      ],
    }),
  ];
  return { content, layout };
}

describe.each([
  ["de", "Abmelden", 530],
  ["fr", "Unsubscribe", 580],
] as const)("layout in the %s view", (locale, footer, room) => {
  it("projects useEditorCore's preview getContent", () => {
    const { content, layout } = fixtures();
    const editor = {
      content: ref(content),
      activeLocale: ref(locale),
      state: {
        content,
        previewMode: true,
        viewport: "desktop",
        uiTheme: "light",
        template: null,
      },
      selectedBlock: ref(null),
      isBlockLocked: () => false,
      setUiTheme: vi.fn(),
      selectBlock: vi.fn(),
      updateBlock: vi.fn(),
      updateSettings: vi.fn(),
      setContent: vi.fn(),
      markDirty: vi.fn(),
    } as unknown as BaseEditorReturn;
    let core: ReturnType<typeof useEditorCore>;
    const wrapper = mount(
      defineComponent({
        setup() {
          core = useEditorCore({
            editor,
            config: { layout },
            translations: en,
            fontsManager: {
              fonts: ref([]),
              loadCustomFonts: vi.fn(),
              cleanupFontLinks: vi.fn(),
            } as any,
          });
          return () => h("div");
        },
      }),
    );
    try {
      expect(JSON.stringify(core!.previewResolution.content.value)).toContain(
        footer,
      );
      expect(
        JSON.stringify(core!.previewResolution.content.value),
      ).not.toContain("l10n");
    } finally {
      core!.destroy();
      wrapper.unmount();
    }
  });

  it("projects the render provider's layout for the requested locale", async () => {
    const { content, layout } = fixtures();
    const payload = await buildRenderPayload(
      {
        getContent: () => content,
        getLayout: () => layout,
        getFonts: () => ({ customFonts: [], defaultFallback: "Arial" }),
        renderCustomBlock: async () => "",
        getCustomBlockStylesheet: () => undefined,
      },
      { locale },
    );
    expect(JSON.stringify(payload.content)).toContain(footer);
    expect(JSON.stringify(payload.content)).not.toContain("l10n");
  });

  it("projects the test-email preview content", () => {
    const { content, layout } = fixtures();
    const wrapper = mountEditor(TestEmailModal, {
      props: { visible: true, isSending: false, justSent: false, error: null },
      provides: {
        [EDITOR_KEY]: { content: ref(content), activeLocale: ref(locale) },
        [LAYOUT_KEY]: layout,
      },
      global: {
        stubs: {
          TplModal: { template: "<div><slot /></div>" },
          BlockPreviewCanvas: {
            props: ["blocks"],
            template: "<pre>{{ JSON.stringify(blocks) }}</pre>",
          },
        },
      },
    });
    try {
      expect(wrapper.find("pre").text()).toContain(footer);
      expect(wrapper.find("pre").text()).not.toContain("l10n");
    } finally {
      wrapper.unmount();
    }
  });

  it("measures documentOf with the active layout projection", () => {
    const { content, layout } = fixtures();
    expect(imageRoom(resolveLocale(content, locale), "image", layout)).toBe(
      room,
    );
  });

  it("uses an explicit active language when measuring the shared tree", () => {
    const { content, layout } = fixtures();
    expect(imageRoom(content, "image", layout, locale)).toBe(room);
    expect(sectionBandWidth(content, "image", layout, locale)).toBe(room + 20);
  });
});
