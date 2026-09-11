import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "neutral",
  target: "es2022",
  sourcemap: true,
  clean: true,
  dts: { resolver: "tsc", compilerOptions: { declarationMap: false } },
});
