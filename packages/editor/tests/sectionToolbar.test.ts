// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import {
  createParagraphBlock,
  createSectionBlock,
} from "@templatical/types";
import SectionToolbar from "../src/components/toolbar/SectionToolbar.vue";
import { TRANSLATIONS_KEY } from "../src/keys";

const translationsStub = {
  section: {
    columns: "Columns",
    column1: "1",
    column2: "2",
    column3: "3",
    ratio12: "1/2",
    ratio21: "2/1",
  },
} as never;

function mountToolbar(block: ReturnType<typeof createSectionBlock>) {
  return mount(SectionToolbar, {
    props: { block },
    global: {
      provide: {
        [TRANSLATIONS_KEY as symbol]: translationsStub,
      },
    },
  });
}

describe("SectionToolbar columns change", () => {
  it("emits both columns and rebalanced children when growing 1 → 2", async () => {
    const section = createSectionBlock();
    section.columns = "1";
    const a = createParagraphBlock();
    section.children = [[a]];

    const wrapper = mountToolbar(section);
    await wrapper.find("select").setValue("2");

    const emits = wrapper.emitted("update");
    expect(emits).toHaveLength(1);
    const payload = emits![0][0] as { columns: string; children: unknown[][] };
    expect(payload.columns).toBe("2");
    expect(payload.children).toHaveLength(2);
    expect(payload.children[0]).toEqual([a]);
    expect(payload.children[1]).toEqual([]);
  });

  it("merges trailing column blocks into the last kept column when shrinking 2 → 1", async () => {
    const section = createSectionBlock();
    section.columns = "2";
    const a = createParagraphBlock();
    const b = createParagraphBlock();
    section.children = [[a], [b]];

    const wrapper = mountToolbar(section);
    await wrapper.find("select").setValue("1");

    const payload = wrapper.emitted("update")![0][0] as {
      columns: string;
      children: unknown[][];
    };
    expect(payload.columns).toBe("1");
    expect(payload.children).toHaveLength(1);
    expect(payload.children[0]).toEqual([a, b]);
  });

  it("emits 2 columns for both '1-2' and '2-1' layouts", async () => {
    const section = createSectionBlock();
    section.columns = "1";
    section.children = [[]];

    const wrapper = mountToolbar(section);
    await wrapper.find("select").setValue("1-2");
    const first = wrapper.emitted("update")![0][0] as {
      columns: string;
      children: unknown[][];
    };
    expect(first.columns).toBe("1-2");
    expect(first.children).toHaveLength(2);

    await wrapper.find("select").setValue("2-1");
    const second = wrapper.emitted("update")![1][0] as {
      columns: string;
      children: unknown[][];
    };
    expect(second.columns).toBe("2-1");
    expect(second.children).toHaveLength(2);
  });

  it("renders the current columns value as selected option", () => {
    const section = createSectionBlock();
    section.columns = "3";
    section.children = [[], [], []];

    const wrapper = mountToolbar(section);
    expect((wrapper.find("select").element as HTMLSelectElement).value).toBe(
      "3",
    );
  });
});
