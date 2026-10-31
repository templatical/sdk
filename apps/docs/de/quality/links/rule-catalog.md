# Link-Regelkatalog

Die 6 Regeln, die `lintLinks` ausliefert. Jede Regel lebt in `packages/quality/src/links/rules/`; der Schweregrad ist über [Optionen](../options) pro Konsument überschreibbar. Alle Regeln scannen jede URL-Quelle, die `walkUrls` liefert — Anker in Rich-Text plus `button.url`, `image.linkUrl`, `video.url`, `menu.items[].url`, `social.icons[].url`.

## Gefährliche Protokolle

| Regel | Standard-Schweregrad | Auto-Fix | Was sie prüft |
|---|---|---|---|
| `link.javascript-protocol` | error | — | Href beginnt mit `javascript:` (oder Whitespace-/Case-Bypass-Varianten wie ` JaVaScRiPt:`). Der Editor entfernt diese Href-Werte aus Live-Rich-Text und gerendertem Custom-Block-HTML im Canvas über `sanitizeHtml`; der Rich-Text-Link-Dialog blockiert das Einfügen. Werte aus importiertem JSON, programmatischen API-Aufrufen oder strukturierten Feldern (`button.url`, `image.linkUrl`, `menu.items[].url`, `social.icons[].url`) können im Template verbleiben. Diese Regel meldet sie zur Authoring-Zeit, damit das JSON korrigiert werden kann. |

## Nicht unterstützte Protokolle

| Regel | Standard-Schweregrad | Auto-Fix | Was sie prüft |
|---|---|---|---|
| `link.unsupported-protocol` | warning | — | Href verwendet ein explizites Protokoll außer `http`, `https`, `mailto`, `tel` oder `sms`. Eigene Protokolle (`ftp:`, `file:`, `data:`, App-Deep-Links) funktionieren typischerweise nicht aus E-Mail-Clients und deuten entweder auf einen Copy-Paste-Fehler oder eine nicht unterstützte Integration hin. Relative URLs und reine Pfade werden hier ignoriert — die pfadförmigen deckt `link.relative-url` ab. `javascript:` ist ausgenommen — dafür gibt es eine eigene Regel. |

## Fehlerhafte URIs

| Regel | Standard-Schweregrad | Auto-Fix | Was sie prüft |
|---|---|---|---|
| `link.malformed-mailto` | warning | — | `mailto:`-Href ist leer, hat kein `@`, der Local- oder Domain-Teil fehlt oder die Domain hat keinen Punkt. Querystring-Fragmente (`?subject=…`, `?cc=…`, `?body=…`) werden akzeptiert. Mehrfach-Empfänger `mailto:a@x.com,b@y.com` werden akzeptiert. Pragmatisch — kein vollständiger RFC-Validator. |
| `link.malformed-tel` | warning | — | `tel:`-Href enthält Zeichen außerhalb von `+`, Ziffern, Leerzeichen, Bindestrichen, Klammern und Punkten. Die meisten Clients scheitern an fehlerhaften `tel:`-URIs lautlos (z. B. `tel:CALL-NOW`). |

## Umgebungs-Leaks

| Regel | Standard-Schweregrad | Auto-Fix | Was sie prüft |
|---|---|---|---|
| `link.localhost-or-staging` | warning | — | URL-Host matcht die konfigurierte Nicht-Produktions-Hostliste. Der Standard erfasst `localhost`, `127.0.0.1`, `0.0.0.0`, `*.local`, `*.staging.*`, `*.dev.*`. Konfigurierbar via `LintOptions.links.nonProductionHosts` — Standard-Erweiterungs- / Ersatz-Muster siehe [Übersicht](./). Feuert nur auf `http(s)`- und `ftp(s)`-URLs; mailto/tel/sms werden übersprungen. |

## Relative URLs

| Regel | Standard-Schweregrad | Auto-Fix | Was sie prüft |
|---|---|---|---|
| `link.relative-url` | warning | — | Href beginnt mit `/`, `./`, `../` oder `?` — eine wurzelrelative, relative, reine Query- oder protokollrelative (`//host`) URL. Eine versendete E-Mail hat keine Seitenadresse, gegen die sie aufgelöst werden kann, daher ist der Link im Postfach kaputt. Nur diese Präfixe zählen: Der Linter kennt keine Merge-Tag-Syntax, daher wird eine URL, die mit einem Tag beginnt (<code v-pre>{{ unsubscribe_url }}</code>), nicht gemeldet, ebenso wenig ein Host ohne Schema (`example.com/page`), ein reiner Pfad (`page.html`) oder ein `#anchor`. Der Rich-Text-Link-Dialog speichert einen solchen Pfad wie eingegeben und macht aus `//host` `https://host`. |

## Auto-Fixes

Jede Link-Regel ist destruktiv (Href entfernen / Protokoll ändern) und die richtige Antwort hängt vom Intent ab — `javascript:alert(1)` kann auf einem Button stehen, der gelöscht gehört, oder ein Tippfehler für `mailto:` sein. Reine Erkennung ist sicherer als Raten. Headless-Aufrufer können `LintIssue[]` nach `ruleId.startsWith("link.")` filtern und eigene Policy anwenden (Save blockieren, in Review-Queue schicken, …).
