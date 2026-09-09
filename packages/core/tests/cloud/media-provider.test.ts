import { describe, expect, it, vi, beforeEach } from "vitest";
import { createCloudMediaProvider } from "../../src/cloud/media-provider";
import type { AuthManager } from "../../src/cloud/auth";
import type { PlanConfig } from "@templatical/types";

/**
 * Cloud's adapter for the same media contract a consumer implements.
 *
 * The weight is the mapping (snake_case wire → camelCase `MediaAsset`) and
 * the live plan-config getters. `templateId` is a BYO param Cloud ignores.
 */

function createMockAuthManager(): AuthManager {
  return {
    projectId: "proj-1",
    tenantId: "tenant-1",
    tenantSlug: "acme",
    authenticatedFetch: vi.fn(),
  } as unknown as AuthManager;
}

function mockBrowseResponse(
  items: unknown[] = [],
  nextCursor: string | null = null,
): Response {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        data: items,
        meta: {
          path: "/media",
          per_page: 20,
          next_cursor: nextCursor,
          prev_cursor: null,
        },
      }),
  } as unknown as Response;
}

function mockJsonResponse<T>(data: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(status === 204 ? undefined : { data }),
  } as unknown as Response;
}

function wireItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    url: "https://cdn.example.com/hero.png",
    filename: "hero.png",
    alt_text: "Hero image",
    mime_type: "image/png",
    small_url: "https://cdn.example.com/hero-sm.png",
    medium_url: "https://cdn.example.com/hero-md.png",
    large_url: "https://cdn.example.com/hero-lg.png",
    folder_id: "f1",
    conversions_generated: true,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-02T11:00:00Z",
    size: 12345,
    width: 800,
    height: 600,
    ...overrides,
  };
}

function setup(getPlanConfig?: () => PlanConfig | null) {
  const authManager = createMockAuthManager();
  const provider = createCloudMediaProvider(authManager, getPlanConfig);
  return { authManager, provider };
}

function fetchUrl(authManager: AuthManager): string {
  return String(vi.mocked(authManager.authenticatedFetch).mock.calls[0][0]);
}

describe("createCloudMediaProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("wire shape → contract shape", () => {
    it("maps one snake_case item to camelCase MediaAsset with the exact fields", async () => {
      const { authManager, provider } = setup();
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockBrowseResponse([wireItem()]),
      );

      const page = await provider.list();

      expect(page.items).toEqual([
        {
          id: "m1",
          url: "https://cdn.example.com/hero.png",
          filename: "hero.png",
          alt: "Hero image",
          mimeType: "image/png",
          thumbnailUrl: "https://cdn.example.com/hero-sm.png",
          folderId: "f1",
          createdAt: "2026-09-01T10:00:00Z",
          updatedAt: "2026-09-02T11:00:00Z",
          size: 12345,
          width: 800,
          height: 600,
        },
      ]);
    });

    it("omits thumbnailUrl when small_url and medium_url are both null", async () => {
      const { authManager, provider } = setup();
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockBrowseResponse([
          wireItem({ small_url: null, medium_url: null, large_url: null }),
        ]),
      );

      const [asset] = (await provider.list()).items;

      expect(asset.url).toBe("https://cdn.example.com/hero.png");
      expect("thumbnailUrl" in asset).toBe(false);
    });

    it("falls back to medium_url when small_url is null", async () => {
      const { authManager, provider } = setup();
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockBrowseResponse([wireItem({ small_url: null })]),
      );

      const [asset] = (await provider.list()).items;

      expect(asset.thumbnailUrl).toBe("https://cdn.example.com/hero-md.png");
    });

    it("maps list { data, meta.next_cursor } to { items, nextCursor }", async () => {
      const { authManager, provider } = setup();
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockBrowseResponse([wireItem()], "cursor-2"),
      );

      const page = await provider.list();

      expect(page.nextCursor).toBe("cursor-2");
      expect(page.items[0].id).toBe("m1");
    });

    it("omits nextCursor when the wire cursor is null", async () => {
      const { authManager, provider } = setup();
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockBrowseResponse([wireItem()], null),
      );

      const page = await provider.list();

      expect("nextCursor" in page).toBe(false);
    });
  });

  describe("list query", () => {
    it("sends search and drops templateId", async () => {
      const { authManager, provider } = setup();
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockBrowseResponse(),
      );

      await provider.list({ templateId: "t1", search: "hero" });

      const url = fetchUrl(authManager);
      expect(url).toContain("search=hero");
      expect(url).not.toContain("templateId");
      expect(url).not.toContain("template_id");
    });

    it("forwards folderId as folder_id, category, and cursor", async () => {
      const { authManager, provider } = setup();
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockBrowseResponse(),
      );

      await provider.list({
        folderId: "f1",
        category: "images",
        cursor: "abc",
        templateId: "t1",
      });

      const url = fetchUrl(authManager);
      expect(url).toContain("folder_id=f1");
      expect(url).toContain("category=images");
      expect(url).toContain("cursor=abc");
      expect(url).not.toContain("templateId");
      expect(url).not.toContain("template_id");
    });
  });

  describe("storage / limits are live", () => {
    it("storage() is null until plan config has loaded, then maps used_bytes / limit_bytes", async () => {
      let plan: PlanConfig | null = null;
      const { provider } = setup(() => plan);

      expect(await provider.storage()).toBe(null);

      plan = {
        storage: { used_bytes: 10, limit_bytes: 100 },
      } as PlanConfig;

      expect(await provider.storage()).toEqual({
        usedBytes: 10,
        limitBytes: 100,
      });
    });

    it("reads maxFileSize and mimeTypes from plan config at call time, not construction", () => {
      let plan: PlanConfig | null = null;
      const { provider } = setup(() => plan);

      expect(provider.maxFileSize).toBeUndefined();
      expect(provider.mimeTypes).toBeUndefined();

      plan = {
        media: {
          use_media_library: true,
          max_file_size: 1_048_576,
          categories: {
            images: {
              mime_types: ["image/png", "image/jpeg"],
              extensions: [".png", ".jpg"],
            },
          },
        },
      } as PlanConfig;

      expect(provider.maxFileSize).toBe(1_048_576);
      expect(provider.mimeTypes).toEqual({
        images: ["image/png", "image/jpeg"],
      });
    });
  });

  describe("folders.list", () => {
    it("flattens a tree depth-first into { id, name, parentId }", async () => {
      const { authManager, provider } = setup();
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockJsonResponse([
          {
            id: "a",
            name: "A",
            children: [{ id: "b", name: "B", parent_id: "a" }],
          },
        ]),
      );

      if (provider.folders === false) {
        throw new Error("Cloud folders must be implemented");
      }
      const folders = await provider.folders.list();

      expect(folders).toEqual([
        { id: "a", name: "A", parentId: null },
        { id: "b", name: "B", parentId: "a" },
      ]);
      expect(folders[1].parentId).toBe("a");
    });

    it("accepts an already-flat list of parent_id rows", async () => {
      const { authManager, provider } = setup();
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockJsonResponse([
          { id: "a", name: "A", parent_id: null },
          { id: "b", name: "B", parent_id: "a" },
        ]),
      );

      if (provider.folders === false) {
        throw new Error("Cloud folders must be implemented");
      }
      const folders = await provider.folders.list();

      expect(folders).toEqual([
        { id: "a", name: "A", parentId: null },
        { id: "b", name: "B", parentId: "a" },
      ]);
    });
  });

  describe("mutations", () => {
    it("implements every method as a function, never false", () => {
      const { provider } = setup();

      expect(provider.create).not.toBe(false);
      expect(provider.update).not.toBe(false);
      expect(provider.delete).not.toBe(false);
      expect(provider.folders).not.toBe(false);
      expect(provider.replace).not.toBe(false);
      expect(provider.importFromUrl).not.toBe(false);
      expect(provider.checkUsage).not.toBe(false);
      expect(provider.frequentlyUsed).not.toBe(false);
      expect(provider.storage).not.toBe(false);

      if (provider.folders === false) {
        throw new Error("Cloud folders must be implemented");
      }
      expect(provider.folders.create).not.toBe(false);
      expect(provider.folders.update).not.toBe(false);
      expect(provider.folders.delete).not.toBe(false);
      expect(provider.folders.move).not.toBe(false);
    });

    it("create posts FormData with file and folder_id, ignoring templateId", async () => {
      const { authManager, provider } = setup();
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockJsonResponse(wireItem()),
      );
      const file = new File(["bytes"], "hero.png", { type: "image/png" });

      if (provider.create === false) {
        throw new Error("Cloud create must be implemented");
      }
      const asset = await provider.create({
        file,
        folderId: "f1",
        templateId: "t1",
      });

      expect(asset.id).toBe("m1");
      expect(asset.alt).toBe("Hero image");
      const [url, init] = vi.mocked(authManager.authenticatedFetch).mock
        .calls[0];
      expect(String(url)).toContain("/media/upload");
      expect(String(url)).not.toContain("templateId");
      expect(String(url)).not.toContain("template_id");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBeInstanceOf(FormData);
      const formData = init?.body as FormData;
      expect(formData.get("file")).toBeInstanceOf(File);
      expect(formData.get("folder_id")).toBe("f1");
    });

    it("delete posts ids", async () => {
      const { authManager, provider } = setup();
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue(
        mockJsonResponse(undefined, 204),
      );

      if (provider.delete === false) {
        throw new Error("Cloud delete must be implemented");
      }
      await provider.delete(["m1", "m2"]);

      const init = vi.mocked(authManager.authenticatedFetch).mock.calls[0][1];
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({ ids: ["m1", "m2"] });
    });

    it("checkUsage maps template_count / template_names", async () => {
      const { authManager, provider } = setup();
      vi.mocked(authManager.authenticatedFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: {
              m1: {
                template_count: 2,
                template_names: ["Welcome", "Promo"],
              },
            },
          }),
      } as unknown as Response);

      if (provider.checkUsage === false) {
        throw new Error("Cloud checkUsage must be implemented");
      }
      const usage = await provider.checkUsage(["m1"]);

      expect(usage).toEqual({
        m1: { templateCount: 2, templateNames: ["Welcome", "Promo"] },
      });
    });
  });
});
