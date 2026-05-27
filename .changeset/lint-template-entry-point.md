---
"@templatical/quality": minor
"@templatical/editor": patch
---

Add a single `lintTemplate(content, options?)` entry point that runs every linter — accessibility, structure, and links — and returns the merged issue list. Prefer it over calling `lintAccessibility` / `lintStructure` / `lintLinks` individually: new linter categories are picked up automatically by every consumer that funnels through it.

The editor's live linter (`useTemplateLint`) now calls `lintTemplate` internally; behavior is unchanged. The individual linter exports remain available.
