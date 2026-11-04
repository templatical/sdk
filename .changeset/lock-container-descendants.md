---
"@templatical/types": patch
"@templatical/core": patch
---

Deleting or moving a section or wrapper now respects locks on its descendants. Section updates preserve peer-locked descendants when changing type or children and reject incoming child IDs locked by a peer or already used outside the section.
