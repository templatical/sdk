// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { computed, nextTick, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { createCustomBlock } from "@templatical/types";
import type { CustomBlockDefinition } from "@templatical/types";
import CustomBlock from "../src/components/blocks/CustomBlock.vue";
import { mountEditor } from "./helpers/mount";
import {
  BLOCK_REGISTRY_KEY,
  MERGE_TAGS_KEY,
  TRANSLATIONS_KEY,
  USE_MERGE_TAG_SAMPLES_KEY,
} from "../src/keys";
import en from "../src/i18n/locales/en";

function definition(
  overrides: Partial<CustomBlockDefinition> = {},
): CustomBlockDefinition {
  return {
    type: "hero",
    name: "Hero",
    template: "<div>{{ title }}</div>",
    fields: [{ key: "title", label: "Title", type: "text" }],
    ...overrides,
  };
}

function mountCustom(
  def: CustomBlockDefinition | undefined,
  opts: {
    fieldValues?: Record<string, unknown>;
    dataSourceFetched?: boolean;
    render?: (block: {
      fieldValues: Record<string, unknown>;
    }) => Promise<string>;
    useSamples?: boolean;
    mergeTags?: Array<{ value: string; sample?: string; label?: string }>;
  } = {},
) {
  const block = createCustomBlock(def ?? definition());
  if (opts.fieldValues) {
    block.fieldValues = { ...block.fieldValues, ...opts.fieldValues };
  }
  if (opts.dataSourceFetched !== undefined) {
    block.dataSourceFetched = opts.dataSourceFetched;
  }

  const renderCustomBlock = vi.fn(
    opts.render ??
      (async (b: { fieldValues: Record<string, unknown> }) =>
        `<p>${String(b.fieldValues.title ?? "")}</p>`),
  );

  const wrapper = mountEditor(CustomBlock, {
    props: { block, viewport: "desktop" },
    provides: {
      [TRANSLATIONS_KEY]: en,
      [BLOCK_REGISTRY_KEY]: {
        getDefinition: (type: string) =>
          def && type === def.type ? def : undefined,
        renderCustomBlock,
      },
      [USE_MERGE_TAG_SAMPLES_KEY]: computed(() => opts.useSamples === true),
      [MERGE_TAGS_KEY]: ref(
        opts.mergeTags ?? [
          { value: "first_name", sample: "Ada", label: "First" },
        ],
      ),
    },
  });

  return { wrapper, block, renderCustomBlock };
}

describe("CustomBlock canvas", () => {
  it("shows the missing-definition state when the type is unknown", () => {
    const { wrapper } = mountCustom(undefined);
    expect(wrapper.text()).toContain(en.customBlocks.definitionNotFound);
  });

  it("renders the registry HTML", async () => {
    const { wrapper } = mountCustom(definition(), {
      fieldValues: { title: "Hello" },
    });
    await flushPromises();
    expect(wrapper.html()).toContain("<p>Hello</p>");
  });

  it("shows the render-error state when the renderer throws", async () => {
    const { wrapper } = mountCustom(definition(), {
      render: async () => {
        throw new Error("boom");
      },
    });
    await flushPromises();
    expect(wrapper.text()).toContain(en.customBlocks.renderError);
  });

  it("treats a liquid error string as a failed render", async () => {
    const { wrapper } = mountCustom(definition(), {
      render: async () => "Template render error: unknown filter",
    });
    await flushPromises();
    expect(wrapper.text()).toContain(en.customBlocks.renderError);
  });

  it("overlays a data-source fetch until the block is fetched", async () => {
    const onFetch = vi.fn(async () => ({ title: "from-api" }));
    const def = definition({
      dataSource: { label: en.customBlocks.dataSource.fetchButton, onFetch },
    });
    const { wrapper } = mountCustom(def, { dataSourceFetched: false });
    await nextTick();

    const cta = wrapper
      .findAll("button")
      .find((b) => b.text().includes(en.customBlocks.dataSource.fetchButton));
    expect(cta).toBeTruthy();
    await cta!.trigger("click");
    await nextTick();
    expect(onFetch).toHaveBeenCalled();
  });

  it("substitutes sample values into string fields for the renderer", async () => {
    const { renderCustomBlock } = mountCustom(definition(), {
      fieldValues: { title: "{{first_name}}" },
      useSamples: true,
      mergeTags: [{ value: "{{first_name}}", sample: "Ada", label: "First" }],
    });
    await flushPromises();

    expect(renderCustomBlock).toHaveBeenCalled();
    const handed = renderCustomBlock.mock.calls[0][0];
    expect(handed.fieldValues.title).toBe("Ada");
  });
});
