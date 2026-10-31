---
name: templatical
description: >-
  Author Templatical email templates and integrate the Templatical email editor
  SDK. Use whenever the user wants to create, design, draft or edit a
  marketing, transactional or newsletter email — for example "make a
  product-launch email", "design a welcome email" or "turn this copy into an
  email template" — even when they don't say "Templatical" or "JSON". Also use
  it for template JSON that must validate against the block schema, for
  converting a template out of another email builder, and for a live preview
  in the real editor that updates as the user prompts ("show it live",
  "preview it live", "open it in the editor"). Also covers the SDK itself
  (@templatical/editor): embedding, configuring, theming, extending,
  troubleshooting or upgrading an integration, defining or changing a custom
  block type (fields + Liquid template, optionally filled from the user's own
  API), and "how do I" / "is it possible" questions about it.
user-invocable: true
argument-hint: "[build|edit|import|validate|export|live] [integrate|scaffold|custom-block|diagnose|upgrade|docs] [target]"
license: MIT
---

# Templatical

Author [Templatical](https://templatical.com) email templates and integrate the
`@templatical/editor` SDK that renders them, as one router over both jobs. An
authoring session often ends by wiring its result into an application.

> Is the request about **a template** — its content, design, correctness or
> output — or about **the SDK** — installing, mounting, configuring or debugging
> the editor in code?
>
> Unmatched on the template side → `build`. Unmatched on the SDK side → `docs`.

Before the first command of a session, load
[reference/cli.md](reference/cli.md). It carries the invocation and the
exit-code contract, and no other playbook repeats them.

[reference/talking.md](reference/talking.md) governs how you report back,
whichever playbook ran.

| Mode | For | Playbook |
|---|---|---|
| `build` | Write a template from a brief | [reference/build.md](reference/build.md) |
| `edit` | Change a template that already exists | [reference/edit.md](reference/edit.md) |
| `import` | Convert from another editor | [reference/import.md](reference/import.md) |
| `validate` | Check a template and read the result | [reference/validate.md](reference/validate.md) |
| `export` | Render MJML or HTML | [reference/export.md](reference/export.md) |
| `live` | Preview and co-edit in the browser | [reference/live.md](reference/live.md) |
| `integrate` | Mount the editor in an application | [reference/integrate.md](reference/integrate.md) |
| `scaffold` | Write the integration into their repository | [reference/scaffold.md](reference/scaffold.md) |
| `custom-block` | Define a custom block type, or change one | [reference/custom-block.md](reference/custom-block.md) |
| `diagnose` | Fix an integration that misbehaves | [reference/diagnose.md](reference/diagnose.md) |
| `upgrade` | Move an integration to a newer release, breaking changes included | [reference/upgrade.md](reference/upgrade.md) |
| `docs` | Answer a question from the SDK reference | [reference/docs.md](reference/docs.md) |

For language versions of one template, consult [reference/localize.md](reference/localize.md): adding languages, writing text and overrides, locale-aware collaboration, validation and rendering. This applies to template authoring and SDK localization questions.

Before acting, load the one playbook that owns the request — its row above for
an explicit or clearly implied mode, otherwise the default from the
discrimination. Load one, not several; each playbook names what it consults.

Custom-block templates HTML-escape `{{ }}`, `{% echo %}`, `{% liquid %}` echo and `{% cycle %}` output by default. Use
`{{ body | raw }}` for a field intended to hold HTML, always quote attribute
values, and validate URL schemes from untrusted sources. The editor canvas
also sanitizes the result; email output keeps the template's HTML. Follow
[reference/custom-block.md](reference/custom-block.md) for the resolver options.

## Out of scope

- **Not a Cloud onboarding flow.** `initCloud()` and its provider contracts are
  covered; signing up, issuing keys and plan entitlements happen in Cloud's own
  dashboard.
- **Never touches git.** File changes are the user's to review and commit.
