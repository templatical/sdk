# Link-Regelkatalog

Die 5 Regeln, die `lintLinks` ausliefert. Jede Regel lebt in `packages/quality/src/links/rules/`; der Schweregrad ist über [Optionen](../options) pro Konsument überschreibbar. Alle Regeln scannen jede URL-Quelle, die `walkUrls` liefert — Anker in Rich-Text plus `button.url`, `image.linkUrl`, `video.url`, `menu.items[].url`, `social.icons[].url`.

## Gefährliche Protokolle

| Regel | Standard-Schweregrad | Auto-Fix | Was sie prüft |
|---|---|---|---|
| `link.javascript-protocol` | error | — | Href beginnt mit `javascript:` (oder Whitespace-/Case-Bypass-Varianten wie ` JaVaScRiPt:`). `sanitizeRichTextHtml` entfernt diese bereits beim Render aus Rich-Text-Inhalten, sodass sie nicht ausgeführt werden, und der Link-Dialog blockiert das Einfügen — aber Werte aus importiertem JSON, programmatischen API-Aufrufen oder strukturierten Feldern (`button.url`, `image.linkUrl`, `menu.items[].url`, `social.icons[].url`) liegen still im Template. Diese Regel macht sie zur Authoring-Zeit sichtbar, damit das JSON korrigiert wird und nicht nur der Render-Pfad. |

## Nicht unterstützte Protokolle

| Regel | Standard-Schweregrad | Auto-Fix | Was sie prüft |
|---|---|---|---|
| `link.unsupported-protocol` | warning | — | Href verwendet ein explizites Protokoll außer `http`, `https`, `mailto`, `tel` oder `sms`. Eigene Protokolle (`ftp:`, `file:`, `data:`, App-Deep-Links) funktionieren typischerweise nicht aus E-Mail-Clients und deuten entweder auf einen Copy-Paste-Fehler oder eine nicht unterstützte Integration hin. Relative URLs und reine Pfade werden ignoriert. `javascript:` ist ausgenommen — dafür gibt es eine eigene Regel. |

## Fehlerhafte URIs

| Regel | Standard-Schweregrad | Auto-Fix | Was sie prüft |
|---|---|---|---|
| `link.malformed-mailto` | warning | — | `mailto:`-Href ist leer, hat kein `@`, der Local- oder Domain-Teil fehlt oder die Domain hat keinen Punkt. Querystring-Fragmente (`?subject=…`, `?cc=…`, `?body=…`) werden akzeptiert. Mehrfach-Empfänger `mailto:a@x.com,b@y.com` werden akzeptiert. Pragmatisch — kein vollständiger RFC-Validator. |
| `link.malformed-tel` | warning | — | `tel:`-Href enthält Zeichen außerhalb von `+`, Ziffern, Leerzeichen, Bindestrichen, Klammern und Punkten. Die meisten Clients scheitern an fehlerhaften `tel:`-URIs lautlos (z. B. `tel:CALL-NOW`). |

## Umgebungs-Leaks

| Regel | Standard-Schweregrad | Auto-Fix | Was sie prüft |
|---|---|---|---|
| `link.localhost-or-staging` | warning | — | URL-Host matcht die konfigurierte Nicht-Produktions-Hostliste. Der Standard erfasst `localhost`, `127.0.0.1`, `0.0.0.0`, `*.local`, `*.staging.*`, `*.dev.*`. Konfigurierbar via `LintOptions.links.nonProductionHosts` — Standard-Erweiterungs- / Ersatz-Muster siehe [Übersicht](./). Feuert nur auf `http(s)`- und `ftp(s)`-URLs; mailto/tel/sms werden übersprungen. |

## Warum keine Auto-Fixes?

Jede Link-Regel ist destruktiv (Href entfernen / Protokoll ändern) und die richtige Antwort hängt vom Intent ab — `javascript:alert(1)` kann auf einem Button stehen, der gelöscht gehört, oder ein Tippfehler für `mailto:` sein. Reine Erkennung ist sicherer als Raten. Headless-Aufrufer können `LintIssue[]` nach `ruleId.startsWith("link.")` filtern und eigene Policy anwenden (Save blockieren, in Review-Queue schicken, …).
