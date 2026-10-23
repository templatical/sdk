---
"@templatical/editor": minor
---

`@templatical/quality` is an optional dependency of the editor and installs by default. Leaving it out is supported: the editor works without it and hides the Issues tab.

The packaging also declares quality as an optional peer so bundlers can resolve its optional import when the package is absent. The default install enables the Issues panel and lint badges.
