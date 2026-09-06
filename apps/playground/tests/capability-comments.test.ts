import { describe, expect, it, vi } from "vitest";
import { buildCapabilityConfig } from "../src/config/build";
import { commentsCapability } from "../src/config/capabilities/comments";
import { capabilityById } from "../src/config/capabilities";
import type { CommentsProvider } from "@templatical/types";

function makeImpl(): CommentsProvider {
  return {
    list: vi.fn(async () => []),
    create: vi.fn(async () => ({ id: "c1" })),
    update: vi.fn(async () => ({ id: "c1" })),
    delete: vi.fn(async () => undefined),
    setResolved: vi.fn(async () => ({ id: "c1" })),
  } as unknown as CommentsProvider;
}

describe("commentsCapability", () => {
  it("supplies every mutation when all controls are on", () => {
    const impl = makeImpl();
    const config = buildCapabilityConfig(commentsCapability, {}, impl);
    expect(config.comments).toEqual({
      list: impl.list,
      create: impl.create,
      update: impl.update,
      delete: impl.delete,
      setResolved: impl.setResolved,
      // Attached by the capability itself, not carried in from `impl`: the
      // drawer's Events tab is fed from inside `build()`, so the provider the
      // editor is handed reports five lifecycle events the demo backend never
      // declared. Matched by shape rather than identity — which function
      // each one is, and that it forwards the SDK's own `meta.origin`,
      // belongs to `config-build-all.test.ts`, while this exhaustive
      // comparison is what stops a sixth key appearing unnoticed.
      onCreated: expect.any(Function),
      onUpdated: expect.any(Function),
      onDeleted: expect.any(Function),
      onResolved: expect.any(Function),
      onUnresolved: expect.any(Function),
    });
  });

  it("withholds every mutation as literal false when the controls are off", () => {
    const impl = makeImpl();
    const config = buildCapabilityConfig(
      commentsCapability,
      {
        "comments.create": false,
        "comments.update": false,
        "comments.delete": false,
        "comments.setResolved": false,
      },
      impl,
    );
    expect(config.comments).toEqual({
      list: impl.list,
      create: false,
      update: false,
      delete: false,
      setResolved: false,
      // Reporting is independent of permission: a store that forbids every
      // mutation still tells the feed when a change reaches it some other
      // way — a plugin, or a remote peer through `subscribe`.
      onCreated: expect.any(Function),
      onUpdated: expect.any(Function),
      onDeleted: expect.any(Function),
      onResolved: expect.any(Function),
      onUnresolved: expect.any(Function),
    });
  });

  it("never withholds list — the panel would have nothing to show", () => {
    expect(commentsCapability.controls.map((c) => c.path)).toEqual([
      "comments.create",
      "comments.update",
      "comments.delete",
      "comments.setResolved",
    ]);
  });

  it("is registered and findable by id", () => {
    expect(capabilityById("comments")).toBe(commentsCapability);
  });
});
