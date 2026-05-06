---
title: License FAQ
description: Plain-English answers about Templatical's FSL-1.1-MIT and MIT licenses — what's allowed, what isn't, when FSL becomes MIT.
---

# License FAQ

This page answers the questions teams ask most often when evaluating Templatical's license. It's intentionally plain-English; if you need formal terms, the authoritative documents are [`LICENSE`](https://github.com/templatical/sdk/blob/main/LICENSE) (FSL-1.1-MIT) and [`LICENSE-MIT`](https://github.com/templatical/sdk/blob/main/LICENSE-MIT) (MIT).

## TL;DR

- **You can use Templatical for free in any commercial product**, including paid SaaS, internal tools, and on-premise installs.
- **The only thing you can't do** is repackage Templatical itself as a competing email-editor SaaS.
- **After two years**, every release of FSL-licensed code automatically becomes MIT. No action required.
- **Four of the seven packages are pure MIT today** — types, renderer, and the BeeFree and Unlayer importers.

## What is FSL-1.1-MIT?

FSL stands for [**Functional Source License**](https://fsl.software/). It's a modern open-source license designed by Sentry to balance two things teams care about:

- **Freedom** — the code is open, you can read it, fork it, modify it, and redistribute it.
- **Sustainability** — the maintainer can build a viable business around it without an Amazon-sized cloud provider repackaging the project as a managed service.

FSL-1.1-**MIT** is the variant that automatically converts to the MIT License after two years. So Templatical is open-source today with a single narrow restriction, and fully MIT-licensed open-source after the change date.

## Which packages use which license?

| Package | License |
|---|---|
| `@templatical/editor` | [FSL-1.1-MIT](https://github.com/templatical/sdk/blob/main/LICENSE) (becomes MIT after 2 years) |
| `@templatical/core` | [FSL-1.1-MIT](https://github.com/templatical/sdk/blob/main/LICENSE) (becomes MIT after 2 years) |
| `@templatical/media-library` | [FSL-1.1-MIT](https://github.com/templatical/sdk/blob/main/LICENSE) (becomes MIT after 2 years) |
| `@templatical/types` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE-MIT) |
| `@templatical/renderer` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE-MIT) |
| `@templatical/import-beefree` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE-MIT) |
| `@templatical/import-unlayer` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE-MIT) |

The split exists so anything you'd build into your own backend or codegen pipeline (types, renderer, importer) is permissive MIT and free of any future-license consideration.

## Can I use Templatical commercially?

**Yes.** You can embed Templatical in any commercial product — paid SaaS, internal tools, on-premise software, agency builds, anything — without paying us and without asking permission.

The only restriction is the one in the LICENSE: you can't take Templatical, slap a different name on it, and offer *that* as a hosted email-editor service that competes with us.

## Can I embed Templatical in my SaaS?

**Yes.** This is the most common use case and it's fully permitted.

Concretely allowed:

- ✅ Embedding the editor in your CRM, marketing automation, transactional email tool, newsletter platform, or any product where email composition is one feature among many.
- ✅ Charging your customers for using your product, including the embedded editor as part of it.
- ✅ Customizing the editor with your brand, theme, custom blocks, and Cloud features.
- ✅ Using it inside an internal tool that never ships to external customers.

Concretely not allowed:

- ❌ Building a product whose primary purpose is "Templatical, hosted by you", competing with our managed Cloud tier.
- ❌ Forking Templatical and offering the fork as a drop-in commercial replacement for Templatical itself.

If you're not sure whether your use case crosses the line, [open a discussion](https://github.com/templatical/sdk/discussions) or email <licensing@templatical.com>. We'd rather give you a clear answer up front than have ambiguity.

## What does "competing use" mean concretely?

A "competing use" is one where the email editor *is* the product. Some worked examples:

| Use case | Allowed? |
|---|---|
| You add Templatical to your CRM so users can compose campaign emails | ✅ Yes — email editor is a feature of your CRM. |
| You add Templatical to a transactional email API so customers design templates before sending via your API | ✅ Yes — email editor is a feature of your sending platform. |
| You build a newsletter SaaS where Templatical is one of several composition tools | ✅ Yes — email editor is a feature of your newsletter product. |
| You embed the editor inside your company's internal marketing portal | ✅ Yes — internal use is unrestricted. |
| You fork Templatical, rebrand it, and sell hosted Templatical-clone subscriptions | ❌ No — that's a competing managed service. |
| You build "Templatical Cloud, but cheaper" and offer it as a SaaS | ❌ No — that's a competing managed service. |

The rule of thumb: if you remove Templatical from your product, do you still have a product? If yes, you're fine.

## When does FSL code become MIT?

**Two years after each release.** Every FSL-licensed release of `@templatical/editor`, `@templatical/core`, and `@templatical/media-library` automatically converts to the MIT License two years from the date that specific version was published.

That means if a stable version of Templatical 1.0 is released in 2026, that exact version becomes MIT-licensed in 2028 — automatically, with no action required from anyone. Newer releases inherit a fresh two-year clock.

In practice, this means you always have a fully MIT-licensed version of the codebase available, just one that's two years behind the latest release.

## Why not pure MIT from the start?

Templatical is built and maintained primarily by one developer. Pure MIT means a well-funded competitor could take Templatical, host it as a managed service tomorrow, and undercut the project's ability to fund its own development — without contributing anything back.

FSL-1.1-MIT keeps the code open and forkable for everyone with legitimate use cases (which is essentially everyone reading this), while preventing exactly the parasitic-managed-service scenario. After two years, that restriction lifts automatically and the code is fully MIT.

The same approach is used by [Sentry](https://sentry.io), [PowerSync](https://www.powersync.com), [GitButler](https://gitbutler.com), and others who want sustainable open source without going proprietary.

## Can I contribute to Templatical?

**Yes, please.** Open-source contributions are welcome — bug fixes, features, docs improvements, additional locales, and custom block examples are all appreciated.

By contributing, you agree your contribution is licensed under the same license as the package you're contributing to (MIT for `types`, `renderer`, `import-beefree`, `import-unlayer`; FSL-1.1-MIT for `editor`, `core`, `media-library`).

There is currently **no separate Contributor License Agreement (CLA)** to sign — your PR alone is enough.

See [`CONTRIBUTING.md`](https://github.com/templatical/sdk/blob/main/CONTRIBUTING.md) for the full contribution guide.

## Do I need to display attribution?

**Yes, for redistributed code.** If you redistribute Templatical's source or build artifacts, you must keep the license notice. This is the same as any standard open-source license.

You do **not** need to display "Powered by Templatical" or any user-visible credit in the email editor itself. The license does not require attribution in the editor UI.

By default, the editor renders a small "Powered by Templatical" footer in the canvas. You can hide it by passing `branding: false` to `init()`:

```ts
await init({
  container: "#editor",
  branding: false, // hides the footer
});
```

There is no header logo or other forced branding — the footer is the only attribution surface, and it's opt-out.

## Is using the Cloud tier required?

**No.** The Cloud tier is optional. The OSS SDK works completely standalone — every feature in `@templatical/editor` (the OSS init path) runs without any backend.

The Cloud tier adds AI rewrite, real-time collaboration, comments, snapshots, and saved modules. It is in development and will be available as a managed service.

## What if I have a question this doesn't answer?

For licensing questions, email <licensing@templatical.com>. For everything else, [open a discussion](https://github.com/templatical/sdk/discussions) or [file an issue](https://github.com/templatical/sdk/issues).

If you spot something unclear or missing in this FAQ, please tell us — clarity benefits everyone.
