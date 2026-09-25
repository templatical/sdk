// @vitest-environment happy-dom
import "./dom-stubs";
import { describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { createCustomBlock } from "@templatical/types";
import type { CustomBlockDefinition } from "@templatical/types";
import CustomBlockToolbar from "../src/components/toolbar/CustomBlockToolbar.vue";
import { mountEditor } from "./helpers/mount";
import { CUSTOM_BLOCK_DEFINITIONS_KEY, TRANSLATIONS_KEY } from "../src/keys";
import en from "../src/i18n/locales/en";

function definition(
  overrides: Partial<CustomBlockDefinition> = {},
): CustomBlockDefinition {
  return {
    type: "hero",
    name: "Hero",
    description: "A hero card",
    template: "<div>{{ title }}</div>",
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "locked", label: "Locked", type: "text", readOnly: true },
    ],
    ...overrides,
  };
}

function mountToolbar(
  def: CustomBlockDefinition | undefined,
  opts: { dataSourceFetched?: boolean; onFetch?: () => Promise<unknown> } = {},
) {
  const resolved = def ?? definition();
  if (opts.onFetch) {
    resolved.dataSource = { onFetch: opts.onFetch };
  }
  const block = createCustomBlock(resolved);
  block.fieldValues.title = "Hello";
  block.fieldValues.locked = "from-api";
  if (opts.dataSourceFetched !== undefined) {
    block.dataSourceFetched = opts.dataSourceFetched;
  }

  const wrapper = mountEditor(CustomBlockToolbar, {
    props: { block },
    provides: {
      [TRANSLATIONS_KEY]: en,
      [CUSTOM_BLOCK_DEFINITIONS_KEY]: def ? [resolved] : [],
    },
  });
  return { wrapper, block };
}

describe("CustomBlockToolbar", () => {
  it("shows the no-definition copy when the type is not registered", () => {
    const { wrapper } = mountToolbar(undefined);
    expect(wrapper.text()).toContain(en.customBlocks.toolbar.noDefinition);
  });

  it("renders the description and writes through field updates", async () => {
    const { wrapper } = mountToolbar(definition());
    expect(wrapper.text()).toContain("A hero card");

    const input = wrapper.find("input:not([disabled])");
    await input.setValue("World");
    expect(wrapper.emitted("updateFieldValues")?.[0]?.[0]).toMatchObject({
      title: "World",
      locked: "from-api",
    });
  });

  it("fetches the data source and reports errors", async () => {
    const onFetch = vi.fn(async () => ({ title: "API title" }));
    const { wrapper } = mountToolbar(
      definition({
        dataSource: { label: en.customBlocks.dataSource.fetchButton, onFetch },
      }),
      { dataSourceFetched: false },
    );

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes(en.customBlocks.dataSource.fetchButton))!
      .trigger("click");
    await nextTick();
    await nextTick();

    expect(onFetch).toHaveBeenCalled();
    expect(wrapper.emitted("updateFieldValues")?.[0]?.[0]).toMatchObject({
      title: "API title",
    });
    expect(wrapper.emitted("updateDataSourceFetched")?.[0]?.[0]).toBe(true);
  });

  it("locks read-only fields after a successful fetch", async () => {
    const { wrapper } = mountToolbar(
      definition({
        dataSource: {
          label: en.customBlocks.dataSource.fetchButton,
          onFetch: async () => ({}),
        },
      }),
      { dataSourceFetched: true },
    );
    const locked = wrapper.find("input[disabled]");
    expect(locked.exists()).toBe(true);
    expect(locked.attributes("title")).toBe(
      en.customBlocks.dataSource.readOnlyTooltip,
    );
  });

  it("surfaces a fetch error from the data source", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { wrapper } = mountToolbar(
      definition({
        dataSource: {
          label: en.customBlocks.dataSource.fetchButton,
          onFetch: async () => {
            throw new Error("offline");
          },
        },
      }),
      { dataSourceFetched: false },
    );
    await wrapper
      .findAll("button")
      .find((b) => b.text().includes(en.customBlocks.dataSource.fetchButton))!
      .trigger("click");
    await nextTick();
    await nextTick();
    expect(wrapper.text()).toContain(en.customBlocks.dataSource.fetchError);
    warn.mockRestore();
  });
});
