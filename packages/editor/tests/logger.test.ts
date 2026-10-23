import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { build } from "vite";
import { describe, expect, it, vi } from "vitest";

describe("browser logger", () => {
  it.each(["development", "production"])(
    "respects %s after bundling in a browser without process",
    async (mode) => {
      const built = await build({
        configFile: false,
        logLevel: "silent",
        define: { "process.env.NODE_ENV": JSON.stringify(mode) },
        build: {
          lib: {
            entry: resolve(import.meta.dirname, "../src/utils/logger.ts"),
            name: "EditorLogger",
            formats: ["iife"],
          },
          write: false,
        },
      });
      const output = Array.isArray(built) ? built[0] : built;
      if (!("output" in output)) throw new Error("Expected a completed build");
      const chunk = output.output.find((file) => file.type === "chunk");
      if (!chunk) throw new Error("Logger build emitted no code");
      const info = vi.fn();
      // A typeof-process guard can override a statically replaced production
      // value: browsers lack process even though the bundle knows its mode.
      runInNewContext(`${chunk.code}; EditorLogger.logger.info("hint");`, {
        console: { info },
      });
      expect(info).toHaveBeenCalledTimes(mode === "production" ? 0 : 1);
    },
  );
});
