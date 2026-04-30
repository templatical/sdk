# Security Policy

Thanks for helping keep Templatical and its users safe.

## Supported versions

Only the latest minor release line receives security fixes. Older versions may receive a fix on a best-effort basis if the issue is severe and the patch is small.

| Version | Supported |
|---------|-----------|
| Latest `1.x` | ✅ |
| Older       | ❌ |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Use one of these private channels instead:

1. **GitHub Security Advisories** *(preferred)* — open a private report at <https://github.com/templatical/sdk/security/advisories/new>. This keeps the discussion confidential and lets us coordinate a fix and disclosure together.
2. **Email** — `security@templatical.com`. Encrypt with PGP if you have a sensitive payload (key on request).

When reporting, please include:

- A clear description of the issue and its impact
- Steps to reproduce, or a minimal proof of concept
- Affected packages and version ranges, if known
- Any suggested mitigation or patch ideas

You don't need to have a fix in hand — a clear report is enough.

## What to expect

| Stage | Target |
|-------|--------|
| Acknowledgement of your report | within **3 business days** |
| Initial triage and severity assessment | within **7 days** |
| Patch released for confirmed issues | depends on severity (critical: days, low: next regular release) |
| Public advisory and credit | after patched versions are published |

We'll keep you in the loop while we investigate and remediate. If you'd like public credit in the advisory, let us know how you'd like to be named (and a link, if any).

## Scope

In scope:

- Code in this repository (`@templatical/editor`, `@templatical/core`, `@templatical/media-library`, `@templatical/types`, `@templatical/renderer`, `@templatical/import-beefree`)
- Published npm packages built from this repository
- The CDN bundles served from `unpkg.com` / `jsdelivr.net` for our packages

Out of scope (please report these to the appropriate vendor instead):

- Third-party dependencies — open an advisory upstream; we'll bump versions once a fix lands
- Templatical Cloud infrastructure (templatical.com, api.templatical.com) — email `security@templatical.com` directly
- Demo content on `play.templatical.com` (rate-limited, no real user data)
- Self-hosted deployments configured by third parties

## Safe harbor

Good-faith security research conducted under this policy is welcome and we won't pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, and service degradation
- Don't access more data than necessary to demonstrate the issue
- Give us a reasonable window to fix the issue before public disclosure
- Don't extort, threaten, or otherwise act in bad faith

Thanks for your help making Templatical safer.
