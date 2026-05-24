// DOM stubs must be imported BEFORE Vue (Vue captures `document` at module load time)
import "./dom-stubs";

import { describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";
import type { MergeTag } from "@templatical/types";
import {
  useMergeTagPicker,
  type UseMergeTagPickerReturn,
} from "../src/composables/useMergeTagPicker";

/**
 * Mounts a tiny Vue app, runs `useMergeTagPicker()` inside `setup()`,
 * and returns both the composable result and the app handle so the
 * test can `app.unmount()` to trigger `onScopeDispose`.
 */
function mountPicker(): {
  picker: UseMergeTagPickerReturn;
  unmount: () => void;
} {
  let picker: UseMergeTagPickerReturn | null = null;
  const app = createApp(
    defineComponent({
      setup() {
        picker = useMergeTagPicker();
        return () => h("div");
      },
    }),
  );
  app.mount(document.createElement("div"));
  return {
    picker: picker!,
    unmount: () => app.unmount(),
  };
}

const tagA: MergeTag = { label: "First Name", value: "{{first_name}}" };
const tagB: MergeTag = { label: "Last Name", value: "{{last_name}}" };
const tagC: MergeTag = { label: "Email", value: "{{email}}" };

describe("useMergeTagPicker", () => {
  it("initial state: isOpen=false, tags=[]", () => {
    const { picker, unmount } = mountPicker();
    expect(picker.isOpen.value).toBe(false);
    expect(picker.tags.value).toEqual([]);
    unmount();
  });

  it("open(tags) flips isOpen=true and sets tags to the argument", () => {
    const { picker, unmount } = mountPicker();
    picker.open([tagA, tagB]);
    expect(picker.isOpen.value).toBe(true);
    expect(picker.tags.value).toEqual([tagA, tagB]);
    unmount();
  });

  it("open(tags) returns a Promise<MergeTag | null>", () => {
    const { picker, unmount } = mountPicker();
    const result = picker.open([tagA]);
    expect(result).toBeInstanceOf(Promise);
    picker.resolve(null);
    unmount();
  });

  it("resolve(tag) resolves the pending promise with the tag", async () => {
    const { picker, unmount } = mountPicker();
    const promise = picker.open([tagA, tagB]);
    picker.resolve(tagA);
    const result = await promise;
    expect(result).toBe(tagA);
    unmount();
  });

  it("resolve(null) resolves the pending promise with null", async () => {
    const { picker, unmount } = mountPicker();
    const promise = picker.open([tagA]);
    picker.resolve(null);
    const result = await promise;
    expect(result).toBeNull();
    unmount();
  });

  it("after resolve, isOpen flips back to false and tags clears", async () => {
    const { picker, unmount } = mountPicker();
    const promise = picker.open([tagA, tagB]);
    picker.resolve(tagA);
    await promise;
    expect(picker.isOpen.value).toBe(false);
    expect(picker.tags.value).toEqual([]);
    unmount();
  });

  it("resolve() when no promise is pending is a safe no-op", () => {
    const { picker, unmount } = mountPicker();
    expect(() => picker.resolve(tagA)).not.toThrow();
    expect(() => picker.resolve(null)).not.toThrow();
    expect(picker.isOpen.value).toBe(false);
    expect(picker.tags.value).toEqual([]);
    unmount();
  });

  it("concurrent open(): the second call replaces, the first promise resolves null", async () => {
    const { picker, unmount } = mountPicker();
    const firstPromise = picker.open([tagA]);
    const secondPromise = picker.open([tagB, tagC]);
    const firstResult = await firstPromise;
    expect(firstResult).toBeNull();
    expect(picker.isOpen.value).toBe(true);
    expect(picker.tags.value).toEqual([tagB, tagC]);
    picker.resolve(tagB);
    expect(await secondPromise).toBe(tagB);
    unmount();
  });

  it("resolving after a replacement resolves only the second promise", async () => {
    const { picker, unmount } = mountPicker();
    const firstPromise = picker.open([tagA]);
    const secondPromise = picker.open([tagB]);
    expect(await firstPromise).toBeNull();
    picker.resolve(tagB);
    expect(await secondPromise).toBe(tagB);
    unmount();
  });

  it("dispose / unmount while modal is open resolves pending promise with null (no leak)", async () => {
    const { picker, unmount } = mountPicker();
    const promise = picker.open([tagA, tagB]);
    unmount();
    const result = await promise;
    expect(result).toBeNull();
    expect(picker.isOpen.value).toBe(false);
    expect(picker.tags.value).toEqual([]);
  });
});
