---
"@templatical/types": patch
"@templatical/core": patch
---

Deleting or moving a section or wrapper now respects locks on its descendants. Section updates preserve peer-locked descendants when changing type or children and reject incoming child IDs locked by a peer, already used outside the section, or repeated in the incoming children.
Localized section rewrites also reject duplicate IDs after existing children are restored.
