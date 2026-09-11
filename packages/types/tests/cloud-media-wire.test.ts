import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PlanConfig } from "../src/cloud";

/**
 * Cloud JWT/plan `media` / `storage` fields. Constructing a `PlanConfig`
 * literal is what proves the names type-check.
 */
function jwtPlan(): PlanConfig {
  return {
    features: {
      aiGeneration: false,
      collaboration: false,
      commenting: false,
      savedModules: false,
      testEmail: false,
    },
    limits: {
      maxFileSizeMb: 10,
      maxTemplates: null,
      mediaCategories: ["images"],
      storageLimitBytes: 100,
    },
    templateCount: 0,
    plan: "free",
    media: {
      useMediaLibrary: true,
      categories: {
        images: {
          mimeTypes: ["image/png"],
          extensions: [".png"],
        },
      },
      maxFileSize: 1_048_576,
    },
    storage: {
      usedBytes: 10,
      limitBytes: 100,
    },
    websocket: {
      host: "ws.example",
      port: 443,
      appKey: "key",
    },
  };
}

describe("PlanConfig media/storage JWT wire shape", () => {
  it("reads media and storage fields", () => {
    const config = jwtPlan();

    expect(config.media.useMediaLibrary).toBe(true);
    expect(config.media.maxFileSize).toBe(1_048_576);
    expect(config.media.categories.images).toEqual({
      mimeTypes: ["image/png"],
      extensions: [".png"],
    });
    expect(config.storage.usedBytes).toBe(10);
    expect(config.storage.limitBytes).toBe(100);
  });
});

const PKG = join(import.meta.dirname, "..");

describe("types does not resolve @templatical/media-library", () => {
  it("cloud.ts does not import from @templatical/media-library", () => {
    const src = readFileSync(join(PKG, "src/cloud.ts"), "utf8");
    expect(src).not.toContain("@templatical/media-library");
  });

  it("tsconfig.json has no media-library paths entry", () => {
    const raw = readFileSync(join(PKG, "tsconfig.json"), "utf8");
    expect(raw).not.toContain("media-library");
    const tsconfig = JSON.parse(raw) as {
      compilerOptions?: { paths?: Record<string, string[]> };
    };
    expect(tsconfig.compilerOptions?.paths ?? {}).not.toHaveProperty(
      "@templatical/media-library",
    );
  });
});
