---
description: All 6 lintLinks rules — javascript-protocol hrefs, unsupported protocols, malformed mailto/tel URIs, localhost-or-staging hosts, and relative URLs — with default severities.
---

# Link rule catalog

The 6 rules `lintLinks` ships. Each rule lives in `packages/quality/src/links/rules/`; severity is user-overridable per [Options](../options). All rules scan every URL source returned by `walkUrls` — anchors inside rich text plus `button.url`, `image.linkUrl`, `video.url`, `menu.items[].url`, `social.icons[].url`.

## Dangerous protocols

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `link.javascript-protocol` | error | — | Href starts with `javascript:` (or whitespace-padded / case-bypass variants like ` JaVaScRiPt:`). The editor drops these href values from live rich text and rendered custom-block canvas HTML through `sanitizeHtml`; the rich-text link dialog blocks insertion. Values from imported JSON, programmatic API calls, or structured fields (`button.url`, `image.linkUrl`, `menu.items[].url`, `social.icons[].url`) can remain in the template. This rule reports them at authoring time so the JSON can be corrected. |

## Unsupported protocols

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `link.unsupported-protocol` | warning | — | Href uses an explicit protocol other than `http`, `https`, `mailto`, `tel`, or `sms`. Custom protocols (`ftp:`, `file:`, `data:`, app deep-links) typically don't work from email clients and indicate either a copy-paste mistake or an unsupported integration. Relative URLs and bare paths are ignored here — `link.relative-url` covers the path-shaped ones. `javascript:` is excluded — its own rule covers that. |

## Malformed URIs

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `link.malformed-mailto` | warning | — | `mailto:` href is empty, has no `@`, is missing the local or domain part, or the domain has no `.`. Query-string fragments (`?subject=…`, `?cc=…`, `?body=…`) are accepted. Multi-recipient `mailto:a@x.com,b@y.com` is accepted. Pragmatic — not a full RFC validator. |
| `link.malformed-tel` | warning | — | `tel:` href contains characters outside `+`, digits, spaces, dashes, parentheses, and dots. Most clients silently fail on bad `tel:` URIs (e.g. `tel:CALL-NOW`). |

## Environment leaks

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `link.localhost-or-staging` | warning | — | URL host matches the configured non-production host list. Default list catches `localhost`, `127.0.0.1`, `0.0.0.0`, `*.local`, `*.staging.*`, `*.dev.*`. Configurable via `LintOptions.links.nonProductionHosts` — see the [overview](./) for default extension / replacement patterns. Only fires on `http(s)` and `ftp(s)` URLs; mailto/tel/sms are skipped. |

## Relative URLs

| Rule | Default severity | Auto-fix | What it checks |
|---|---|---|---|
| `link.relative-url` | warning | — | Href starts with `/`, `./`, `../` or `?` — a root-relative, relative, query-only or protocol-relative (`//host`) URL. A sent email has no page address to resolve it against, so the link breaks in the inbox. Keyed on those prefixes only: the linter has no merge-tag syntax, so a URL that opens with a tag (<code v-pre>{{ unsubscribe_url }}</code>) is not flagged, and neither is a scheme-less host (`example.com/page`), a bare path (`page.html`) or an `#anchor`. The rich-text link dialog stores such a path as typed and upgrades `//host` to `https://host`. |

## Auto-fixes

Each link rule is destructive (strip href / change protocol) and the right answer depends on intent — `javascript:alert(1)` may belong on a button that should be deleted, or it may be a typo for `mailto:`. Detection-only is safer than guessing. Headless callers can filter `LintIssue[]` by `ruleId.startsWith("link.")` and apply their own policy (block save, send to review queue, …).
