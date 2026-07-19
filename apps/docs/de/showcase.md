---
title: Showcase & Anwendungsfälle
description: Wo Templatical hineinpasst — gängige Produktmuster, echte Integrationen und wie Sie Ihre eigene Integration in den Showcase aufnehmen lassen.
---

# Showcase & Anwendungsfälle

Templatical ist zielgerichtet als E-Mail-Kompositionsschicht eines größeren Produkts gebaut. Diese Seite beschreibt die Muster, in die es am besten passt — und ist der Ort, an dem Teams, die Templatical produktiv ausliefern, sich eintragen.

## Gängige Anwendungsfälle

Das sind die Integrationsmuster, die wir am häufigsten sehen. Jedes beschreibt, wie Templatical typischerweise hineinpasst, was vorab wissenswert ist und welche Pakete am relevantesten sind.

### Transactional-E-Mail-Tool

Sie bauen (oder erweitern) eine Transactional-E-Mail-API — Postmark, Resend, SES-Wrapper, interne Sende-Plattformen. Kunden binden ihren Code an, brauchen aber einen Weg, die Templates zu designen und zu versionieren, die die API verschickt.

**Templatical passt, weil:**
- Templates sind JSON — versionierbar, diff-bar, KI-freundlich, leicht neben den Daten Ihrer Kunden zu speichern.
- Die MJML-Ausgabe rendert konsistent über Outlook, Gmail, Apple Mail und den Long Tail an Clients hinweg.
- Der Renderer läuft in Node — Sie können zur Versandzeit serverseitig zu HTML kompilieren, ohne eine anbietergebundene Render-API.

**Typisches Setup:** [`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor) für den visuellen Editor in Ihrem Dashboard, [`@templatical/renderer`](https://www.npmjs.com/package/@templatical/renderer) im Backend, um vor dem Versand zu HTML zu kompilieren.

### Newsletter- oder Marketing-E-Mail-SaaS

Sie bauen ein Mailchimp-ähnliches Produkt, ein Automatisierungs-Tool oder eine Creator-Newsletter-Plattform. E-Mail-Komposition ist eine von mehreren Funktionen, die Ihre Kunden brauchen.

**Templatical passt, weil:**
- Der Drop-in-Editor wird mit einem Funktionsaufruf gemountet — kein Umbau Ihres bestehenden Dashboards.
- Theming über Design-Tokens sorgt dafür, dass die E-Mails Ihrer Kunden sich nativ in Ihre Marke einfügen, nicht in Templaticals.
- Anzeigebedingungen und Merge-Tags sind eingebaut — wichtig für personalisierungslastige Newsletter-Nutzung.
- Cloud-Funktionen (KI-Umschreibung, Kommentare, Snapshots) sind entweder als gemanagte Cloud oder als selbst hostbarer Open-Source-Code verfügbar.

**Typisches Setup:** [`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor) im Kunden-Dashboard eingebettet, [`@templatical/renderer`](https://www.npmjs.com/package/@templatical/renderer) für HTML-Kompilierung, optional Cloud-Tarif für KI/Collab.

### CRM- oder Marketing-Automation-Produkt

Sie bauen ein CRM, ein Sales-Engagement-Tool oder eine Marketing-Automation-Plattform, in der Kunden gebrandete E-Mails als einen von vielen Workflows versenden.

**Templatical passt, weil:**
- Es ist kein separater "E-Mail-Designer"-Tab — es bettet sich inline neben Kontakten, Kampagnen-Builder und Automation-Flows ein.
- Eigene Blöcke lassen Sie Daten Ihres Produkts (Kontaktfelder, Deal-Infos, berechnete Werte) als first-class Inhaltsblöcke anbieten, die Kunden in E-Mails ziehen können.
- Echtzeit-Zusammenarbeit erlaubt es Sales- und Marketing-Teams, Kampagnen-Templates gemeinsam zu bearbeiten, ohne sich gegenseitig zu überschreiben.

**Typisches Setup:** [`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor) mit `customBlocks` für Ihre Domänen-Entitäten, plus [`@templatical/core/cloud`](https://www.npmjs.com/package/@templatical/core) für Collab und Kommentare.

### Interner E-Mail-Komponent

Sie bauen kein kundenfacings Produkt — Sie brauchen ein kontrolliertes Werkzeug, mit dem Ihr Team Transactional- und Marketing-E-Mails designt, mit dem JSON-Output gespeichert in Ihren eigenen Systemen.

**Templatical passt, weil:**
- Vollständig selbst hostbar. Das OSS-SDK hat keine zwingende Cloud-Abhängigkeit.
- Mehrsprachig (Englisch, Deutsch, Portugiesisch, Spanisch, Katalanisch) out of the box, mit einem klaren Weg, weitere Locales für internationale Teams hinzuzufügen.
- TypeScript-strict end-to-end, was die Anbindung an bestehende interne Tools und Codegen-Pipelines vereinfacht.

**Typisches Setup:** [`@templatical/editor`](https://www.npmjs.com/package/@templatical/editor) im internen Portal, [`@templatical/renderer`](https://www.npmjs.com/package/@templatical/renderer) in Job-Runnern oder der Sende-Pipeline.

### Headless / programmatische Template-Generierung

Sie betten gar keinen visuellen Editor ein — Sie wollen Templates programmatisch aus Daten erzeugen, in der Source Control versionieren und durch eine deterministische Pipeline rendern.

**Templatical passt, weil:**
- Das Block-System hat Factory-Funktionen (`createTitleBlock`, `createImageBlock`, …) und vollständige TypeScript-Typen — Sie können Templates komplett in Code mit voller Typsicherheit bauen.
- Der Renderer ist eine reine Funktion ohne DOM-Abhängigkeit. Lauffähig in Serverless, Edge oder Node.

**Typisches Setup:** [`@templatical/types`](https://www.npmjs.com/package/@templatical/types) für Factories und Typen, [`@templatical/renderer`](https://www.npmjs.com/package/@templatical/renderer) für MJML-Ausgabe, kein Editor nötig.

Siehe [Programmatische Templates](/de/guide/programmatic-templates) für einen vollständigen Walkthrough dieses Musters.

## Mit Templatical gebaut?

Wenn Ihr Team Templatical produktiv einsetzt, freuen wir uns, Sie hier zu featuren. Öffnen Sie einen Pull Request mit Ihrem Eintrag oder [starten Sie eine Diskussion](https://github.com/templatical/sdk/discussions), und wir machen es gemeinsam.

Was wir auflisten:
- Eine kurze Produktbeschreibung (ein Satz)
- Ihr Logo und ein Link
- Optional: ein Absatz dazu, wie Sie Templatical nutzen (welche Pakete, welche Funktionen, irgendetwas Bemerkenswertes)

Diese Seite füllt sich, während die Adoption wächst. Seien Sie der/die Erste.

::: tip Sponsoring & Unterstützung
Wenn Ihr Unternehmen auf Templatical baut, können Sie die Entwicklung auch direkt über [GitHub Sponsors](https://github.com/sponsors/orkhanahmadov) unterstützen. Sponsoring ist unabhängig vom Eintrag hier — die Listung ist kostenlos und bleibt kostenlos.
:::
