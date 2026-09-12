---
name: templatical
description: >-
  Author Templatical email templates and integrate the Templatical email editor
  SDK. Use whenever the user wants to create, design, draft, mock up or edit a
  marketing, transactional or newsletter email — for example "make a
  product-launch email", "design a welcome email", "build an event invite",
  "draft an order-confirmation email", or "turn this copy into an email
  template" — even when they don't say "Templatical" or "JSON". Also use it for
  producing or editing Templatical template JSON that must validate against the
  block schema, for converting a template out of another email builder, and for
  opening a live preview in the real Templatical editor and updating it as the
  user prompts — triggered by intent such as "show it live", "preview it live",
  "open it in the editor" or "build this in live mode". Also covers the SDK
  itself (@templatical/editor): embedding, mounting, configuring, theming,
  extending or troubleshooting an integration, and answering "how do I" / "is
  it possible" questions about it.
user-invocable: true
argument-hint: "[build|edit|import|validate|export|live] [integrate|scaffold|diagnose|docs] [target]"
license: MIT
---

# Templatical

Author [Templatical](https://templatical.com) email templates and integrate the
`@templatical/editor` SDK that renders them, as one router over both jobs — an
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
| `diagnose` | Fix an integration that misbehaves | [reference/diagnose.md](reference/diagnose.md) |
| `docs` | Answer a question from the SDK reference | [reference/docs.md](reference/docs.md) |

Before acting, load the one playbook that owns the request — its row above for
an explicit or clearly implied mode, otherwise the default from the
discrimination. Load one, not several; each playbook names what it consults.

## Out of scope

- **Not a Cloud onboarding flow.** `initCloud()` and its provider contracts are
  covered; signing up, issuing keys and plan entitlements happen in Cloud's own
  dashboard.
- **Never touches git.** File changes are the user's to review and commit.
