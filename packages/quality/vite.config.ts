import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
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
      output: {
        banner:
          "/*! caniemail data © Rémi Parmentier, MIT — https://github.com/hteumeuleu/caniemail */",
      },
    },
  },
});
