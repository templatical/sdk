import "./dom-stubs";
import { describe, expect, it } from "vitest";
import { createApp, defineComponent, h, type InjectionKey } from "vue";
import { requireInject, EDITOR_KEY } from "../src/keys";

function withProvide<T>(
  setup: () => T,
  provides: Record<string | symbol, unknown> = {},
): T {
  let result: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => h("div");
      },
    }),
  );
  for (const sym of Object.getOwnPropertySymbols(provides)) {
    app.provide(sym as InjectionKey<unknown>, provides[sym]);
  }
  app.mount(document.createElement("div"));
  app.unmount();
  return result!;
}

describe("requireInject", () => {
  it("returns value when provider exists", () => {
    const provided = { state: { content: { foo: 1 } } };
    const result = withProvide(
      () => requireInject(EDITOR_KEY, "TestComponent"),
      { [EDITOR_KEY]: provided },
    );
    expect(result).toBe(provided);
    expect(result.state.content).toEqual({ foo: 1 });
  });

  // Assert the FULL message, never just the prefix. A prefix assertion leaves
  // the guidance sentence unguarded, and guidance that names a component or
  // file goes stale silently — which sends whoever hits this error looking for
  // something that is no longer in the codebase.
  it("throws with component name when provider missing", () => {
    expect(() => {
      withProvide(() => requireInject(EDITOR_KEY, "TestComponent"), {});
    }).toThrow(
      "TestComponent requires a provider for editor. Ensure it renders inside the editor, below Editor.vue.",
    );
  });

  it("includes key description in error message", () => {
    const testKey: InjectionKey<string> = Symbol("testKey");
    expect(() => {
      withProvide(() => requireInject(testKey, "MyComponent"), {});
    }).toThrow(
      "MyComponent requires a provider for testKey. Ensure it renders inside the editor, below Editor.vue.",
    );
  });

  it("handles key without description", () => {
    const testKey: InjectionKey<string> = Symbol();
    expect(() => {
      withProvide(() => requireInject(testKey, "MyComponent"), {});
    }).toThrow(
      "MyComponent requires a provider for unknown key. Ensure it renders inside the editor, below Editor.vue.",
    );
  });
});
