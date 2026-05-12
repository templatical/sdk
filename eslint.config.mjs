import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import templaticalEditorRules from "./packages/editor/eslint-rules/index.js";

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
    plugins: {
      "templatical-editor": templaticalEditorRules,
    },
    rules: tsRules,
  },

  // ── Editor-package shadow-DOM guard rule (TS) ─────────────────────────
  {
    files: ["packages/editor/src/**/*.ts"],
    rules: {
      "templatical-editor/no-unannotated-document-global": "error",
    },
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
      "templatical-editor": templaticalEditorRules,
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

      // Composable-return props (like `panelState`) contain mutable refs by
      // design. Vue's lint rule can't distinguish that from replacing the
      // prop itself, which it treats the same way. Disable the false positive.
      "vue/no-mutating-props": "off",
    },
  },

  // ── Editor-package shadow-DOM guard rules (.vue) ──────────────────────
  {
    files: ["packages/editor/src/**/*.vue"],
    rules: {
      "templatical-editor/no-teleport-to-body": "error",
      "templatical-editor/no-unannotated-document-global": "error",
    },
  },
);
