---
description: lintDeliverability meldet abweichende Linktexte, URL-Kürzer, rohe IP-Links und bildlastige E-Mails mit wenig sichtbarem Text im Template-JSON.
---

# Zustellbarkeits-Linter

`lintDeliverability(content, options?)` prüft Template-JSON auf abweichende Linktexte, URL-Kürzer, rohe IP-Links und bildlastige E-Mails mit wenig sichtbarem Text.

Diese Regeln melden Inhaltsmuster, die Spamfilter und Richtlinien von Postfachanbietern benennen. Sie sagen keine Postfachplatzierung voraus: Absenderreputation, Authentifizierung und Empfängerreaktionen entscheiden darüber.

## API

```ts
import { lintDeliverability } from "@templatical/quality";

const issues = lintDeliverability(content);
// LintIssue[] with deliverability.* rule IDs
```

`lintTemplate(content, options?)` führt diese Regeln ebenfalls standardmäßig aus, nach Barrierefreiheit, Struktur und Links. `link-text-domain-mismatch`, `url-shortener` und `ip-address-url` haben standardmäßig `warning`; `low-text` hat `info`. Keine Regel hat einen Auto-Fix. Der [Regelkatalog](./rule-catalog) nennt Auslöser und Quellen.

## Optionen

Mit `deliverability: false` deaktivieren Sie die Kategorie. `DeliverabilityLintOptions` akzeptiert `rules?: RuleOverrides`, `thresholds?: Partial<DeliverabilityThresholds>` und `shortenerHosts?: string[]`.

| Option | Standard | Wirkung |
|---|---|---|
| `thresholds.minTextLength` | `200` | `deliverability.low-text` meldet bei einem bilderzeugenden Block weniger sichtbare Zeichen als diesen Wert. |
| `shortenerHosts` | `DEFAULT_SHORTENER_HOSTS` | Ersetzt die Hostliste für `deliverability.url-shortener`. |

```ts
import { DEFAULT_SHORTENER_HOSTS, lintDeliverability } from "@templatical/quality";

const issues = lintDeliverability(content, {
  deliverability: {
    thresholds: { minTextLength: 250 },
    shortenerHosts: [...DEFAULT_SHORTENER_HOSTS, "go.example.com"],
  },
});
```

Ein Regel-Override wie `{ rules: { "deliverability.low-text": "off" } }` ändert eine einzelne Regel. Den vollständigen `LintOptions`-Vertrag finden Sie unter [Optionen](../options).

## Grenzen

Der Linter liest Template-JSON, nicht die versendete Nachricht. Er kann die Postfachplatzierung nicht vorhersagen und weder Absenderreputation, Authentifizierung, Empfängerreaktionen, Abmelde-Header noch ESP-Footer prüfen. Er prüft keine Client-Kompatibilität, Gmail-Clipping oder die Größe des gerenderten HTML. Ein Versanddienst kann ein href nach dieser Prüfung für Klick-Tracking umschreiben. Ein `custom`-Block unterdrückt `low-text`, weil sein gerendertes HTML im JSON fehlt.

## Prüfen

Speichern Sie dieses gültige Template als `template.json`:

```json
{"blocks":[{"id":"button_1","type":"button","text":"Open the report","url":"https://bit.ly/x","backgroundColor":"#1d4ed8","textColor":"#ffffff","borderRadius":6,"fontSize":16,"buttonPadding":{"top":14,"right":28,"bottom":14,"left":28},"align":"center","styles":{"padding":{"top":0,"right":0,"bottom":0,"left":0}}}],"settings":{"width":600,"backgroundColor":"#ffffff","textColor":"#111111","fontFamily":"Arial, sans-serif","linkUnderline":true,"locale":"en"}}
```

```bash
npx @templatical/template-tools validate template.json --json
```

Die gebaute CLI liefert Exit-Code `0`. Ihre JSON-Ausgabe enthält dieses Issue (aus dem Template oben):

```json
{"blockId":"button_1","ruleId":"deliverability.url-shortener","severity":"warning","message":"This link goes through the URL shortener bit.ly. Spam filters treat shortener links with suspicion because they hide the destination.","suggestion":"Link to the destination instead.","reference":"https://docs.rspamd.com/modules/phishing/"}
```

Für Client-Unterstützung von durchgereichtem HTML und CSS siehe den [Kompatibilitäts-Linter](../compatibility/).
