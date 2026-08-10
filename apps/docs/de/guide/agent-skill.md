---
title: KI-Agent-Skill
description: Gestalten Sie eine komplette E-Mail aus einem natürlichsprachlichen Prompt, sehen Sie sie im echten Editor an und exportieren Sie versandfertiges MJML/HTML — in Ihrem eigenen KI-Coding-Agenten. Kostenlos, quelloffen, ohne Backend und ohne API-Schlüssel.
---

# KI-Agent-Skill

Gestalten Sie eine komplette E-Mail, indem Sie sie einfach beschreiben — **kostenlos, quelloffen und vollständig in Ihrem eigenen KI-Coding-Agenten ausgeführt.** Der `templatical-email`-[Agent Skill](https://agentskills.io) bringt Ihrem Agenten bei, wie Templatical-Templates aufgebaut sind, sodass er gültige E-Mails erstellt, die Sie **im echten Editor ansehen und von Hand bearbeiten und dann als versandfertiges MJML oder HTML exportieren** können — bereit zum Versand über einen beliebigen Anbieter (Amazon SES, Postmark, Resend, Mailchimp, …) oder zum Laden in Ihre eigene [`@templatical/editor`](/de/getting-started/quick-start)-Integration.

Es gibt kein Backend und keinen API-Schlüssel: Ihr Agent ist die Inferenz. Nichts wird an Templatical gesendet.

**Zwei Einsatzmöglichkeiten:**

- **Gestalten und versenden** — bauen Sie eine E-Mail von Anfang bis Ende, sehen Sie sie live an und passen Sie sie an, exportieren Sie das HTML und versenden Sie es über Ihren E-Mail-Anbieter. Keine App, keine Integration, nichts einzubetten — Sie brauchen nur einen Coding-Agenten.
- **Als Entwicklerhilfe** — erzeugen Sie markenkonforme Start-Templates, Fixtures und Prototypen für Ihre eigene Editor-Integration. Siehe [Wo das passt](#wo-das-in-ihr-produkt-passt).

::: tip Lieber eine gehostete Lösung?
Ein KI-Chat direkt im Editor, feinabgestimmte Prompts und ein gehosteter MCP-Server sind Teil des [Templatical-Cloud](/de/cloud/)-Tarifs. Dieser Skill ist der offene, selbst gehostete Weg — bringen Sie Ihren eigenen Agenten mit und behalten Sie die volle Kontrolle.
:::

## Was Sie brauchen

Ein paar Dinge müssen auf Ihrem Rechner vorhanden sein, bevor Sie starten.

| | Was | Nötig für |
|---|---|---|
| **Ein Coding-Agent** | Einer, der [Agent Skills](https://agentskills.io) unterstützt und auf Ihrem eigenen Rechner läuft — Claude Code, Codex CLI, Cursor 2.4+, Gemini CLI, GitHub Copilot und weitere lesen alle `SKILL.md`. Er muss Befehle ausführen und Dateien schreiben dürfen. | Alles |
| **Node.js 20+** | Version 22 (LTS) empfohlen. Prüfen Sie es mit `node -v`; wenn dabei nichts oder eine Version unter 20 erscheint, installieren Sie es von [nodejs.org](https://nodejs.org). | Alles |
| **Ein moderner Browser** | Chrome/Edge 80+, Firefox 101+, Safari 16.4+ — haben Sie mit hoher Wahrscheinlichkeit bereits. | [Live-Vorschau](#live-vorschau) |
| **Eine Internetverbindung** | Die Live-Vorschau lädt den Editor und den HTML-Compiler von einem CDN. Das Erzeugen und Validieren von JSON funktioniert vollständig offline. | [Live-Vorschau](#live-vorschau) |
| **`npm`** | Lädt beim ersten Import den Konverter für Ihr Quellformat. Ist in Node.js enthalten. | [Import](#eine-bestehende-vorlage-importieren) |
| **`git`** | Um das Repository zu klonen, oder für die Plugin-Installation (der Marketplace ist ein Git-Repository). | Installation |

**Sonst nichts** — kein Templatical-Konto, kein API-Schlüssel, kein Backend und kein `npm install`, um ein Template zu erzeugen oder zu validieren.

Die Live-Vorschau benötigt einen Agenten auf Ihrem eigenen Rechner, da sie einen lokalen Server für Ihren Browser öffnet. Agenten, die entfernt laufen — ein browserbasierter Chat, eine Cloud-IDE, ein CI-Runner — können weiterhin JSON erzeugen und validieren, nur den Editor können sie Ihnen nicht zeigen.

## Installation

Der Skill ist ein Ordner mit einer `SKILL.md` — einem [offenen Standard](https://agentskills.io), den Claude Code, Codex CLI, Cursor, Gemini CLI und weitere lesen. Claude Code ist derzeit das einzige Werkzeug mit einem Paket-Installer, dort genügen zwei Befehle; überall sonst kopieren Sie den Ordner hinein.

### Claude Code

```text
/plugin marketplace add templatical/sdk
/plugin install templatical-email@templatical
```

Fügen Sie den Marketplace über das Git-Repository hinzu (nicht über eine rohe Datei-URL), damit die Quelle des Plugins aufgelöst wird. Aktualisierungen kommen über den Marketplace, es muss also später nichts erneut kopiert werden.

### Alle anderen Agenten

Klonen Sie das Repository einmalig:

```bash
git clone https://github.com/templatical/sdk.git
```

`~/.agents/skills/` ist der herstellerneutrale Ort, den Codex CLI, Gemini CLI und weitere standardmäßig lesen — eine Installation dort deckt sie alle ab:

```bash
mkdir -p ~/.agents/skills
cp -r sdk/skills/templatical-email ~/.agents/skills/
```

Für einen Agenten mit eigenem Verzeichnis, oder wenn Sie Skills getrennt halten möchten:

::: code-group

```bash [Codex CLI]
mkdir -p ~/.agents/skills
cp -r sdk/skills/templatical-email ~/.agents/skills/
```

```bash [Cursor]
mkdir -p ~/.cursor/skills
cp -r sdk/skills/templatical-email ~/.cursor/skills/
```

```bash [Gemini CLI]
mkdir -p ~/.gemini/skills
cp -r sdk/skills/templatical-email ~/.gemini/skills/
```

```bash [Claude Code]
# Nur falls Sie das Plugin oben übersprungen haben.
mkdir -p ~/.claude/skills
cp -r sdk/skills/templatical-email ~/.claude/skills/
```

```bash [Projektbezogen]
# Wird mit dem Repository eingecheckt, Teammitglieder erhalten ihn beim Klonen.
# .agents/skills/ für alle Agenten, oder .claude/skills/, .cursor/skills/, …
mkdir -p .agents/skills
cp -r /pfad/zu/sdk/skills/templatical-email .agents/skills/
```

:::

Um eine Kopie über mehrere Agenten hinweg aktuell zu halten, verlinken Sie sie statt zu kopieren:

```bash
ln -s ~/.agents/skills/templatical-email ~/.claude/skills/templatical-email
```

Kopien aktualisieren sich nicht von selbst — kopieren Sie sie nach einem Pull des Repositorys erneut.

Erkennt Ihr Agent den Skill nicht, prüfen Sie, ob der Ordner in einem Verzeichnis gelandet ist, das er tatsächlich liest, und ob der Skill in seiner Skill-Liste aktiviert ist.

## Verwendung

Beschreiben Sie die gewünschte E-Mail. Zum Beispiel:

> Gib mir eine Produktlaunch-E-Mail für eine Outdoor-Marke — ein Hero-Bild, eine kurze Einleitung und einen „Jetzt shoppen"-Button, in Waldgrün und mit einem warmen, neutralen Hintergrund.

Der Agent wird:

1. das Block-Schema und die mitgelieferten Beispiele des Skills lesen,
2. ein vollständiges Template als `{ blocks, settings }`-JSON erzeugen,
3. den mitgelieferten Validator selbst ausführen und die gemeldeten Struktur- oder Barrierefreiheitsprobleme beheben — so lange, bis das Template besteht,
4. Ihnen die fertige E-Mail übergeben — sehen Sie sie live an und verfeinern Sie sie (siehe unten), exportieren Sie dann **MJML/HTML zum Versand** oder laden Sie das JSON mit `editor.setContent(json)` in Ihre eigene Editor-Integration.

## Live-Vorschau

Sie müssen nicht beim JSON aufhören — Sie können das Template im **echten** Editor rendern sehen und es per Prompt weiter verfeinern. Bitten Sie darum, es **live zu zeigen** (oder „live in der Vorschau", „im Live-Modus bauen"), und der Skill:

1. öffnet eine Live-Vorschau in Ihrem Browser, die Ihr aktuelles Template im echten Editor zeigt.
2. aktualisiert sie bei jeder Änderung, die Sie prompten, **live** — ohne Neuladen.
3. lässt Sie auch **im Browser von Hand bearbeiten**; der Agent erkennt, wenn Sie abgewichen sind, und fragt, ob er auf Ihrer Version aufbauen oder sie ersetzen soll, bevor er überschreibt.

Bauen Sie zuerst in reinem JSON und wechseln Sie mitten in der Sitzung zu einer Live-Vorschau — sie knüpft genau dort an, wo Sie stehen. Jede Vorlage wird unter einem eigenen Namen gespeichert, und eine neue Sitzung beginnt mit einer frischen (bitten Sie darum, eine frühere Vorlage „fortzusetzen", um sie erneut zu öffnen). Der Live-Modus ist lokal und für einen einzelnen Nutzer — nicht der Echtzeit-Weg der [Cloud](/de/cloud/) — und benötigt nichts außer einem Coding-Agenten, der auf Ihrem eigenen Rechner läuft.

Wenn es passt, klicken Sie auf **Export** für das MJML oder HTML und versenden Sie es über Ihren Anbieter — das ist eine komplette E-Mail, von Anfang bis Ende, ohne eine Integration bauen zu müssen.

## Eine bestehende Vorlage importieren

Sie haben bereits eine Vorlage in einem anderen Editor? Der Skill kann **Unlayer**-, **BeeFree**- und **HTML**-E-Mails in Templatical-JSON umwandeln — zeigen Sie ihm die Datei, und er schreibt eine Arbeitsvorlage plus einen kurzen Bericht darüber, was sauber konvertiert wurde und was auf rohes HTML zurückgefallen ist (der Import ist naturgemäß verlustbehaftet). Sehen Sie sie sich anschließend live an und verfeinern Sie die groben Stellen zu nativen Blöcken. Um die Konverter direkt in Ihrem eigenen Code zu verwenden, siehe die Migrationsleitfäden: [Unlayer](/de/guide/migration-from-unlayer), [BeeFree](/de/guide/migration-from-beefree), [HTML](/de/guide/migration-from-html).

## Bringen Sie Ihre eigene Marke und Regeln mit

Der Skill definiert das _Format_ — den _Stil_ bringen Sie ein. Ergänzen Sie Ihren eigenen Kontext: Markenfarben und -schriften, Tonalität, einen eigenen System-Prompt, einen verpflichtenden Footer oder Abmelde-Block. Wenn Sie dem Agenten Ihre Markeneinstellungen mitgeben, verwendet er diese anstelle generischer Standardwerte.

Benutzerdefinierte Blöcke sind die einzige Ausnahme: Sie sind zur Laufzeit registrierte Erweiterungen des Konsumenten, daher erzeugt der Skill sie nicht aus einem Prompt. Siehe [Benutzerdefinierte Blöcke](/de/guide/custom-blocks).

## Template-JSON direkt validieren

Der Agent führt diesen Validator bereits selbst aus (Schritt 3 oben), Sie müssen es also nicht tun. Es ist aber ein einfaches Node-Skript, das Sie bei Bedarf auch selbst ausführen können — in CI oder um ein Template zu prüfen:

```bash
node scripts/validate.mjs pfad/zum/template.json
```

Es prüft jeden Block gegen seinen Typ im [Block-Schema](/de/guide/blocks) und meldet präzise Fehler (zum Beispiel `blocks[2] (button) must have required property 'url'`). Anschließend kommen Barrierefreiheits-, Struktur- und Link-Prüfungen hinzu. Exit-Code `0` bei Erfolg, `1` bei Fehler.

## Wie es korrekt bleibt

Das JSON-Schema des Skills wird direkt aus `@templatical/types` generiert — denselben Typen, die Editor und Renderer verwenden —, sodass es nie vom tatsächlichen Blockmodell abweicht. Details zur Neugenerierung und zu Beiträgen finden Sie in der [README des Skills](https://github.com/templatical/sdk/tree/main/skills/templatical-email).

## Wo das in Ihr Produkt passt

Der Skill deckt zwei sehr unterschiedliche Bedürfnisse ab.

**Eine E-Mail gestalten und versenden — ohne Integration.** Wenn Sie einfach eine E-Mail brauchen — eine Kampagne, eine transaktionale Nachricht, einen Einzelfall — bauen Sie sie hier, sehen Sie sie live an und passen Sie sie an, exportieren Sie dann das **MJML/HTML** und versenden Sie es über Ihren Anbieter (Amazon SES, Postmark, Resend, Mailchimp, …). Sie fassen `@templatical/editor` nie an und schreiben keine Zeile Integrationscode — es ist ein komplettes Autoren-Werkzeug für jeden mit einem Coding-Agenten.

**Eine Hilfe zur Entwicklungszeit für eine Editor-Integration.** Wenn Sie den Editor in Ihre eigene App einbetten, ist der Skill der schnellste Weg, markenkonforme Start-Templates, Fixtures und Prototypen zu erzeugen. Ihre _Laufzeit_-Integration bleibt [`@templatical/editor`](/de/getting-started/quick-start) (Ihre Nutzer bauen E-Mails, Sie erhalten JSON) + [`@templatical/renderer`](/de/api/renderer-typescript) (JSON → MJML/HTML zum Versand) — den Skill selbst binden Sie nicht ein.

Für eine **„Mit KI erstellen"**-Funktion im Produkt (Ihre Nutzer geben einen Prompt ein und erhalten ein Template) ruft Ihr Backend ein LLM mit dem Block-Schema auf, validiert das Ergebnis mit [`@templatical/quality`](/de/quality/) und rendert es. Wenn Sie das nicht selbst bauen und hosten möchten, bietet [Templatical Cloud](/de/cloud/) verwaltete KI-Generierung und Zusammenarbeit.
