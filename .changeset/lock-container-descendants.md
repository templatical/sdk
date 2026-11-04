---
"@templatical/types": patch
"@templatical/core": patch
---

Deleting or moving a section or wrapper now respects locks on its descendants. Rewriting a section's children also preserves peer-locked descendants when their IDs stay the same.
