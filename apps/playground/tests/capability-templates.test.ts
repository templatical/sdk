import { describe, expect, it, vi } from "vitest";
import { buildCapabilityConfig } from "../src/config/build";
import { templatesCapability } from "../src/config/capabilities/templates";
import { capabilityById } from "../src/config/capabilities";
import type { TemplatesProvider } from "@templatical/types";

const stored = { id: "t1", name: "Demo", content: { blocks: [], settings: {} } };

function makeImpl(): TemplatesProvider {
  return {
    load: vi.fn(async () => stored),
    create: vi.fn(async () => stored),
    save: vi.fn(async () => stored),
    onSaved: vi.fn(),
  } as unknown as TemplatesProvider;
}

describe("templatesCapability", () => {
  it("supplies both mutations when all controls are on", () => {
    const impl = makeImpl();
    const config = buildCapabilityConfig(templatesCapability, {}, impl);
    expect(config.templates).toEqual({
      load: impl.load,
      create: impl.create,
      save: impl.save,
      onSaved: impl.onSaved,
    });
  });

  it("withholds create and save as literal false when their controls are off", () => {
    const impl = makeImpl();
    const config = buildCapabilityConfig(
      templatesCapability,
      { "templates.create": false, "templates.save": false },
      impl,
    );
    expect(config.templates).toEqual({
      load: impl.load,
      create: false,
      save: false,
      onSaved: impl.onSaved,
    });
  });

  it("forwards the provider's onSaved handler", () => {
    const impl = makeImpl();
    const config = buildCapabilityConfig(templatesCapability, {}, impl);
    expect(config.templates?.onSaved).toBe(impl.onSaved);
  });

  it("never withholds load — the editor could not open a template", () => {
    expect(templatesCapability.controls.map((c) => c.path)).toEqual([
      "templates.create",
      "templates.save",
    ]);
  });

  it("is registered and findable by id", () => {
    expect(capabilityById("templates")).toBe(templatesCapability);
  });
});
