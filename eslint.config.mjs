import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

const tsRules = {
  "no-unused-vars": "off",
  "@typescript-eslint/no-unused-vars": [
    "warn",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      ignoreRestSiblings: true,
    },
  ],
  "@typescript-eslint/no-explicit-any": "off",
  "@typescript-eslint/no-empty-object-type": "off",
};

export default tseslint.config(
  // ── Global ignores ────────────────────────────────────────────────────
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.d.ts"],
  },

  // ── TypeScript files ──────────────────────────────────────────────────
  {
    files: ["packages/*/src/**/*.ts", "apps/*/src/**/*.ts"],
    extends: [tseslint.configs.recommended],
    rules: tsRules,
  },

  // ── Vue single-file components ────────────────────────────────────────
  ...pluginVue.configs["flat/recommended"].map((cfg) => ({
    ...cfg,
    files: ["packages/*/src/**/*.vue", "apps/*/src/**/*.vue"],
  })),
  {
    files: ["packages/*/src/**/*.vue", "apps/*/src/**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...tsRules,

      // Relax rules that clash with project conventions / Prettier
      "vue/multi-word-component-names": "off",
      "vue/no-v-html": "off",
      "vue/html-self-closing": "off",
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/html-indent": "off",
      "vue/html-closing-bracket-newline": "off",
      "vue/first-attribute-linebreak": "off",
      "vue/attributes-order": "off",
      "vue/html-closing-bracket-spacing": "off",
      "vue/html-quotes": "off",
      "vue/multiline-html-element-content-newline": "off",
    },
  },
);
