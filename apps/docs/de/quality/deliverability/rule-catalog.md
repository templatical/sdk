---
description: Der Zustellbarkeits-Regelkatalog nennt JSON-Prüfungen für abweichende Linktexte, URL-Kürzer, rohe IP-Links und wenig Text mit Schweregraden, Ausnahmen und Quellen.
---

# Zustellbarkeits-Regelkatalog

Dieser Katalog nennt Auslöser, Ausnahmen und Gründe für `deliverability.link-text-domain-mismatch`, `deliverability.url-shortener`, `deliverability.ip-address-url` und `deliverability.low-text`. Die Regeln sind Hinweise und haben keine Auto-Fixes. Unter [Optionen](../options) kannst du den Schweregrad ändern oder die Kategorie deaktivieren.

## `deliverability.link-text-domain-mismatch`

**Standardschweregrad:** `warning`.

**Was auslöst:** Ein Anker, Button oder Menüeintrag zeigt als gesamten Text eine URL oder einen Hostnamen, deren Website vom HTTP(S)-Ziel abweicht. `example.co.uk` mit Ziel `evil.co.uk` wird gemeldet. Subdomains derselben registrierbaren Domain bestehen; eine explizite Liste mehrteiliger Suffixe verhindert, dass `co.uk` als Website gilt.

**Was nicht auslöst:** Ein passender Adresstext, ein Satz mit Domain, Alt-Text eines Bild-Links, andere Protokolle und Hosts mit Merge-Tags. Ein Kopierlink mit identischem Text und href besteht. ESP-Klick-Tracking kann das href nach dem Versand umschreiben; diese JSON-Prüfung sieht das nicht.

**Warum es gemeldet wird:** Das Phishing-Modul von Rspamd vergleicht sichtbaren URL-Text mit dem Ziel und setzt bei Abweichung `PHISHED_URL`. [Googles Absenderrichtlinien](https://support.google.com/a/answer/81126) verlangen sichtbare und verständliche Links im Nachrichtentext. [Rspamd-Phishing-Modul](https://docs.rspamd.com/modules/phishing/).

## `deliverability.url-shortener`

**Standardschweregrad:** `warning`.

**Was auslöst:** Jede URL mit einem konfigurierten Kürzer-Host oder einer Subdomain, darunter `bit.ly`, `www.bit.ly` und `sub.bit.ly`. `shortenerHosts` ersetzt die Standardliste; mit `DEFAULT_SHORTENER_HOSTS` kannst du sie erweitern.

**Was nicht auslöst:** Andere Hosts wie `notbit.ly`, andere Protokolle und ein Standardhost, der aus einer Ersatzliste entfernt wurde. Die Regel folgt keinen Redirects und beurteilt das Ziel nicht.

**Warum es gemeldet wird:** Gekürzte URLs verbergen das Klickziel; Kürzer-Domains können auf URL-Blocklisten stehen. Die [Rspamd-Phishing-Beispiele](https://docs.rspamd.com/modules/phishing/) enthalten einen `t.co`-Redirect mit sichtbarem Text für eine andere Website. Googles Absenderrichtlinien verbieten URL-Kürzer nicht ausdrücklich.

## `deliverability.ip-address-url`

**Standardschweregrad:** `warning`.

**Was auslöst:** Eine HTTP(S)-URL mit IPv4- oder IPv6-Host, auch private IPs und rein numerische IPv4-Formen, die `URL` normalisiert.

**Was nicht auslöst:** `127.0.0.0/8`, `0.0.0.0` und `[::1]` (durch `link.localhost-or-staging` abgedeckt), Domains, andere Protokolle und nicht parsbare URLs.

**Warum es gemeldet wird:** SpamAssassin führt die URI-Tests `NORMAL_HTTP_TO_IP` und `NUMERIC_HTTP_ADDR` für IP-Links. [SpamAssassin-URI-Regeln](https://svn.apache.org/repos/asf/spamassassin/branches/b2_4_0/rules/20_uri_tests.cf).

## `deliverability.low-text`

**Standardschweregrad:** `info`.

**Was auslöst:** Ein Template enthält ein Bild mit nicht leerem `src`, ein Video oder einen Countdown und weniger als `thresholds.minTextLength` sichtbare Textzeichen (standardmäßig `200`). Der Text stammt aus Titel-, Absatz-, HTML- und Tabellenzellen-Inhalt sowie Button- und Menütext, auch in verschachtelten Sektionen. Merge-Tags zählen wie geschrieben.

**Was nicht auslöst:** Templates ohne bilderzeugende Blöcke, Templates ab dem Grenzwert und Templates mit einem `custom`-Block: Dessen HTML fehlt im JSON. Die Regel wertet Anzeige-Bedingungen und Sichtbarkeit je Viewport nicht aus.

**Warum es gemeldet wird:** SpamAssassin hat die Textbyte-Bänder `HTML_IMAGE_ONLY_*` und die Regeln `HTML_IMAGE_RATIO_*`. Die Grenze von 200 Zeichen ist ein vorsichtiger Inhaltshinweis, keine Umrechnung der Byte-Grenzen. Wer Bilder blockiert, sieht sonst wenig Inhalt. Microsoft 365 nutzt SpamAssassin nicht; diese Evidenz betrifft vor allem regelbasierte Filter wie Firmengateways und kleinere ISPs. [SpamAssassin-HTML-Regeln](https://svn.apache.org/repos/asf/spamassassin/branches/b2_6_0/rules/20_html_tests.cf).
