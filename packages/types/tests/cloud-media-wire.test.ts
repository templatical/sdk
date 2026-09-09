import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PlanConfig } from "../src/cloud";

/**
 * Cloud JWT/plan wire fields — snake_case, matching the plan payload.
 * Constructing a `PlanConfig` literal is what proves the names type-check;
 * the reads prove they are the JWT fields, not the BYO camelCase contract.
 */
function jwtPlan(): PlanConfig {
  return {
    features: {
      ai_generation: false,
      collaboration: false,
      commenting: false,
      saved_modules: false,
      test_email: false,
    },
    limits: {
      max_file_size_mb: 10,
      max_templates: null,
      media_categories: ["images"],
      storage_limit_bytes: 100,
    },
    template_count: 0,
    plan: "free",
    media: {
      use_media_library: true,
      categories: {
        images: {
          mime_types: ["image/png"],
          extensions: [".png"],
        },
      },
      max_file_size: 1_048_576,
    },
    storage: {
      used_bytes: 10,
      limit_bytes: 100,
    },
    websocket: {
      host: "ws.example",
      port: 443,
      app_key: "key",
    },
  };
}

describe("PlanConfig media/storage JWT wire shape", () => {
  it("reads snake_case media and storage fields", () => {
    const config = jwtPlan();

    expect(config.media.use_media_library).toBe(true);
    expect(config.media.max_file_size).toBe(1_048_576);
    expect(config.media.categories.images).toEqual({
      mime_types: ["image/png"],
      extensions: [".png"],
    });
    expect(config.storage.used_bytes).toBe(10);
    expect(config.storage.limit_bytes).toBe(100);
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
