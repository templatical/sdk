---
"@templatical/types": minor
"@templatical/editor": minor
"@templatical/template-tools": minor
"@templatical/ai-kit": minor
---

`displayConditions.onRequest` lets a host open its own condition builder. The callback receives a copy of the block and, when one is set, the current condition including opaque `data`. `null` cancels. `conditions` is optional. With `onRequest` set, `conditions` and `allowCustom` are ignored. `DisplayCondition.data` round-trips through the template.
