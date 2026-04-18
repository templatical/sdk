import { describe, expect, it, vi } from "vitest";
import { computed, ref } from "@vue/reactivity";
import type { CustomBlock, CustomBlockDefinition } from "@templatical/types";
import { useDataSourceFetch } from "../src/data-source-fetch";

function createBlock(overrides: Partial<CustomBlock> = {}): CustomBlock {
  return {
    id: "block-1",
    type: "custom",
    customType: "test",
    fieldValues: { name: "John", email: "john@test.com" },
    dataSourceFetched: false,
    styles: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    ...overrides,
  } as CustomBlock;
}

function createDefinition(
  onFetch?: (ctx: { fieldValues: Record<string, unknown>; blockId: string }) => Promise<Record<string, unknown> | null>,
): CustomBlockDefinition {
  return {
    type: "test",
    label: "Test",
    icon: "box",
    fields: [],
    ...(onFetch ? { dataSource: { onFetch } } : {}),
  } as CustomBlockDefinition;
}

function setup(opts: {
  block?: CustomBlock;
  definition?: CustomBlockDefinition;
} = {}) {
  const block = computed(() => opts.block ?? createBlock());
  const definition = computed(() => opts.definition as CustomBlockDefinition | undefined);
  const onUpdate = vi.fn();
  const result = useDataSourceFetch({ definition, block, onUpdate });
  return { ...result, onUpdate, block, definition };
}

describe("useDataSourceFetch", () => {
  it("hasDataSource is true when definition has dataSource", () => {
    const { hasDataSource } = setup({
      definition: createDefinition(vi.fn()),
    });
    expect(hasDataSource.value).toBe(true);
  });

  it("hasDataSource is false when definition has no dataSource", () => {
    const { hasDataSource } = setup({
      definition: createDefinition(),
    });
    expect(hasDataSource.value).toBe(false);
  });

  it("needsFetch is true when has source and not fetched", () => {
    const { needsFetch } = setup({
      definition: createDefinition(vi.fn()),
      block: createBlock({ dataSourceFetched: false }),
    });
    expect(needsFetch.value).toBe(true);
  });

  it("needsFetch is false after dataSourceFetched", () => {
    const { needsFetch } = setup({
      definition: createDefinition(vi.fn()),
      block: createBlock({ dataSourceFetched: true }),
    });
    expect(needsFetch.value).toBe(false);
  });

  describe("fetch", () => {
    it("returns early when no dataSource", async () => {
      const { fetch, onUpdate } = setup({
        definition: createDefinition(),
      });
      await fetch();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("calls onFetch with fieldValues and blockId", async () => {
      const onFetch = vi.fn().mockResolvedValue(null);
      const block = createBlock({
        id: "b-42",
        fieldValues: { name: "Alice" },
      });
      const { fetch } = setup({
        definition: createDefinition(onFetch),
        block,
      });

      await fetch();
      expect(onFetch).toHaveBeenCalledWith({
        fieldValues: { name: "Alice" },
        blockId: "b-42",
      });
    });

    it("merges result into existing fieldValues", async () => {
      const onFetch = vi.fn().mockResolvedValue({ name: "Jane" });
      const block = createBlock({
        fieldValues: { name: "John", email: "john@test.com" },
      });
      const { fetch, onUpdate } = setup({
        definition: createDefinition(onFetch),
        block,
      });

      await fetch();
      expect(onUpdate).toHaveBeenCalledWith(
        { name: "Jane", email: "john@test.com" },
        true,
      );
    });

    it("ignores result keys not present in fieldValues", async () => {
      const onFetch = vi.fn().mockResolvedValue({
        name: "Jane",
        extraField: "should be ignored",
      });
      const block = createBlock({
        fieldValues: { name: "John" },
      });
      const { fetch, onUpdate } = setup({
        definition: createDefinition(onFetch),
        block,
      });

      await fetch();
      expect(onUpdate).toHaveBeenCalledWith({ name: "Jane" }, true);
    });

    it("does not call onUpdate when result is null", async () => {
      const onFetch = vi.fn().mockResolvedValue(null);
      const { fetch, onUpdate } = setup({
        definition: createDefinition(onFetch),
      });

      await fetch();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("does not call onUpdate when result is undefined", async () => {
      const onFetch = vi.fn().mockResolvedValue(undefined);
      const { fetch, onUpdate } = setup({
        definition: createDefinition(onFetch),
      });

      await fetch();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("sets fetchError to true when onFetch throws", async () => {
      const onFetch = vi.fn().mockRejectedValue(new Error("Network fail"));
      const { fetch, fetchError, onUpdate } = setup({
        definition: createDefinition(onFetch),
      });

      await fetch();
      expect(fetchError.value).toBe(true);
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("sets isFetching during fetch and clears after", async () => {
      let resolvePromise: (v: null) => void;
      const onFetch = vi.fn().mockReturnValue(
        new Promise<null>((resolve) => {
          resolvePromise = resolve;
        }),
      );
      const { fetch, isFetching } = setup({
        definition: createDefinition(onFetch),
      });

      const fetchPromise = fetch();
      expect(isFetching.value).toBe(true);
      resolvePromise!(null);
      await fetchPromise;
      expect(isFetching.value).toBe(false);
    });

    it("clears fetchError on successful retry after failure", async () => {
      const onFetch = vi.fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValueOnce({ name: "Retry" });
      const block = createBlock({ fieldValues: { name: "John" } });
      const { fetch, fetchError, onUpdate } = setup({
        definition: createDefinition(onFetch),
        block,
      });

      await fetch();
      expect(fetchError.value).toBe(true);

      await fetch();
      expect(fetchError.value).toBe(false);
      expect(onUpdate).toHaveBeenCalledWith({ name: "Retry" }, true);
    });

    it("handles empty fieldValues object", async () => {
      const onFetch = vi.fn().mockResolvedValue({ name: "Jane" });
      const block = createBlock({ fieldValues: {} });
      const { fetch, onUpdate } = setup({
        definition: createDefinition(onFetch),
        block,
      });

      await fetch();
      expect(onUpdate).toHaveBeenCalledWith({}, true);
    });

    it("isFetching is false after error", async () => {
      const onFetch = vi.fn().mockRejectedValue(new Error("boom"));
      const { fetch, isFetching } = setup({
        definition: createDefinition(onFetch),
      });

      await fetch();
      expect(isFetching.value).toBe(false);
    });

    it("passes a copy of fieldValues to onFetch, not original", async () => {
      let capturedValues: Record<string, unknown> | null = null;
      const onFetch = vi.fn().mockImplementation(async (ctx) => {
        capturedValues = ctx.fieldValues;
        return null;
      });
      const block = createBlock({ fieldValues: { name: "John" } });
      const { fetch } = setup({
        definition: createDefinition(onFetch),
        block,
      });

      await fetch();
      expect(capturedValues).not.toBe(block.fieldValues);
      expect(capturedValues).toEqual({ name: "John" });
    });
  });
});
