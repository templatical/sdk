---
description: lintDeliverability flags mismatched link text, URL shorteners, raw IP links, and image-led emails with little visible text in template JSON.
---

# Deliverability linter

`lintDeliverability(content, options?)` checks template JSON for mismatched link text, URL shorteners, raw IP links, and image-led emails with little visible text.

These rules flag content patterns that spam filters and mailbox-provider guidelines name. They don't predict inbox placement: sender reputation, authentication and recipient engagement decide that.

## API

```ts
import { lintDeliverability } from "@templatical/quality";

const issues = lintDeliverability(content);
// LintIssue[] with deliverability.* rule IDs
```

`lintTemplate(content, options?)` also runs these rules by default, after accessibility, structure and links. `link-text-domain-mismatch`, `url-shortener`, and `ip-address-url` default to `warning`; `low-text` defaults to `info`. None has an auto-fix. The [rule catalog](./rule-catalog) gives each trigger and source.

## Options

Set `deliverability: false` to disable the category. `DeliverabilityLintOptions` accepts `rules?: RuleOverrides`, `thresholds?: Partial<DeliverabilityThresholds>`, and `shortenerHosts?: string[]`.

| Option | Default | Effect |
|---|---|---|
| `thresholds.minTextLength` | `200` | `deliverability.low-text` fires below this visible-character count when an image-producing block is present. |
| `shortenerHosts` | `DEFAULT_SHORTENER_HOSTS` | Replaces the host list used by `deliverability.url-shortener`. |

```ts
import { DEFAULT_SHORTENER_HOSTS, lintDeliverability } from "@templatical/quality";

const issues = lintDeliverability(content, {
  deliverability: {
    thresholds: { minTextLength: 250 },
    shortenerHosts: [...DEFAULT_SHORTENER_HOSTS, "go.example.com"],
  },
});
```

A rule override such as `{ rules: { "deliverability.low-text": "off" } }` changes one rule without disabling the category. See [Options](../options) for the full `LintOptions` contract.

## Limits

The linter reads template JSON, not the sent message. It cannot predict inbox placement or inspect sender reputation, authentication, recipient engagement, unsubscribe headers or an ESP footer. It cannot inspect client compatibility, Gmail clipping, or rendered HTML size. A sending service can rewrite an href for click tracking after this check. A `custom` block suppresses `low-text` because its rendered HTML is absent from the JSON.

## Check it

Save this valid template as `template.json`:

```json
{"blocks":[{"id":"button_1","type":"button","text":"Open the report","url":"https://bit.ly/x","backgroundColor":"#1d4ed8","textColor":"#ffffff","borderRadius":6,"fontSize":16,"buttonPadding":{"top":14,"right":28,"bottom":14,"left":28},"align":"center","styles":{"padding":{"top":0,"right":0,"bottom":0,"left":0}}}],"settings":{"width":600,"backgroundColor":"#ffffff","textColor":"#111111","fontFamily":"Arial, sans-serif","linkUnderline":true,"locale":"en"}}
```

```bash
npx @templatical/template-tools validate template.json --json
```

The built CLI returns exit code `0`. Its JSON output includes this issue (produced from the template above):

```json
{"blockId":"button_1","ruleId":"deliverability.url-shortener","severity":"warning","message":"This link goes through the URL shortener bit.ly. Spam filters treat shortener links with suspicion because they hide the destination.","suggestion":"Link to the destination instead.","reference":"https://docs.rspamd.com/modules/phishing/"}
```

For pass-through HTML and CSS support, see the [compatibility linter](../compatibility/).
