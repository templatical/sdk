---
title: License
description: MIT-licensed.
---

# License

All Templatical packages are MIT-licensed. The terms are [`LICENSE`](https://github.com/templatical/sdk/blob/main/LICENSE).

## Packages

| Package | License |
|---|---|
| `@templatical/editor` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE) |
| `@templatical/core` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE) |
| `@templatical/media-library` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE) |
| `@templatical/types` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE) |
| `@templatical/renderer` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE) |
| `@templatical/quality` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE) |
| `@templatical/import-beefree` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE) |
| `@templatical/import-unlayer` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE) |
| `@templatical/import-html` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE) |
| `@templatical/import-mjml` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE) |
| `@templatical/import-topol` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE) |
| `@templatical/import-stripo` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE) |
| `@templatical/import-chamaileon` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE) |
| `@templatical/import-easy-email-pro` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE) |
| `@templatical/template-tools` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE) |
| `@templatical/ai-kit` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE) |

The Agent Skill (`skills/templatical`) is MIT as well.

## Earlier releases

Releases of `@templatical/editor`, `@templatical/core` and `@templatical/media-library` before 0.62.0 were published under FSL-1.1-MIT; each converts to MIT two years after its release.

## Open source

Yes. Every `@templatical/*` package and the Agent Skill are MIT-licensed open source.

## Cloud tier

**No.** The Cloud tier is optional. The SDK can run standalone; features that connect to your data use providers you implement.

Live collaboration runs over your own backend with `init({ collaboration })`. Templatical Cloud's hosted collaboration isn't in this SDK release. Cloud supplies hosted storage; its AI provider isn't in this SDK release. Comments, saved blocks, version history, test email, media and [AI](/backend/ai) use providers you implement on `init()`. Cloud is one adapter, not the feature.
