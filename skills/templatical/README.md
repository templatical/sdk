# @templatical/skill

One [Agent Skill](https://agentskills.io), free and open-source, that runs
entirely in your own coding agent — no backend, no API key, your agent is
the inference. It authors [Templatical](https://templatical.com) email
templates and helps you integrate
[`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor)
into an application. Ask for an email and it writes, edits, imports,
validates or previews a template; ask about the SDK and it installs, mounts,
scaffolds or diagnoses an integration. One skill, and it decides for itself
which job a request needs.

## Install

```
npx skills add templatical/sdk
```

This is the only documented way to install the skill. To update:

```
npx skills update templatical
```

## What it can do

- **Build** — write a template from a brief: "make a product-launch email",
  "design a welcome email".
- **Edit** — change a template that already exists, as a scoped edit rather
  than a rewrite.
- **Import** — convert a template from almost anywhere. Dedicated converters
  handle Unlayer, BeeFree, Stripo, Topol, Chamaileon, Easy Email Pro, MJML and
  HTML; for anything else, it reads the source and maps it onto the block
  schema by hand — a WordPress block template, a Mailchimp or Klaviyo export,
  even a screenshot of an email.
- **Validate** — check a template's JSON against the block schema and get
  back precise, per-block errors.
- **Export** — render a template as sendable MJML or HTML.
- **Live** — preview and hand-edit the template in the real Templatical
  editor in your browser, kept in sync as you keep prompting.
- **Integrate** — mount the editor in an application: detect the stack,
  propose the change, and wait before writing anything.
- **Scaffold** — write a proposed integration into your repository,
  installed with your own package manager and checked against your running
  dev server.
- **Diagnose** — fix an integration that misbehaves, checked against a table
  of verified traps.
- **Docs** — answer a question about the SDK from the reference
  documentation.

## Good to know

### Bring your own branding

Layer your own context on top and the agent uses it instead of generic
defaults — brand colors and fonts, tone of voice, a house system prompt, a
mandatory footer or unsubscribe block. Worth doing once if you plan to
generate more than one email.

### Custom blocks are never generated from a prompt

This is the one exception. Custom blocks are consumer-registered runtime
extensions — the skill has no way to know what one does, so it never
invents one from a prompt. See
[Custom Blocks](https://docs.templatical.com/guide/custom-blocks) for how to
register your own.

### How it fits alongside the SDK

The skill is a build-time tool: it authors templates and helps you wire up
an integration. Your runtime is
[`@templatical/editor`](https://docs.templatical.com/getting-started/quick-start)
— your users build emails, you get JSON out — plus
[`@templatical/renderer`](https://docs.templatical.com/api/renderer-typescript),
which turns that JSON into MJML or HTML to send.

## License

MIT.
