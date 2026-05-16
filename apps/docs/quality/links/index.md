# Links linter

`lintLinks(content, options?)` is the URL-hygiene checker inside [`@templatical/quality`](../). It walks every URL in the template — anchors inside rich text, `button.url`, `image.linkUrl`, `video.url`, `menu.items[].url`, `social.icons[].url` — and flags URL-shaped data that's broken, dangerous, or accidentally pointing at the wrong environment.

## Why

Email URLs are a long-tail bug source:

- A `javascript:` href slips into a template from an import; the render-time sanitizer drops it for safety, but the author never finds out the link is broken until a recipient complains.
- A staging URL ships to production because nobody diffed the JSON before send.
- A malformed `mailto:` makes "Contact us" silently dead.
- A `tel:` with letters in it doesn't dial anywhere.
- A `data:` or app-deep-link `href` looks fine in JSON but no email client renders it.

These aren't content-quality issues (different audience from a11y) and they aren't tree-corruption issues (the JSON validates). They live in their own category.

## Interaction with editor security

The editor already ships two URL-scheme defenses:

- **`useRichTextLinkDialog.normalizeLinkUrl`** — the rich-text link dialog rejects URLs outside its safe-scheme allowlist (`http`, `https`, `mailto`, `tel`, `ftp`, `ftps`, `sms`, `xmpp`, `cid`) at insert time.
- **`sanitizeRichTextHtml`** — a render-time scrubber strips `javascript:` / `vbscript:` / `file:` (and other unsafe-scheme) `href` / `src` / `formaction` values from `paragraph.content` / `title.content` / `html.content` before they reach `v-html`.

Those are **security boundaries** — they prevent XSS by silently dropping dangerous values. `lintLinks` is an **authoring tool**: it surfaces the same values so the author can fix the JSON rather than have it stripped at render.

The two layers complement each other:

| Source of a `javascript:` link | `normalizeLinkUrl` | `sanitizeRichTextHtml` | `lintLinks` |
|---|---|---|---|
| User typing in the rich-text link dialog | ✅ blocks at insert | n/a (never reaches content) | n/a |
| Imported BeeFree / Unlayer / HTML JSON | ❌ bypasses dialog | ✅ stripped at render | ✅ surfaces to author |
| Programmatic `setContent()` with bad anchor | ❌ | ✅ stripped at render | ✅ surfaces to author |
| `button.url`, `image.linkUrl`, `video.url`, `menu.items[].url`, `social.icons[].url` (structured fields, not HTML) | ❌ | ❌ sanitizer only scans rich-text HTML | ✅ surfaces to author |

So `lintLinks` is the **only authoring-time signal** for unsafe URLs in structured fields, and the **only feedback channel** when a stripped value would otherwise vanish silently from rich-text imports.

## API

```ts
import { lintLinks } from "@templatical/quality";

const issues = lintLinks(content, options?);
// issues: LintIssue[] — each entry has ruleId starting with "link."
```

Same signature as `lintAccessibility` and `lintStructure`. Same `LintOptions` shape. Same `LintIssue` return type. You can run all three linters independently or merge results.

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
