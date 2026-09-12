---
title: KI-Agent-Skill
description: Ein kostenloser, quelloffener Agent Skill, der Templatical-E-Mail-Vorlagen aus einem Prompt schreibt, bearbeitet, importiert und validiert, sie live im echten Editor anzeigt, und eine @templatical/editor-Integration installiert, aufsetzt oder deren Fehler behebt — ohne Backend oder API-Schlüssel.
---

# KI-Agent-Skill

Templatical bietet einen [Agent Skill](https://agentskills.io) — **kostenlos, quelloffen und vollständig in Ihrem eigenen KI-Coding-Agenten ausgeführt:** `templatical`. Bitten Sie ihn um eine E-Mail, und er schreibt, bearbeitet, importiert, validiert oder zeigt eine Vorlage live an; fragen Sie ihn etwas zur SDK, und er installiert sie, bindet sie ein, setzt eine Integration auf oder behebt deren Fehler. Ein Skill — und er entscheidet selbst, welche Aufgabe eine Anfrage braucht.

Es gibt kein Backend und keinen API-Schlüssel: Ihr Agent ist die Inferenz. Nichts wird an Templatical gesendet.

## Installation

```bash
npx skills add templatical/sdk
```

Für ein Update:

```bash
npx skills update
```

Falls Ihr Agent den Skill danach nicht aufgreift, prüfen Sie, ob er in der Skill-Liste des Agenten aktiviert ist.

## Was er kann

- **Bauen** Sie eine Vorlage aus einem Briefing — „mach mir eine Produktlaunch-E-Mail", „gestalte eine Willkommens-E-Mail".
- **Bearbeiten** Sie eine bestehende Vorlage als gezielte Änderung, nicht als Neuschrieb.
- **Importieren** Sie eine Vorlage aus einem anderen Editor — Unlayer, BeeFree, Stripo, Topol, Chamaileon, Easy Email Pro, MJML oder HTML.
- **Validieren** Sie das JSON einer Vorlage gegen das Block-Schema und erhalten Sie präzise Fehler pro Block zurück.
- **Exportieren** Sie eine Vorlage als versandfertiges MJML oder HTML.
- **Sehen Sie sie live** im echten Templatical-Editor in Ihrem Browser an — sie bleibt synchron, während Sie weiter prompten, Änderungen von Hand eingeschlossen.
- **Integrieren** Sie den Editor in eine Anwendung — Stack erkennen, die Änderung vorschlagen und abwarten, bevor irgendetwas geschrieben wird.
- **Setzen Sie** eine vorgeschlagene Integration in Ihr Repository um, installiert mit Ihrem eigenen Paketmanager und geprüft gegen Ihren laufenden Dev-Server.
- **Diagnostizieren** Sie eine Integration, die nicht wie erwartet funktioniert, anhand einer Tabelle verifizierter Fallstricke.
- **Beantworten Sie eine Frage** zur SDK, indem diese Dokumentationsseite direkt abgerufen wird.

::: tip Lieber eine gehostete Lösung?
Ein KI-Chat direkt im Editor, feinabgestimmte Prompts und ein gehosteter MCP-Server sind Teil des [Templatical-Cloud](/de/cloud/)-Tarifs. Dieser Skill ist der offene, selbst gehostete Weg — bringen Sie Ihren eigenen Agenten mit und behalten Sie die volle Kontrolle.
:::

## Beispiele

### Eine E-Mail bauen, validieren und exportieren — ohne Integration

Beschreiben Sie die gewünschte E-Mail. Zum Beispiel:

> Gib mir eine Produktlaunch-E-Mail für eine Outdoor-Marke — ein Hero-Bild, eine kurze Einleitung und einen „Jetzt shoppen"-Button, in Waldgrün und mit einem warmen, neutralen Hintergrund.

Der Agent wird:

1. das Block-Schema und die mitgelieferten Beispiele des Skills lesen,
2. ein vollständiges Template als `{ blocks, settings }`-JSON erzeugen,
3. den Validator selbst ausführen und die gemeldeten Struktur- oder Barrierefreiheitsprobleme beheben — so lange, bis das Template besteht,
4. Ihnen die fertige E-Mail übergeben: **MJML/HTML zum Versand** exportieren, oder das JSON mit `editor.setContent(json)` in Ihre eigene Editor-Integration laden.

Das ist eine komplette E-Mail, von Anfang bis Ende, ohne eine Integration zu bauen. Sie können sie vor dem Export auch live ansehen — siehe das nächste Beispiel.

### Live ansehen und von Hand bearbeiten

Bitten Sie darum, es **live zu zeigen** (oder „live in der Vorschau", „im Live-Modus bauen"), und der Skill:

1. öffnet eine Live-Vorschau in Ihrem Browser, die Ihr aktuelles Template im echten Editor zeigt.
2. aktualisiert sie bei jeder Änderung, die Sie prompten, **live** — ohne Neuladen.
3. lässt Sie auch **im Browser von Hand bearbeiten**; der Agent erkennt, wenn Sie abgewichen sind, und fragt, ob er auf Ihrer Version aufbauen oder sie ersetzen soll, bevor er überschreibt.

Bauen Sie zuerst in reinem JSON und wechseln Sie mitten in der Sitzung zu einer Live-Vorschau — sie knüpft genau dort an, wo Sie stehen. Der Live-Modus ist lokal und für einen einzelnen Nutzer — nicht der Echtzeit-Weg der [Cloud](/de/cloud/) — und benötigt nichts außer einem Coding-Agenten, der auf Ihrem eigenen Rechner läuft.

### Eine Vorlage aus einem anderen Editor importieren

Haben Sie bereits eine Vorlage in einem anderen Editor? Der Skill wandelt **Unlayer**-, **BeeFree**-, **Stripo**-, **Topol**-, **Chamaileon**-, **Easy Email Pro**-, **MJML**- und **HTML**-E-Mails in Templatical-JSON um — zeigen Sie ihm die Datei, und er schreibt eine funktionierende Vorlage plus einen kurzen Bericht darüber, was sauber konvertiert wurde und was auf rohes HTML zurückgefallen ist (der Import ist naturgemäß verlustbehaftet). Sehen Sie sie sich anschließend live an und verfeinern Sie die groben Stellen zu nativen Blöcken.

Um die Konverter stattdessen direkt in Ihrem eigenen Code zu verwenden, siehe die Migrationsleitfäden: [Unlayer](/de/guide/migration-from-unlayer), [BeeFree](/de/guide/migration-from-beefree), [Stripo](/de/guide/migration-from-stripo), [Topol](/de/guide/migration-from-topol), [Chamaileon](/de/guide/migration-from-chamaileon), [Easy Email Pro](/de/guide/migration-from-easy-email-pro), [MJML](/de/guide/migration-from-mjml), [HTML](/de/guide/migration-from-html).

### Den Editor integrieren — oder eine bestehende Integration diagnostizieren

Bitten Sie ihn, eine komplett neue Integration aufzusetzen, einer bestehenden einen Save/Load-Provider hinzuzufügen, oder zu erklären, warum ein Editor, der in einem Modal eingebunden ist, seine Dialoge an der falschen Stelle rendert. Bei einer neuen Integration:

1. **Erkennt er Ihren Stack** — Paketmanager, Framework, Bundler, TypeScript, und ob `@templatical/editor` bereits installiert ist, und in welcher Version.
2. **Schlägt er die Änderung vor und wartet** — die hinzuzufügenden Pakete, die zu erstellenden oder zu bearbeitenden Dateien, den Mount-Punkt — bevor er irgendetwas anfasst.
3. **Setzt er sie um**, installiert dabei mit Ihrem eigenen Paketmanager.
4. **Überprüft er, indem er Ihren Dev-Server startet** und dessen Konsolen- und Netzwerkausgabe liest — nicht, indem er Sie bittet, selbst nachzusehen.
5. **Berichtet er**, was sich geändert hat, was unangetastet blieb, und was noch gebraucht wird — ein Provider, eine optionale Peer-Abhängigkeit, ein Cloud-Auth-Endpunkt.

Eine bestehende Integration zu diagnostizieren durchläuft dieselben Schritte rückwärts: Er liest Ihren `init()`-/`initCloud()`-Aufruf, die Bundler-Konfiguration und das CSS-Setup, und prüft jedes davon gegen eine Tabelle verifizierter Fallstricke — doppelte Vue-Reaktivität, ein fehlender `style.css`-Import, ein gefangener `position: fixed`-Vorfahre, und mehr.

## Gut zu wissen

### Das Schema kann nicht vom echten Blockmodell abweichen

Das JSON-Schema des Skills wird direkt aus `@templatical/types` generiert — denselben Typen, die Editor und Renderer verwenden —, sodass es nie von dem abweicht, was die SDK tatsächlich akzeptiert. Genau dagegen prüft auch der Validator: Was der Skill Ihnen übergibt, lädt garantiert. Details zur Neugenerierung und zu Beiträgen finden Sie in [`packages/template-tools`](https://github.com/templatical/sdk/tree/main/packages/template-tools) im Repository.

### Eine Vorlage ohne den Agenten validieren

Der Agent führt diesen Validator bereits selbst aus, bevor er etwas zurückgibt, Sie müssen es also nicht tun. Es ist aber nur die veröffentlichte CLI, die Sie bei Bedarf auch selbst ausführen können — in CI oder um ein Template zu prüfen:

```bash
npx -y @templatical/template-tools@0.36.0 validate pfad/zum/template.json
```

Es prüft jeden Block gegen seinen Typ im [Block-Schema](/de/guide/blocks) und meldet präzise Fehler (zum Beispiel `blocks[2] (button) must have required property 'url'`). Anschließend kommen Barrierefreiheits-, Struktur- und Link-Prüfungen hinzu. Exit-Code `0` bei Erfolg, `1` bei Fehler.

### Benutzerdefinierte Blöcke werden nie aus einem Prompt erzeugt

Benutzerdefinierte Blöcke sind zur Laufzeit registrierte Erweiterungen des Konsumenten — der Skill kann nicht wissen, was ein solcher Block tut, und erzeugt ihn deshalb nie aus einem Prompt. Wie Sie einen eigenen registrieren, steht unter [Benutzerdefinierte Blöcke](/de/guide/custom-blocks).

### SDK-Antworten werden abgerufen, nicht mitgeliefert

Fragen zur Integration und Fehlerbehebung werden beantwortet, indem diese Dokumentationsseite direkt abgerufen wird, statt aus Wissen, das im Skill gebündelt ist — eine Antwort ist dadurch nie älter als die Seite selbst, und es gibt nichts, was zwischen zwei Installationen veralten könnte.

### Was dieser Skill nicht tut

Sie binden nicht den Skill selbst ein — Ihre Laufzeit-Integration ist [`@templatical/editor`](/de/getting-started/quick-start) (Ihre Nutzer bauen E-Mails, Sie erhalten JSON) plus [`@templatical/renderer`](/de/api/renderer-typescript) (JSON → MJML/HTML zum Versand).

Für eine **„Mit KI erstellen"**-Funktion im Produkt — Ihre Nutzer geben einen Prompt ein und erhalten ein Template — ruft Ihr Backend ein LLM mit dem Block-Schema auf, validiert das Ergebnis mit [`@templatical/quality`](/de/quality/) und rendert es. Wenn Sie das nicht selbst bauen und hosten möchten, bietet [Templatical Cloud](/de/cloud/) verwaltete KI-Generierung und Zusammenarbeit.

Er fasst nie Git an.
