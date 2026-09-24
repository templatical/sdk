import { beforeEach, describe, expect, it, vi } from "vitest";
import { MediaApiClient } from "../../src/cloud/media-api";
import type { AuthManager } from "../../src/cloud/auth";

function createMockAuthManager(): AuthManager {
  return {
    projectId: "proj-1",
    tenantId: "tenant-1",
    tenantSlug: "acme",
    authenticatedFetch: vi.fn(),
  } as unknown as AuthManager;
}

function mockJson<T>(data: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(status === 204 ? undefined : { data }),
  } as unknown as Response;
}

function mockRaw(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function mockError(
  message: string,
  status = 422,
  jsonImpl?: () => Promise<unknown>,
): Response {
  return {
    ok: false,
    status,
    json: jsonImpl ?? (() => Promise.resolve({ message })),
  } as unknown as Response;
}

const item = {
  id: "m1",
  filename: "hero.png",
  mimeType: "image/png",
  size: 12,
  url: "https://cdn.example.com/hero.png",
  folderId: null,
  width: 800,
  height: 600,
  alt: "Hero",
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
};

describe("MediaApiClient", () => {
  let auth: AuthManager;
  let client: MediaApiClient;

  beforeEach(() => {
    auth = createMockAuthManager();
    client = new MediaApiClient(auth);
  });

  describe("browseMedia", () => {
    it("omits the query string when no filters are set", async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(
        mockRaw({ data: [], meta: { nextCursor: null } }),
      );

      await client.browseMedia({});

      const url = String(vi.mocked(auth.authenticatedFetch).mock.calls[0][0]);
      expect(url).toBe("/api/v1/projects/proj-1/tenants/acme/media/browse");
      expect(url).not.toContain("?");
    });

    it("appends every set filter and skips empty ones", async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(
        mockRaw({ data: [item], meta: { nextCursor: "c2" } }),
      );

      await client.browseMedia({
        folderId: "f1",
        search: "hero",
        category: "images",
        sort: "newest",
        cursor: "c1",
      });

      const url = String(vi.mocked(auth.authenticatedFetch).mock.calls[0][0]);
      expect(url).toContain("/media/browse?");
      expect(url).toContain("folderId=f1");
      expect(url).toContain("search=hero");
      expect(url).toContain("category=images");
      expect(url).toContain("sort=newest");
      expect(url).toContain("cursor=c1");
    });

    it("returns the raw browse envelope, not .data", async () => {
      const envelope = {
        data: [item],
        meta: {
          path: "/media",
          perPage: 20,
          nextCursor: "n",
          prevCursor: null,
        },
      };
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockRaw(envelope));

      await expect(client.browseMedia({})).resolves.toEqual(envelope);
    });

    it("throws the JSON message, or HTTP error N when the body is not JSON", async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(
        mockError("quota exceeded", 422),
      );
      await expect(client.browseMedia({})).rejects.toThrow("quota exceeded");

      vi.mocked(auth.authenticatedFetch).mockResolvedValue(
        mockError("", 502, () => Promise.reject(new Error("no body"))),
      );
      await expect(client.browseMedia({})).rejects.toThrow("HTTP error 502");
    });
  });

  describe("FormData uploads", () => {
    it("posts the file without a JSON Content-Type so the boundary survives", async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJson(item));
      const file = new File(["x"], "hero.png", { type: "image/png" });

      await expect(client.uploadMedia(file)).resolves.toEqual(item);

      const [, init] = vi.mocked(auth.authenticatedFetch).mock.calls[0];
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ Accept: "application/json" });
      expect(init?.body).toBeInstanceOf(FormData);
      expect((init?.body as FormData).get("file")).toBe(file);
      expect((init?.body as FormData).get("folderId")).toBeNull();
    });

    it("appends folderId only when one is given", async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJson(item));
      const file = new File(["x"], "hero.png", { type: "image/png" });

      await client.uploadMedia(file, "f1");

      const body = vi.mocked(auth.authenticatedFetch).mock.calls[0][1]
        ?.body as FormData;
      expect(body.get("folderId")).toBe("f1");
    });

    it("replaces through FormData on the item URL", async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJson(item));
      const file = new File(["y"], "hero.png", { type: "image/png" });

      await expect(client.replaceMedia("m1", file)).resolves.toEqual(item);

      const [url, init] = vi.mocked(auth.authenticatedFetch).mock.calls[0];
      expect(String(url)).toBe(
        "/api/v1/projects/proj-1/tenants/acme/media/m1/replace",
      );
      expect(init?.headers).toEqual({ Accept: "application/json" });
      expect((init?.body as FormData).get("file")).toBe(file);
    });

    it("surfaces a replace error message", async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(
        mockError("not an image", 422),
      );
      await expect(
        client.replaceMedia("m1", new File(["x"], "hero.png")),
      ).rejects.toThrow("not an image");
    });
  });

  describe("JSON request helper", () => {
    it("returns undefined on 204 without reading a body", async () => {
      const json = vi.fn();
      vi.mocked(auth.authenticatedFetch).mockResolvedValue({
        ok: true,
        status: 204,
        json,
      } as unknown as Response);

      await expect(client.deleteMedia(["m1"])).resolves.toBeUndefined();
      expect(json).not.toHaveBeenCalled();
    });

    it("unwraps .data and sends JSON content-type", async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJson(item));

      await client.updateMedia("m1", "renamed.png", "New alt");

      const [url, init] = vi.mocked(auth.authenticatedFetch).mock.calls[0];
      expect(String(url)).toBe("/api/v1/projects/proj-1/tenants/acme/media/m1");
      expect(init?.method).toBe("PUT");
      expect(init?.headers).toMatchObject({
        "Content-Type": "application/json",
        Accept: "application/json",
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        filename: "renamed.png",
        alt: "New alt",
      });
    });

    it("omits unset update fields", async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJson(item));
      await client.updateMedia("m1", "only-name.png");
      expect(
        JSON.parse(
          String(vi.mocked(auth.authenticatedFetch).mock.calls[0][1]?.body),
        ),
      ).toEqual({ filename: "only-name.png" });
    });

    it("throws HTTP error N when an error body is not JSON", async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("html")),
      } as unknown as Response);

      await expect(client.deleteMedia(["m1"])).rejects.toThrow(
        "HTTP error 500",
      );
    });
  });

  describe("folders and the rest of the surface", () => {
    it("moves items, including to the root", async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJson([item]));

      await client.moveMedia(["m1"], null);

      const [, init] = vi.mocked(auth.authenticatedFetch).mock.calls[0];
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        ids: ["m1"],
        folderId: null,
      });
    });

    it("lists, creates, renames and deletes folders", async () => {
      const folder = { id: "f1", name: "Heroes" };
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJson([folder]));
      await expect(client.getMediaFolders()).resolves.toEqual([folder]);
      expect(String(vi.mocked(auth.authenticatedFetch).mock.calls[0][0])).toBe(
        "/api/v1/projects/proj-1/tenants/acme/media/folders",
      );

      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJson(folder));
      await client.createMediaFolder("Heroes");
      expect(
        JSON.parse(
          String(vi.mocked(auth.authenticatedFetch).mock.calls[1][1]?.body),
        ),
      ).toEqual({ name: "Heroes", parentId: null });

      await client.createMediaFolder("2024", "f1");
      expect(
        JSON.parse(
          String(vi.mocked(auth.authenticatedFetch).mock.calls[2][1]?.body),
        ),
      ).toEqual({ name: "2024", parentId: "f1" });

      await client.renameMediaFolder("f1", "Shots");
      const [renameUrl, renameInit] = vi.mocked(auth.authenticatedFetch).mock
        .calls[3];
      expect(String(renameUrl)).toContain("/media/folders/f1");
      expect(renameInit?.method).toBe("PUT");
      expect(JSON.parse(String(renameInit?.body))).toEqual({ name: "Shots" });

      const json = vi.fn();
      vi.mocked(auth.authenticatedFetch).mockResolvedValue({
        ok: true,
        status: 204,
        json,
      } as unknown as Response);
      await client.deleteMediaFolder("f1");
      const [destroyUrl, destroyInit] = vi.mocked(auth.authenticatedFetch).mock
        .calls[4];
      expect(String(destroyUrl)).toContain("/media/folders/f1");
      expect(destroyInit?.method).toBe("DELETE");
    });

    it("returns the check-usage envelope as-is", async () => {
      const envelope = {
        data: { m1: { templateCount: 2, templateNames: ["Welcome"] } },
      };
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockRaw(envelope));

      await expect(client.checkMediaUsage(["m1"])).resolves.toEqual(envelope);
      const [url, init] = vi.mocked(auth.authenticatedFetch).mock.calls[0];
      expect(String(url)).toContain("/media/check-usage");
      expect(JSON.parse(String(init?.body))).toEqual({ ids: ["m1"] });
    });

    it("throws on check-usage failure", async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(
        mockError("unavailable", 503),
      );
      await expect(client.checkMediaUsage(["m1"])).rejects.toThrow(
        "unavailable",
      );
    });

    it("imports from a URL, defaulting folderId to null", async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJson(item));

      await client.importFromUrl("https://cdn.example.com/a.png");
      expect(
        JSON.parse(
          String(vi.mocked(auth.authenticatedFetch).mock.calls[0][1]?.body),
        ),
      ).toEqual({ url: "https://cdn.example.com/a.png", folderId: null });

      await client.importFromUrl("https://cdn.example.com/a.png", "f1");
      expect(
        JSON.parse(
          String(vi.mocked(auth.authenticatedFetch).mock.calls[1][1]?.body),
        ),
      ).toEqual({ url: "https://cdn.example.com/a.png", folderId: "f1" });
    });

    it("loads frequently used", async () => {
      vi.mocked(auth.authenticatedFetch).mockResolvedValue(mockJson([item]));
      await expect(client.getFrequentlyUsed()).resolves.toEqual([item]);
      expect(String(vi.mocked(auth.authenticatedFetch).mock.calls[0][0])).toBe(
        "/api/v1/projects/proj-1/tenants/acme/media/frequently-used",
      );
    });
  });
});
