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
