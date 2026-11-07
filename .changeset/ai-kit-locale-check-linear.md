---
"@templatical/ai-kit": patch
---

An editing session checks locale layers in time proportional to the template size. Each locale is resolved only for the blocks that carry its layer, so a template with thousands of locales no longer makes every batch resolve the whole template once per locale.
