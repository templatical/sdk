---
description: lintLinks flags broken and dangerous template URLs; @templatical/types exports the editor's shared URL-scheme policy for HTML attributes and links.
---

# Links linter

`lintLinks(content, options?)` is the URL-hygiene checker inside [`@templatical/quality`](../). It walks every URL in the template — anchors inside rich text, `button.url`, `image.linkUrl`, `video.url`, `menu.items[].url`, `social.icons[].url` — and flags URL-shaped data that's broken, dangerous, or accidentally pointing at the wrong environment.

## Purpose

Email URLs are a long-tail bug source:

- A `javascript:` href slips into a template from an import; the render-time sanitizer drops it from live HTML, but the author never finds out the link is broken until a recipient complains.
- A staging URL ships to production because nobody diffed the JSON before send.
- A malformed `mailto:` makes "Contact us" silently dead.
- A `tel:` with letters in it doesn't dial anywhere.
- A `data:` or app-deep-link `href` looks fine in JSON but no email client renders it.
- A root-relative `/contact` copied from the website has no page to resolve against once the email is sent.

These aren't content-quality issues (different audience from a11y) and they aren't tree-corruption issues (the JSON validates). They live in their own category.

## Interaction with editor security

The editor already ships two URL-scheme defenses:

- **`useRichTextLinkDialog.normalizeLinkUrl`** — the rich-text link dialog rejects URLs outside its safe-scheme allowlist (`http`, `https`, `mailto`, `tel`, `ftp`, `ftps`, `sms`, `xmpp`, `cid`) at insert time. A path (`/contact`, `./x`, `?ref=1`) is stored as typed and `//host` becomes `https://host`; `link.relative-url` then flags the path.
- **`sanitizeHtml`** — the editor sanitizes `paragraph.content`, `title.content`, and custom-block canvas HTML with DOMPurify before live insertion. Custom blocks are sanitized after Liquid rendering on the canvas; their export HTML is unchanged. Raw HTML blocks remain in a script-disabled sandbox.

These boundaries drop disallowed values before inserting live HTML. `lintLinks` reports those values to the author so they can correct the JSON.

The two layers complement each other:

| Source of a `javascript:` link | `normalizeLinkUrl` | `sanitizeHtml` | `lintLinks` |
|---|---|---|---|
| User typing in the rich-text link dialog | ✅ blocks at insert | n/a (never reaches content) | n/a |
| Imported BeeFree / Unlayer / HTML / MJML / Topol / Stripo / Chamaileon / Easy Email Pro JSON | ❌ bypasses dialog | ✅ stripped at render | ✅ surfaces to author |
| Programmatic `setContent()` with bad anchor | ❌ | ✅ stripped at render | ✅ surfaces to author |
| `button.url`, `image.linkUrl`, `video.url`, `menu.items[].url`, `social.icons[].url` (structured fields, not HTML) | ❌ | ❌ sanitizer handles live rich text and custom-block canvas HTML, not structured fields | ✅ surfaces to author |

So `lintLinks` is the **only authoring-time signal** for unsafe URLs in structured fields, and the **only feedback channel** when a stripped value would otherwise vanish silently from rich-text imports.

## Shared URL scheme policy

`@templatical/types` exports the editor's isomorphic URL policy. `SAFE_LINK_SCHEMES` is the frozen array `['http', 'https', 'mailto', 'tel', 'ftp', 'ftps', 'sms', 'xmpp', 'cid']`; `DANGEROUS_SCRIPT_SCHEMES` is the frozen array `['javascript', 'data', 'vbscript']`.

| Export | Contract |
|---|---|
| `normalizeUrlForSchemeCheck(value: string): string` | Removes tab, LF and CR anywhere, then leading C0 controls and spaces and trailing whitespace before a scheme check. |
| `extractUrlScheme(value: string): string \| null` | Returns a lower-case scheme, or `null` for a relative or fragment URL. |
| `DATA_IMAGE_SRC_PATTERN` | Matches only `data:image/(png\|jpe?g\|gif\|webp\|svg+xml);` at the start of a value. |
| `isSafeHtmlUrl(value: string, attribute: string): boolean` | Allows relative and fragment URLs and the safe-link schemes. Image data is allowed only when `attribute` is `src`. It checks the scheme, not the full URL syntax. |

```ts
import { extractUrlScheme, isSafeHtmlUrl } from "@templatical/types";

console.log(extractUrlScheme("java\tscript:alert(1)")); // "javascript"
console.log(isSafeHtmlUrl("data:image/png;base64,AA", "src")); // true
console.log(isSafeHtmlUrl("data:image/png;base64,AA", "href")); // false
```

Check it: `pnpm --dir packages/types exec vitest run tests/url-policy.test.ts`. This policy governs the editor's live rich-text HTML, custom-block canvas HTML, and link dialog; it does not sanitize exported HTML blocks or replace the quality linter's email-client rules.

## API

```ts
import { lintLinks } from "@templatical/quality";

const issues = lintLinks(content); // options is an optional second argument
// issues: LintIssue[] — each entry has ruleId starting with "link."
```

Same signature as `lintAccessibility` and `lintStructure`. Same `LintOptions` shape. Same `LintIssue` return type. You can run all linters independently or merge results.

In the editor, the `useTemplateLint` composable lazy-imports `@templatical/quality` and runs every linter on every (debounced) content change. Link issues appear in the **Issues** sidebar tab alongside accessibility and structure issues.

## Configuration

`lintLinks` reads its config under `LintOptions.links`. Set `links: false` to disable the entire linter without enumerating rules.

```ts
interface LinksLintOptions {
  rules?: Record<string, Severity>;
  nonProductionHosts?: string[];
}
```

### `links.rules`

Per-rule severity override for link rules:

```ts
lintLinks(content, {
  links: { rules: { "link.localhost-or-staging": "error" } },
});
```

### `links.nonProductionHosts`

| Default | `['localhost', '127.0.0.1', '0.0.0.0', '*.local', '*.staging.*', '*.dev.*']` |
|---|---|

Glob-style patterns matched against the URL host. `*` matches any run of characters (including `.`) — so `*.staging.*` matches `app.staging.example.com` and `*.local` matches `acme.local` or `a.b.c.local`. Patterns are anchored, so `*.local` does NOT match `acme.local-tools`. Case-insensitive.

Pass an empty array to silence `link.localhost-or-staging` without disabling the rule outright:

```ts
lintLinks(content, {
  links: { nonProductionHosts: [] },
});
```

Or extend / replace with your own patterns:

```ts
lintLinks(content, {
  links: {
    nonProductionHosts: [
      "*.preview.*",       // catch a vendor preview host
      "*.internal.acme.io" // catch internal staging
    ],
  },
});
```

The `DEFAULT_NON_PRODUCTION_HOSTS` constant is exported if you need to reference the baseline programmatically.

## Quick links

- [Rule catalog](./rule-catalog) — every link rule with severity, scope, and rationale.
- [Options](../options) — shared across every linter.
- [Severity & fixes](../severity-and-fixes) — how severity overrides land and the fix-application model.
- [Headless usage](../headless-usage) — validating stored templates in CI.
- [Contributing locales](../contributing-locales) — adding link rule messages.
