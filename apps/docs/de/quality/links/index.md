# Links-Linter

`lintLinks(content, options?)` ist der URL-Hygiene-Checker in [`@templatical/quality`](../). Er durchläuft jede URL im Template — Anker in Rich-Text, `button.url`, `image.linkUrl`, `video.url`, `menu.items[].url`, `social.icons[].url` — und meldet URL-förmige Daten, die kaputt, gefährlich oder versehentlich auf die falsche Umgebung gerichtet sind.

## Warum

E-Mail-URLs sind eine Langschwanz-Fehlerquelle:

- Ein `javascript:`-Href schleicht sich aus einem Import in ein Template; der Render-Sanitizer entfernt ihn aus Sicherheitsgründen, aber der Autor erfährt nie, dass der Link kaputt ist.
- Eine Staging-URL geht in Produktion, weil niemand das JSON vor dem Versand diff't.
- Ein fehlerhafter `mailto:` macht „Contact us" stillschweigend tot.
- Ein `tel:` mit Buchstaben drin wählt nirgendwohin.
- Ein `data:` oder App-Deep-Link sieht im JSON in Ordnung aus, aber kein E-Mail-Client rendert ihn.

Das sind keine Inhalts-Qualitätsprobleme (andere Zielgruppe als a11y) und keine Baum-Korruptions-Probleme (das JSON validiert). Sie bilden ihre eigene Kategorie.

## Wechselwirkung mit Editor-Sicherheit

Der Editor liefert bereits zwei URL-Schema-Verteidigungen:

- **`useRichTextLinkDialog.normalizeLinkUrl`** — der Rich-Text-Link-Dialog weist URLs außerhalb seiner Safe-Scheme-Allowlist (`http`, `https`, `mailto`, `tel`, `ftp`, `ftps`, `sms`, `xmpp`, `cid`) beim Einfügen zurück.
- **`sanitizeRichTextHtml`** — ein Render-Scrubber entfernt `javascript:` / `vbscript:` / `file:` (und weitere unsichere) `href` / `src` / `formaction`-Werte aus `paragraph.content` / `title.content` / `html.content`, bevor sie `v-html` erreichen.

Das sind **Sicherheitsgrenzen** — sie verhindern XSS, indem sie gefährliche Werte stillschweigend entfernen. `lintLinks` ist ein **Authoring-Werkzeug**: es macht dieselben Werte sichtbar, damit der Autor das JSON korrigieren kann statt nur den Render-Pfad zu reparieren.

Die zwei Ebenen ergänzen sich:

| Quelle eines `javascript:`-Links | `normalizeLinkUrl` | `sanitizeRichTextHtml` | `lintLinks` |
|---|---|---|---|
| Nutzer tippt im Rich-Text-Link-Dialog | ✅ beim Einfügen blockiert | n/a (erreicht den Inhalt nie) | n/a |
| Importiertes BeeFree- / Unlayer- / HTML-JSON | ❌ umgeht den Dialog | ✅ beim Rendern entfernt | ✅ zeigt dem Autor an |
| Programmatisches `setContent()` mit fehlerhaftem Anker | ❌ | ✅ beim Rendern entfernt | ✅ zeigt dem Autor an |
| `button.url`, `image.linkUrl`, `video.url`, `menu.items[].url`, `social.icons[].url` (strukturierte Felder, kein HTML) | ❌ | ❌ Sanitizer scannt nur Rich-Text-HTML | ✅ zeigt dem Autor an |

`lintLinks` ist also das **einzige Authoring-Signal** für unsichere URLs in strukturierten Feldern und der **einzige Feedback-Kanal**, wenn ein entfernter Wert sonst lautlos aus Rich-Text-Importen verschwinden würde.

## API

```ts
import { lintLinks } from "@templatical/quality";

const issues = lintLinks(content, options?);
// issues: LintIssue[] — jeder Eintrag hat eine ruleId, die mit "link." beginnt
```

Gleiche Signatur wie `lintAccessibility` und `lintStructure`. Gleiche `LintOptions`-Struktur. Gleicher `LintIssue`-Rückgabewert. Sie können alle drei Linter unabhängig aufrufen oder Ergebnisse zusammenführen.

Im Editor lädt das `useTemplateLint`-Composable `@templatical/quality` per dynamischem Import und führt jeden Linter bei jeder (entprellten) Inhaltsänderung aus. Link-Issues erscheinen im **Issues**-Sidebar-Tab neben Barrierefreiheits- und Struktur-Issues.

## Konfiguration

`lintLinks` liest seine Konfiguration unter `LintOptions.links`. Setzen Sie `links: false`, um den gesamten Linter zu deaktivieren, ohne Regeln einzeln aufzählen zu müssen.

```ts
interface LinksLintOptions {
  rules?: Record<string, Severity>;
  nonProductionHosts?: string[];
}
```

### `links.rules`

Schweregrad-Override pro Regel für Link-Regeln:

```ts
lintLinks(content, {
  links: { rules: { "link.localhost-or-staging": "error" } },
});
```

### `links.nonProductionHosts`

| Standard | `['localhost', '127.0.0.1', '0.0.0.0', '*.local', '*.staging.*', '*.dev.*']` |
|---|---|

Glob-Muster, die gegen den URL-Host abgeglichen werden. `*` matcht eine beliebige Zeichenfolge (auch über `.` hinweg) — `*.staging.*` matcht also `app.staging.example.com` und `*.local` matcht `acme.local` oder `a.b.c.local`. Muster sind verankert; `*.local` matcht damit NICHT `acme.local-tools`. Groß-/Kleinschreibung wird ignoriert.

Übergeben Sie ein leeres Array, um `link.localhost-or-staging` stumm zu schalten, ohne die Regel komplett zu deaktivieren:

```ts
lintLinks(content, {
  links: { nonProductionHosts: [] },
});
```

Oder erweitern / ersetzen Sie mit eigenen Mustern:

```ts
lintLinks(content, {
  links: {
    nonProductionHosts: [
      "*.preview.*",       // erfasst einen Vendor-Preview-Host
      "*.internal.acme.io" // erfasst internes Staging
    ],
  },
});
```

Die Konstante `DEFAULT_NON_PRODUCTION_HOSTS` wird exportiert, falls Sie den Standard programmatisch referenzieren müssen.

## Schnellzugriff

- [Regelkatalog](./rule-catalog) — jede Link-Regel mit Schweregrad, Scope und Begründung.
- [Optionen](../options) — geteilt über alle Linter.
- [Schweregrade & Fixes](../severity-and-fixes) — wie Schweregrad-Overrides landen und das Fix-Modell.
- [Headless-Nutzung](../headless-usage) — Validierung gespeicherter Templates in CI.
- [Beiträge zu Locales](../contributing-locales) — Link-Regelnachrichten hinzufügen.
