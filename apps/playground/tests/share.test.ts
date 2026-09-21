import { afterEach, describe, expect, it, vi } from "vitest";
import { clearShareCache, fetchShare } from "../src/host/share";

const sample = {
  id: "abc123",
  sceneId: "minimum",
  content: {
    blocks: [],
    settings: {
      width: 600,
      backgroundColor: "#ffffff",
      textColor: "#1a1a1a",
      linkUnderline: true,
      fontFamily: "Arial",
      locale: "en",
    },
  },
  createdAt: "2026-09-21T00:00:00.000Z",
};

afterEach(() => {
  clearShareCache();
  vi.unstubAllGlobals();
});

describe("fetchShare", () => {
  it("returns the record and caches the second call", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sample,
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchShare("abc123");
    const second = await fetchShare("abc123");
    expect(first.sceneId).toBe("minimum");
    expect(second.content).toEqual(sample.content);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps 404 to ShareError not-found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    await expect(fetchShare("missing")).rejects.toEqual(
      expect.objectContaining({ name: "ShareError", code: "not-found" }),
    );
  });
});
