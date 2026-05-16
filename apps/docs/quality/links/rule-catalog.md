# Link rule catalog

The 5 rules `lintLinks` ships. Each rule lives in `packages/quality/src/links/rules/`; severity is user-overridable per [Options](../options). All rules scan every URL source returned by `walkUrls` — anchors inside rich text plus `button.url`, `image.linkUrl`, `video.url`, `menu.items[].url`, `social.icons[].url`.

## Dangerous protocols

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `link.javascript-protocol` | error | — | Href starts with `javascript:` (or whitespace-padded / case-bypass variants like ` JaVaScRiPt:`). The editor's `sanitizeRichTextHtml` already strips these from rich-text content at render so they can't execute, and the rich-text link dialog blocks insertion — but values from imported JSON, programmatic API calls, or structured fields (`button.url`, `image.linkUrl`, `menu.items[].url`, `social.icons[].url`) sit in the template silently. This rule surfaces them at authoring time so the JSON gets fixed, not just rendered around. |

## Unsupported protocols

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `link.unsupported-protocol` | warning | — | Href uses an explicit protocol other than `http`, `https`, `mailto`, `tel`, or `sms`. Custom protocols (`ftp:`, `file:`, `data:`, app deep-links) typically don't work from email clients and indicate either a copy-paste mistake or an unsupported integration. Relative URLs and bare paths are ignored. `javascript:` is excluded — its own rule covers that. |

## Malformed URIs

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `link.malformed-mailto` | warning | — | `mailto:` href is empty, has no `@`, is missing the local or domain part, or the domain has no `.`. Query-string fragments (`?subject=…`, `?cc=…`, `?body=…`) are accepted. Multi-recipient `mailto:a@x.com,b@y.com` is accepted. Pragmatic — not a full RFC validator. |
| `link.malformed-tel` | warning | — | `tel:` href contains characters outside `+`, digits, spaces, dashes, parentheses, and dots. Most clients silently fail on bad `tel:` URIs (e.g. `tel:CALL-NOW`). |

## Environment leaks

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `link.localhost-or-staging` | warning | — | URL host matches the configured non-production host list. Default list catches `localhost`, `127.0.0.1`, `0.0.0.0`, `*.local`, `*.staging.*`, `*.dev.*`. Configurable via `LintOptions.links.nonProductionHosts` — see the [overview](./) for default extension / replacement patterns. Only fires on `http(s)` and `ftp(s)` URLs; mailto/tel/sms are skipped. |

## Why no auto-fixes?

Each link rule is destructive (strip href / change protocol) and the right answer depends on intent — `javascript:alert(1)` may belong on a button that should be deleted, or it may be a typo for `mailto:`. Detection-only is safer than guessing. Headless callers can filter `LintIssue[]` by `ruleId.startsWith("link.")` and apply their own policy (block save, send to review queue, …).
