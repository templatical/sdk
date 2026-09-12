---
title: KI-Agent-Skill
description: Ein offener Agent Skill für Templatical — E-Mail-Vorlagen aus einem Prompt erzeugen und validieren, live im echten Editor ansehen, und die @templatical/editor-SDK installieren, einbinden, per Theming anpassen oder deren Fehler beheben. Kostenlos, quelloffen, ohne Backend und ohne API-Schlüssel.
---

# KI-Agent-Skill

Templatical bietet einen [Agent Skill](https://agentskills.io) — **kostenlos, quelloffen und vollständig in Ihrem eigenen KI-Coding-Agenten ausgeführt:** `templatical`.

Er deckt beide Aufgaben ab, die die Arbeit mit Templatical braucht: eine Vorlage verfassen (eine aus einem Briefing schreiben, sie bearbeiten, aus einem anderen Editor importieren, validieren, zu MJML/HTML rendern, oder live im echten Editor ansehen und von Hand bearbeiten) und die SDK einbinden ([`@templatical/editor`](/de/getting-started/quick-start) in eine Anwendung einbinden, eine Integration aufsetzen oder deren Fehler beheben, oder eine Frage wie „Wie mache ich …" oder „Ist … möglich" beantworten). Eine Anfrage braucht oft beides, in dieser Reihenfolge — „Baue mir eine Willkommens-E-Mail und binde sie in meine App ein" gestaltet und validiert zuerst die Vorlage, dann bindet es den Editor ein und lädt sie hinein — und der Skill trifft diese Entscheidung selbst: Geht es bei der Anfrage um den Inhalt einer Vorlage, oder um die SDK, die sie rendert?

Für keine der beiden Hälften gibt es ein Backend oder einen API-Schlüssel: Ihr Agent ist die Inferenz. Nichts wird an Templatical gesendet.

## Installation

Der Skill ist ein schlichter [Agent-Skills](https://agentskills.io)-Ordner — jeder Agent, der `SKILL.md` liest, kann ihn verwenden.

```bash
npx skills add templatical/sdk
```

[`skills`](https://github.com/vercel-labs/skills) erkennt, welche unterstützten Agenten Sie installiert haben, und legt ihn direkt in das Verzeichnis, das der jeweilige Agent liest — Sie müssen nichts von Hand ablegen.

Das Tool meldet standardmäßig anonyme Nutzungstelemetrie: welches Repository und welchen Skill Sie installiert haben, bei öffentlichen Repositories. Setzen Sie `DISABLE_TELEMETRY=1` oder `DO_NOT_TRACK=1`, falls Ihnen das lieber ist:

```bash
DISABLE_TELEMETRY=1 npx skills add templatical/sdk
```

Für ein Update führen Sie denselben Befehl erneut aus.

Falls Ihr Agent den Skill danach nicht aufgreift, prüfen Sie, ob er in der Skill-Liste des Agenten aktiviert ist.

## Was er tut

Beschreiben Sie in einfacher Sprache, was Sie wollen — der Skill wählt den Modus:

- **Bauen** Sie eine Vorlage aus einem Briefing — „mach mir eine Produktlaunch-E-Mail", „gestalte eine Willkommens-E-Mail".
- **Bearbeiten** Sie eine bestehende Vorlage, als gezielte Änderung statt als Neuschrieb.
- **Importieren** Sie eine Vorlage aus einem anderen Editor — Unlayer, BeeFree, Stripo, Topol, Chamaileon, Easy Email Pro, MJML oder HTML.
- **Validieren** Sie das JSON einer Vorlage gegen das Block-Schema und erhalten Sie präzise Fehler pro Block zurück.
- **Exportieren** Sie eine Vorlage als versandfertiges MJML oder HTML.
- **Sehen Sie sie live** im echten Templatical-Editor in Ihrem Browser an — sie bleibt synchron, während Sie weiter prompten, und Änderungen von Hand werden abgeglichen statt überschrieben.
- **Integrieren** Sie den Editor in eine Anwendung — Stack erkennen, die Änderung vorschlagen und abwarten, bevor irgendetwas geschrieben wird.
- **Setzen Sie** eine vorgeschlagene Integration in Ihr Repository um, installieren Sie mit Ihrem eigenen Paketmanager, und überprüfen Sie es, indem Sie Ihren Dev-Server starten.
- **Diagnostizieren** Sie eine bestehende Integration anhand einer Tabelle verifizierter Fallstricke — doppelte Vue-Reaktivität, ein fehlender `style.css`-Import, ein gefangener `position: fixed`-Vorfahre, und mehr.
- **Beantworten Sie eine Frage**, indem diese Dokumentationsseite direkt abgerufen wird — die Antwort ist dadurch nie älter als die Seite selbst.

::: tip Lieber eine gehostete Lösung?
Ein KI-Chat direkt im Editor, feinabgestimmte Prompts und ein gehosteter MCP-Server sind Teil des [Templatical-Cloud](/de/cloud/)-Tarifs. Dieser Skill ist der offene, selbst gehostete Weg — bringen Sie Ihren eigenen Agenten mit und behalten Sie die volle Kontrolle.
:::

### Was Sie brauchen

Ein paar Dinge müssen auf Ihrem Rechner vorhanden sein, bevor Sie starten.

| | Was | Nötig für |
|---|---|---|
| **Ein Coding-Agent** | Einer, der [Agent Skills](https://agentskills.io) unterstützt und auf Ihrem eigenen Rechner läuft — Claude Code, Codex CLI, Cursor 2.4+, Gemini CLI, GitHub Copilot und weitere lesen alle `SKILL.md`. Er muss Befehle ausführen und Dateien schreiben dürfen. | Alles |
| **Node.js 20+** | Version 22 (LTS) empfohlen. Prüfen Sie es mit `node -v`; wenn dabei nichts oder eine Version unter 20 erscheint, installieren Sie es von [nodejs.org](https://nodejs.org). | Alles |
| **Eine Internetverbindung** | Jeder Befehl — auch das Erzeugen und Validieren von JSON — läuft über eine kleine CLI, die bei Bedarf per `npx` geladen wird. Der erste Aufruf lädt die gepinnte Version von npm herunter; danach cacht npm sie, und es gibt keinen weiteren Netzwerk-Roundtrip mehr, bis ein künftiges Release den Pin verschiebt. In Ihr Projekt wird dabei nichts installiert: keine Änderung an der `package.json`, keine Änderung an der Lockfile, kein Eintrag in `node_modules`. | Alles |
| **Ein moderner Browser** | Chrome/Edge 80+, Firefox 101+, Safari 16.4+ — haben Sie mit hoher Wahrscheinlichkeit bereits. | [Live-Vorschau](#live-vorschau) |
| **`npm`** | Lädt beim ersten Import den Konverter für Ihr Quellformat. Ist in Node.js enthalten. | [Import](#eine-bestehende-vorlage-importieren) |

**Sonst nichts** — kein Templatical-Konto, kein API-Schlüssel und kein Backend.

Zwei unterschiedliche Dinge können das verhindern, daher lohnt sich die Unterscheidung: **Keine Internetverbindung blockiert alles**, da inzwischen selbst das Erzeugen und Validieren von JSON über die CLI läuft. **Kein lokales Dateisystem oder erreichbarer Port** — eine gehostete, serverseitige Sandbox — blockiert nur die Live-Vorschau; jeder andere Modus ist davon nicht betroffen.

## Eine Vorlage gestalten und validieren

Beschreiben Sie die gewünschte E-Mail. Zum Beispiel:

> Gib mir eine Produktlaunch-E-Mail für eine Outdoor-Marke — ein Hero-Bild, eine kurze Einleitung und einen „Jetzt shoppen"-Button, in Waldgrün und mit einem warmen, neutralen Hintergrund.

Der Agent wird:

1. das Block-Schema und die mitgelieferten Beispiele des Skills lesen,
2. ein vollständiges Template als `{ blocks, settings }`-JSON erzeugen,
3. den Validator selbst ausführen und die gemeldeten Struktur- oder Barrierefreiheitsprobleme beheben — so lange, bis das Template besteht,
4. Ihnen die fertige E-Mail übergeben — sehen Sie sie live an und verfeinern Sie sie (siehe unten), exportieren Sie dann **MJML/HTML zum Versand** oder laden Sie das JSON mit `editor.setContent(json)` in Ihre eigene Editor-Integration.

### Live-Vorschau

Sie müssen nicht beim JSON aufhören — Sie können das Template im **echten** Editor rendern sehen und es per Prompt weiter verfeinern. Bitten Sie darum, es **live zu zeigen** (oder „live in der Vorschau", „im Live-Modus bauen"), und der Skill:

1. öffnet eine Live-Vorschau in Ihrem Browser, die Ihr aktuelles Template im echten Editor zeigt.
2. aktualisiert sie bei jeder Änderung, die Sie prompten, **live** — ohne Neuladen.
3. lässt Sie auch **im Browser von Hand bearbeiten**; der Agent erkennt, wenn Sie abgewichen sind, und fragt, ob er auf Ihrer Version aufbauen oder sie ersetzen soll, bevor er überschreibt.

Bauen Sie zuerst in reinem JSON und wechseln Sie mitten in der Sitzung zu einer Live-Vorschau — sie knüpft genau dort an, wo Sie stehen. Jede Vorlage wird unter einem eigenen Namen gespeichert, und eine neue Sitzung beginnt mit einer frischen (bitten Sie darum, eine frühere Vorlage „fortzusetzen", um sie erneut zu öffnen). Der Live-Modus ist lokal und für einen einzelnen Nutzer — nicht der Echtzeit-Weg der [Cloud](/de/cloud/) — und benötigt nichts außer einem Coding-Agenten, der auf Ihrem eigenen Rechner läuft.

Wenn es passt, klicken Sie auf **Export** für das MJML oder HTML und versenden Sie es über Ihren Anbieter — das ist eine komplette E-Mail, von Anfang bis Ende, ohne eine Integration bauen zu müssen.

### Eine bestehende Vorlage importieren

Sie haben bereits eine Vorlage in einem anderen Editor? Der Skill kann **Unlayer**-, **BeeFree**-, **Stripo**-, **Topol**-, **Chamaileon**-, **Easy Email Pro**-, **MJML**- und **HTML**-E-Mails in Templatical-JSON umwandeln — zeigen Sie ihm die Datei, und er schreibt eine Arbeitsvorlage plus einen kurzen Bericht darüber, was sauber konvertiert wurde und was auf rohes HTML zurückgefallen ist (der Import ist naturgemäß verlustbehaftet). Sehen Sie sie sich anschließend live an und verfeinern Sie die groben Stellen zu nativen Blöcken. Um die Konverter direkt in Ihrem eigenen Code zu verwenden, siehe die Migrationsleitfäden: [Unlayer](/de/guide/migration-from-unlayer), [BeeFree](/de/guide/migration-from-beefree), [Stripo](/de/guide/migration-from-stripo), [Topol](/de/guide/migration-from-topol), [Chamaileon](/de/guide/migration-from-chamaileon), [Easy Email Pro](/de/guide/migration-from-easy-email-pro), [MJML](/de/guide/migration-from-mjml), [HTML](/de/guide/migration-from-html).

### Bringen Sie Ihre eigene Marke und Regeln mit

Der Skill definiert das _Format_ — den _Stil_ bringen Sie ein. Ergänzen Sie Ihren eigenen Kontext: Markenfarben und -schriften, Tonalität, einen eigenen System-Prompt, einen verpflichtenden Footer oder Abmelde-Block. Wenn Sie dem Agenten Ihre Markeneinstellungen mitgeben, verwendet er diese anstelle generischer Standardwerte.

Benutzerdefinierte Blöcke sind die einzige Ausnahme: Sie sind zur Laufzeit registrierte Erweiterungen des Konsumenten, daher erzeugt der Skill sie nicht aus einem Prompt. Siehe [Benutzerdefinierte Blöcke](/de/guide/custom-blocks).

### Template-JSON direkt validieren

Der Agent führt diesen Validator bereits selbst aus (Schritt 3 oben), Sie müssen es also nicht tun. Es ist aber nur die veröffentlichte CLI, die Sie bei Bedarf auch selbst ausführen können — in CI oder um ein Template zu prüfen:

```bash
npx -y @templatical/template-tools@0.36.0 validate pfad/zum/template.json
```

Es prüft jeden Block gegen seinen Typ im [Block-Schema](/de/guide/blocks) und meldet präzise Fehler (zum Beispiel `blocks[2] (button) must have required property 'url'`). Anschließend kommen Barrierefreiheits-, Struktur- und Link-Prüfungen hinzu. Exit-Code `0` bei Erfolg, `1` bei Fehler.

### Wie es korrekt bleibt

Das JSON-Schema des Skills wird direkt aus `@templatical/types` generiert — denselben Typen, die Editor und Renderer verwenden —, sodass es nie vom tatsächlichen Blockmodell abweicht. Details zur Neugenerierung und zu Beiträgen finden Sie in [`packages/template-tools`](https://github.com/templatical/sdk/tree/main/packages/template-tools) im Repository.

## Den Editor integrieren

Bitten Sie ihn, eine komplett neue Integration aufzusetzen, einer bestehenden einen Save/Load-Provider hinzuzufügen, oder zu erklären, warum ein Editor, der in einem Modal eingebunden ist, seine Dialoge an der falschen Stelle rendert — Provider, Theming, Shadow DOM, Versionsabweichungen und die Integrationsfallen, auf die Sie erst stoßen, wenn Sie tatsächlich hineinlaufen (doppelte Vue-Reaktivität, ein fehlender `style.css`-Import, ein gefangener `position: fixed`-Vorfahre, ein `toHtml()`, das einen `render`-Provider braucht, und mehr).

Bei einer neuen Integration:

1. **Erkennt er Ihren Stack** — Paketmanager, Framework, Bundler, TypeScript, und ob `@templatical/editor` bereits installiert ist, und in welcher Version.
2. **Schlägt er die Änderung vor und wartet** — die hinzuzufügenden Pakete, die zu erstellenden oder zu bearbeitenden Dateien, den Mount-Punkt — bevor er irgendetwas anfasst.
3. **Setzt er sie um**, installiert dabei mit Ihrem eigenen Paketmanager.
4. **Überprüft er, indem er Ihren Dev-Server startet** und dessen Konsolen- und Netzwerkausgabe liest — nicht, indem er Sie bittet, selbst nachzusehen.
5. **Berichtet er**, was sich geändert hat, was unangetastet blieb, und was noch gebraucht wird — ein Provider, eine optionale Peer-Abhängigkeit, ein Cloud-Auth-Endpunkt.

Eine bestehende Integration zu diagnostizieren durchläuft dieselben Schritte rückwärts: Er liest Ihren `init()`-/`initCloud()`-Aufruf, die Bundler-Konfiguration und das CSS-Setup, und prüft jedes davon gegen die bekannten Fehlerbilder.

Sein SDK-Wissen wird direkt von dieser Dokumentationsseite abgerufen, statt im Skill gebündelt zu sein — eine Antwort ist dadurch nie älter als die Seite selbst, und es gibt nichts, was zwischen zwei Installationen veralten könnte. Die Ausnahmen: Ein exakter Schema-Lookup läuft über dieselbe veröffentlichte CLI, die auch die Vorlagen-Hälfte nutzt (`npx -y @templatical/template-tools@0.36.0 schema`), und eine Prüfung auf Versionsabweichung — wenn Ihr installiertes `@templatical/editor` älter ist als hier beschrieben — liest den gepinnten Quellcode direkt vom passenden Git-Tag auf GitHub. Alle Details, einschließlich der Fehlerbild-Tabelle und der sechs Provider-Verträge (`templates`, `versionHistory`, `comments`, `savedBlocks`, `testEmail`, `render`), finden Sie [im Skill selbst](https://github.com/templatical/sdk/tree/main/skills/templatical) — fragen Sie ihn direkt, oder lesen Sie die `SKILL.md` im Repository.

## Wo das in Ihr Produkt passt

Der Skill deckt zwei sehr unterschiedliche Bedürfnisse ab.

**Eine E-Mail gestalten und versenden — ohne Integration.** Wenn Sie einfach eine E-Mail brauchen — eine Kampagne, eine transaktionale Nachricht, einen Einzelfall — bauen Sie sie hier, sehen Sie sie live an und passen Sie sie an, exportieren Sie dann das **MJML/HTML** und versenden Sie es über Ihren Anbieter (Amazon SES, Postmark, Resend, Mailchimp, …). Sie fassen `@templatical/editor` nie an und schreiben keine Zeile Integrationscode — es ist ein komplettes Autoren-Werkzeug für jeden mit einem Coding-Agenten.

**Eine Hilfe zur Entwicklungszeit für eine Editor-Integration.** Wenn Sie den Editor in Ihre eigene App einbetten, ist der Skill der schnellste Weg, markenkonforme Start-Templates, Fixtures und Prototypen zu erzeugen — und danach, ohne das Werkzeug zu wechseln, den Mount selbst zu verdrahten. Ihre _Laufzeit_-Integration bleibt [`@templatical/editor`](/de/getting-started/quick-start) (Ihre Nutzer bauen E-Mails, Sie erhalten JSON) + [`@templatical/renderer`](/de/api/renderer-typescript) (JSON → MJML/HTML zum Versand) — den Skill selbst binden Sie nicht ein.

Für eine **„Mit KI erstellen"**-Funktion im Produkt (Ihre Nutzer geben einen Prompt ein und erhalten ein Template) ruft Ihr Backend ein LLM mit dem Block-Schema auf, validiert das Ergebnis mit [`@templatical/quality`](/de/quality/) und rendert es. Wenn Sie das nicht selbst bauen und hosten möchten, bietet [Templatical Cloud](/de/cloud/) verwaltete KI-Generierung und Zusammenarbeit.

Er fasst nie Git an.
