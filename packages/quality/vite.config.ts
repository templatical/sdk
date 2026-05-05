import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    target: "es2022",
    sourcemap: true,
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      fileName: "index",
      formats: ["es"],
    },
    rolldownOptions: {
      external: ["@templatical/types", "htmlparser2"],
    },
  },
});
