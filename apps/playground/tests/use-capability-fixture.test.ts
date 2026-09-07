import { describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import type { TemplaticalEditor } from "@templatical/editor";
import {
  resolveFixture,
  useCapabilityFixture,
} from "../src/shell/useCapabilityFixture";
import { templates } from "../src/templates";
import { slugFor } from "../src/providers/template-name";

/**
 * The shell's fixture resolution and its template-adoption memo.
 *
 * Both were unreachable from a test while they lived inside
 * `CapabilityShell.vue`: this app has no `@vue/test-utils` and cannot mount a
 * component, so the memo's behaviour was only ever exercised through e2e.
 */

/** A stand-in editor recording what `adoptTemplate` asked of it. */
function stubEditor(options: { createFails?: boolean } = {}) {
  const calls: string[] = [];
  let nextId = 1;
  const instance = {
    create: vi.fn(async ({ name }: { name?: string }) => {
      if (options.createFails) {
        // What `core/editor.ts`'s `refuse()` does under `templates.create: false`.
        throw new Error("create() is disabled by the provider");
      }
      calls.push(`create:${name}`);
      const id = `tpl-${nextId}`;
      nextId += 1;
      return { id, name };
    }),
    load: vi.fn(async (id: string) => {
      calls.push(`load:${id}`);
      return { id };
    }),
  };
  return { instance: instance as unknown as TemplaticalEditor, calls };
}

function setup(fixtureSlug = "product-launch") {
  const activeId = ref("saved-blocks");
  const capabilityFixture = ref(fixtureSlug);
  const initEditor = vi.fn(async () => {});
  const api = useCapabilityFixture(
    activeId,
    computed(() => capabilityFixture.value),
    initEditor,
  );
  return { activeId, capabilityFixture, initEditor, ...api };
}

describe("resolveFixture", () => {
  it("resolves a registered slug to its template", () => {
    expect(resolveFixture("product-launch").name).toBe("Product Launch");
  });

  it("falls back to the first template for a slug nothing carries", () => {
    expect(resolveFixture("no-such-fixture")).toBe(templates[0]);
  });
});

describe("useCapabilityFixture", () => {
  it("shows the capability's own fixture until the picker overrides it", () => {
    const { fixtureSlug, setFixture } = setup();
    expect(fixtureSlug.value).toBe("product-launch");

    const other = templates.find((t) => slugFor(t.name) !== "product-launch")!;
    setFixture(slugFor(other.name));
    expect(fixtureSlug.value).toBe(slugFor(other.name));
  });

  it("re-inits when the picker changes the fixture", () => {
    const { initEditor, setFixture } = setup();
    setFixture("newsletter");
    expect(initEditor).toHaveBeenCalledTimes(1);
  });

  it("drops the override when the capability changes, so each opens on its own", async () => {
    const { activeId, fixtureSlug, setFixture } = setup();
    const other = templates.find((t) => slugFor(t.name) !== "product-launch")!;
    setFixture(slugFor(other.name));
    expect(fixtureSlug.value).toBe(slugFor(other.name));

    activeId.value = "comments";
    await Promise.resolve();
    expect(fixtureSlug.value).toBe("product-launch");
  });
});

describe("useCapabilityFixture template adoption", () => {
  it("creates a template the first time a fixture is attached", async () => {
    const { adoptTemplate } = setup();
    const { instance, calls } = stubEditor();

    await adoptTemplate(instance);
    expect(calls).toEqual(["create:Product Launch"]);
  });

  it("loads rather than creating a second template on a re-init", async () => {
    const { adoptTemplate } = setup();
    const { instance, calls } = stubEditor();

    // Every control toggle re-inits, so this is the common path — creating
    // each time would spawn one template per click.
    await adoptTemplate(instance);
    await adoptTemplate(instance);
    await adoptTemplate(instance);
    expect(calls).toEqual(["create:Product Launch", "load:tpl-1", "load:tpl-1"]);
  });

  it("creates once per fixture, and loads on return to a visited one", async () => {
    const { adoptTemplate, setFixture } = setup();
    const { instance, calls } = stubEditor();

    await adoptTemplate(instance);
    setFixture("newsletter");
    await adoptTemplate(instance);
    // Back to the first: its id is remembered, so this loads.
    setFixture("product-launch");
    await adoptTemplate(instance);

    expect(calls).toEqual([
      "create:Product Launch",
      "create:Newsletter",
      "load:tpl-1",
    ]);
  });

  it("gives up quietly when the store refuses to create", async () => {
    const { adoptTemplate } = setup();
    const { instance, calls } = stubEditor({ createFails: true });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    // A `templates.create: false` store has nothing to attach to. The editor
    // still edits; it just cannot persist, which is what that control shows.
    await adoptTemplate(instance);
    expect(calls).toEqual([]);
    expect(info).toHaveBeenCalledWith(
      "[playground] no template attached:",
      "create() is disabled by the provider",
    );
    info.mockRestore();
  });

  it("retries creation on the next attach after a refusal, rather than caching the failure", async () => {
    const { adoptTemplate } = setup();
    const failing = stubEditor({ createFails: true });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await adoptTemplate(failing.instance);
    info.mockRestore();

    // Toggling `templates.create` back on must recover: nothing was memoised
    // for this slug, so the next attach creates.
    const working = stubEditor();
    await adoptTemplate(working.instance);
    expect(working.calls).toEqual(["create:Product Launch"]);
  });
});
