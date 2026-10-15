---
"@templatical/template-tools": patch
---

The `SectionWrapper` description in `schema.json` no longer calls the wrapper a full-width band

The wrapper renders as an `mj-wrapper` without MJML's `full-width` attribute, so its band is as wide as the email body (`settings.width`), not the recipient's viewport. The description in the published schema now says so.
