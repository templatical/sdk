---
"@templatical/quality": minor
"@templatical/editor": minor
"@templatical/template-tools": minor
---

Add default-on compatibility lint for authored pass-through HTML and CSS, using a pinned caniemail snapshot, plus an explicit compiled-HTML Gmail size check. Agents and headless callers receive a concrete `suggestion` and `reference` on every issue, with affected clients and an excerpt when available. The editor shows suggestions and source links, and offers an on-demand Check size action when its render provider can compile without saving. `templatical validate --html` reports `htmlBytes` and a clipping warning.

Breaking changes: `LintIssue.suggestion` and `.reference` are required; existing `message` text is shortened to the problem, with the action in `suggestion`. Message maps and formatter results now contain `{ message, suggestion }` objects. Compatibility is on by default, so four category keys set to `false` no longer disable all linting; set the fifth `compatibility: false` too. Custom-block client-fact IDs move from `safety.*` to `compat.*`, and `CustomBlockIssueSeverity` now includes `info`.
