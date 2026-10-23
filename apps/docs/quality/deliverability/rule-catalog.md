---
description: The deliverability rule catalog lists the JSON checks for mismatched link text, URL shorteners, raw IP links, and low text, with severities, exclusions, and sources.
---

# Deliverability rule catalog

This catalog lists when `deliverability.link-text-domain-mismatch`, `deliverability.url-shortener`, `deliverability.ip-address-url`, and `deliverability.low-text` fire, what they skip, and why. They are advisory and have no auto-fixes. [Options](../options) can change a rule's severity or disable the category.

## `deliverability.link-text-domain-mismatch`

**Default severity:** `warning`.

**What fires:** An anchor, button or menu-item has a whole-label URL or hostname whose site differs from its HTTP(S) destination. `example.co.uk` linked to `evil.co.uk` fires. Subdomains of one registrable domain pass; an explicit multi-part suffix list avoids treating `co.uk` as a site.

**What doesn't:** A matching address label, a sentence containing a domain, image-link alt text, non-HTTP(S) hrefs, and a host with merge tags. A copy-link fallback with text equal to its href passes. ESP click tracking may rewrite the href after send and create a mismatch this JSON check cannot see.

**Why it's flagged:** Rspamd's phishing module compares visible URL text with the destination and emits `PHISHED_URL` for a mismatch. [Google's sender guidelines](https://support.google.com/a/answer/81126) say body links should be visible and easy to understand. [Rspamd phishing module](https://docs.rspamd.com/modules/phishing/).

## `deliverability.url-shortener`

**Default severity:** `warning`.

**What fires:** Any URL occurrence with a configured shortener host or its subdomain, including `bit.ly`, `www.bit.ly` and `sub.bit.ly`. `shortenerHosts` replaces the default list; spread `DEFAULT_SHORTENER_HOSTS` to extend it.

**What doesn't:** Other hosts such as `notbit.ly`, non-HTTP(S) URLs, and a default host removed by a replacement list. The rule does not follow redirects or decide whether the destination is safe.

**Why it's flagged:** Shortened destinations conceal where a click goes and shortener domains can appear on URL blocklists. [Rspamd's phishing examples](https://docs.rspamd.com/modules/phishing/) include a `t.co` redirect when visible text shows another site. Google's sender guidelines do not specifically ban URL shorteners.

## `deliverability.ip-address-url`

**Default severity:** `warning`.

**What fires:** An HTTP(S) URL whose host is IPv4 or IPv6, including private IPs and all-digit IPv4 forms normalized by `URL`.

**What doesn't:** `127.0.0.0/8`, `0.0.0.0` and `[::1]` (covered by `link.localhost-or-staging`), domain names, non-HTTP(S) URLs, and unparseable URLs.

**Why it's flagged:** SpamAssassin names `NORMAL_HTTP_TO_IP` and `NUMERIC_HTTP_ADDR` URI tests for IP-address links. [SpamAssassin URI rules](https://svn.apache.org/repos/asf/spamassassin/branches/b2_4_0/rules/20_uri_tests.cf).

## `deliverability.low-text`

**Default severity:** `info`.

**What fires:** A template has an image with nonempty `src`, a video, or a countdown, and fewer than `thresholds.minTextLength` visible text characters (`200` by default). Text comes from title, paragraph, HTML and table-cell content, button text, and menu-item text, including nested sections. Merge tags count as written.

**What doesn't:** Templates without image-producing blocks, templates meeting the threshold, or templates with any `custom` block: its HTML is unavailable in the JSON. The rule does not evaluate display conditions or per-viewport visibility.

**Why it's flagged:** SpamAssassin has `HTML_IMAGE_ONLY_*` text-byte bands and `HTML_IMAGE_RATIO_*` rules. The 200-character setting is a conservative content cue, not a conversion of those byte thresholds. Readers who block images otherwise see little content. Microsoft 365 does not use SpamAssassin; this evidence is most relevant to rule-based filters such as corporate gateways and smaller ISPs. [SpamAssassin HTML rules](https://svn.apache.org/repos/asf/spamassassin/branches/b2_6_0/rules/20_html_tests.cf).
