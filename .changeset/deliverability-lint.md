---
"@templatical/quality": minor
---

`lintTemplate` now runs the `deliverability` category by default. Agents can use `lintDeliverability`, `DELIVERABILITY_RULES`, localized messages, `DEFAULT_SHORTENER_HOSTS`, and `DEFAULT_DELIVERABILITY_THRESHOLDS` directly. The category flags `deliverability.link-text-domain-mismatch` (`warning`), `deliverability.url-shortener` (`warning`), `deliverability.ip-address-url` (`warning`), and `deliverability.low-text` (`info`). Each rule reports a JSON-detectable content cue; none auto-fixes or scores a template.

These rules flag content patterns that spam filters and mailbox-provider guidelines name. They don't predict inbox placement: sender reputation, authentication and recipient engagement decide that.

Configuration using `{ accessibility: false, structure: false, links: false }` no longer disables linting because deliverability still runs. Add `deliverability: false` or use `disabled: true`. Likewise, `{ structure: false, links: false }` now runs accessibility and deliverability; add `deliverability: false` to keep accessibility only.
