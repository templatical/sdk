---
title: Wie das Rendering funktioniert
description: Verstehen Sie die JSON → MJML-Rendering-Pipeline in Templatical.
---

# Wie das Rendering funktioniert

Templatical trennt die Template-Bearbeitung vom Template-Rendering. Der Editor erzeugt JSON; der Renderer wandelt dieses JSON in MJML um. Anschließend kompilieren Sie das MJML mit einer beliebigen MJML-Bibliothek zu HTML und versenden es über Ihren E-Mail-Dienst.

## Die Pipeline

<svg viewBox="0 0 400 520" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:400px;margin:1.5em auto;display:block;">
  <defs>
    <marker id="ah" markerWidth="8" markerHeight="6" refX="4" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6" fill="#94a3b8"/>
    </marker>
  </defs>
  <!-- Editor -->
  <rect x="60" y="10" width="280" height="52" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="10"/>
  <text x="200" y="34" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" font-weight="600" fill="#1e293b" text-anchor="middle">Editor</text>
  <text x="200" y="52" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">Drag-and-Drop</text>
  <!-- Arrow -->
  <line x1="200" y1="62" x2="200" y2="92" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah)"/>
  <text x="260" y="82" font-family="ui-monospace, monospace" font-size="11" fill="#94a3b8" text-anchor="start">getContent()</text>
  <!-- JSON -->
  <rect x="60" y="96" width="280" height="52" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="10"/>
  <text x="200" y="120" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" font-weight="600" fill="#1e293b" text-anchor="middle">JSON</text>
  <text x="200" y="138" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">TemplateContent — in Ihrer Datenbank speichern</text>
  <!-- Arrow -->
  <line x1="200" y1="148" x2="200" y2="178" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah)"/>
  <text x="260" y="168" font-family="ui-monospace, monospace" font-size="11" fill="#94a3b8" text-anchor="start">renderToMjml()</text>
  <!-- MJML (highlighted) -->
  <rect x="60" y="182" width="280" height="52" fill="#fef3c7" stroke="#f59e0b" stroke-width="1.5" rx="10"/>
  <text x="200" y="206" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" font-weight="600" fill="#1e293b" text-anchor="middle">MJML</text>
  <text x="200" y="224" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#92400e" text-anchor="middle">von Templatical gerendert</text>
  <!-- Divider -->
  <line x1="30" y1="260" x2="370" y2="260" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="6 4"/>
  <text x="200" y="280" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">Ihr Code unterhalb — beliebige MJML-Bibliothek, beliebige Sprache</text>
  <!-- Arrow -->
  <line x1="200" y1="290" x2="200" y2="310" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah)"/>
  <!-- HTML -->
  <rect x="60" y="314" width="280" height="52" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="10"/>
  <text x="200" y="338" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" font-weight="600" fill="#1e293b" text-anchor="middle">HTML</text>
  <text x="200" y="356" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">versandfertige Ausgabe</text>
  <!-- Arrow -->
  <line x1="200" y1="366" x2="200" y2="396" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ah)"/>
  <!-- Send -->
  <rect x="60" y="400" width="280" height="52" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="10"/>
  <text x="200" y="424" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" font-weight="600" fill="#1e293b" text-anchor="middle">Versand</text>
  <text x="200" y="442" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">Ihr E-Mail-Dienst</text>
</svg>

1. **JSON** -- Das native Format des Editors. Ein `TemplateContent`-Objekt mit einem `blocks`-Array und einem `settings`-Objekt. Speichern Sie es, damit Nutzer die Bearbeitung später fortsetzen können.

2. **MJML** -- Eine speziell für E-Mails entwickelte Zwischen-Markup-Sprache. Jeder Templatical-Block wird auf eine MJML-Komponente abgebildet (`<mj-text>`, `<mj-image>`, `<mj-button>` usw.). MJML übernimmt die schwierigen Teile von E-Mail-HTML: responsive Tabellen, Outlook-Conditionals und Kompatibilität mit verschiedenen E-Mail-Clients. **Dies ist die Ausgabe des Templatical-Renderers.**

3. **HTML** -- Die finale Ausgabe. MJML kompiliert zu einem vollständigen HTML-Dokument mit Inline-Styles, verschachtelten Tabellen und client-spezifischen Workarounds. **Diesen Schritt kompilieren Sie selbst** mit einer beliebigen MJML-Bibliothek:

    | Sprache | Bibliothek |
    |----------|---------|
    | Node.js | [mjml](https://www.npmjs.com/package/mjml) (offiziell) |
    | PHP | [spatie/mjml-php](https://github.com/spatie/mjml-php) |
    | Python | [mrml-python](https://github.com/jdrouet/mrml/tree/main/packages/mrml-python) |
    | Ruby | [mrml-ruby](https://github.com/hardpixel/mrml-ruby) |
    | Rust | [mrml](https://github.com/jdrouet/mrml) |
    | .NET | [Mjml.Net](https://github.com/SebastianStehle/mjml-net) |
    | Elixir | [mjml_nif](https://github.com/adoptoposs/mjml_nif) |

    Eine vollständige Liste finden Sie auf [mjml.io/community](https://mjml.io/community).

## Warum MJML?

[MJML](https://mjml.io) ist eine Open-Source-Markup-Sprache, die speziell für E-Mails entwickelt wurde. E-Mail-HTML ist bekanntermaßen schwierig. Jeder E-Mail-Client rendert HTML anders -- Outlook verwendet die Rendering-Engine von Microsoft Word, Gmail entfernt `<style>`-Tags, Apple Mail unterstützt modernes CSS, Yahoo dagegen nicht. HTML zu schreiben, das überall funktioniert, erfordert:

- Verschachtelte Tabellen für das Layout (Flexbox und Grid funktionieren nicht)
- Inline-Styles auf jedem Element (externe/eingebettete Stylesheets werden entfernt)
- Outlook-spezifische Conditional Comments (`<!--[if mso]>`)
- Responsive Breakpoints über `<style>`-Tags für Clients, die sie unterstützen

MJML abstrahiert all dies. Sie schreiben semantische Komponenten (`<mj-section>`, `<mj-column>`, `<mj-text>`), und MJML kompiliert sie zu kompatiblem HTML.

Indem Templatical MJML statt direkt HTML erzeugt, bleibt es leichtgewichtig und gibt Ihnen die volle Kontrolle über die finale Ausgabe. Sie können einen beliebigen MJML-Compiler in einer beliebigen Sprache verwenden und das MJML vor dem Kompilieren modifizieren – um eigene Komponenten einzufügen, Tracking-Pixel hinzuzufügen oder das Markup an die Anforderungen Ihrer Versandplattform anzupassen.

## Was gespeichert werden sollte

Speichern Sie sowohl JSON als auch MJML in Ihrer Datenbank, wenn der Nutzer speichert. Das JSON ermöglicht es Nutzern, das Template erneut zu öffnen und zu bearbeiten. Das MJML ist das, was Sie zum Versandzeitpunkt zu HTML kompilieren. Das Beispiel im [Schnellstart](/de/getting-started/quick-start) zeigt dieses Muster.

## Was der Renderer tut

`@templatical/renderer` nimmt ein `TemplateContent`-JSON-Objekt entgegen und erzeugt ein vollständiges MJML-Dokument. Im Einzelnen:

- Konvertiert jeden Block im JSON-Baum in seine entsprechende MJML-Komponente (text → `<mj-text>`, image → `<mj-image>`, button → `<mj-button>` usw.)
- Wendet Blockstile (Padding, Margin, Hintergrundfarbe) als MJML-Attribute an
- Verarbeitet responsive Overrides für Tablet- und Mobile-Viewports
- Fügt benutzerdefinierte Schriftart-Deklarationen als `<mj-font>`-Tags ein
- Bewahrt Merge-Tags unverändert (sie werden als wörtlicher Text durchgereicht)
- Berücksichtigt `visibility`-Einstellungen -- auf allen Viewports ausgeblendete Blöcke werden ausgelassen
- Umschließt Blöcke mit `displayCondition`-Before/After-Strings
- Entfernt optional rohe HTML-Blöcke, wenn `allowHtmlBlocks` auf `false` gesetzt ist

## Was der Renderer NICHT tut

- **MJML zu HTML kompilieren** -- Verwenden Sie dafür eine beliebige [MJML-Bibliothek](#die-pipeline).
- **Merge-Tags auswerten** -- Tags wie <code v-pre>{{ first_name }}</code> werden unverändert durchgereicht und zum Versandzeitpunkt von Ihrer E-Mail-Plattform ersetzt.
- **Anzeigebedingungen auswerten** -- Bedingte Umschließung (z. B. `{% if %}`) wird zur Verarbeitung durch Ihre Versandplattform unverändert durchgereicht.
- **E-Mails versenden** -- Der Renderer erzeugt MJML. Der Versand wird von Ihrem E-Mail-Dienst übernommen.
- **Bilder optimieren** -- Bilder werden per URL referenziert. Der Renderer lädt, skaliert oder optimiert sie nicht.

## Nächste Schritte

- [Renderer-API](/de/api/renderer-typescript) -- vollständige `renderToMjml()`-Referenz
