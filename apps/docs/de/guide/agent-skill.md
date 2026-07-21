---
title: KI-Agent-Skill
description: Erstellen und validieren Sie Templatical-E-Mail-Templates aus einem natürlichsprachlichen Prompt mit Ihrem eigenen KI-Coding-Agenten — kostenlos, quelloffen, ohne Backend und ohne API-Schlüssel.
---

# KI-Agent-Skill

Erstellen Sie E-Mail-Templates aus einem natürlichsprachlichen Prompt — **kostenlos, quelloffen und vollständig in Ihrem eigenen KI-Agenten ausgeführt.** Der `templatical-email`-[Agent Skill](https://code.claude.com/docs/en/skills) bringt Claude Code, Cursor, Claude Desktop oder jedem Agent-Skills-kompatiblen Agenten bei, wie Templatical-Templates aufgebaut sind, sodass er gültiges Template-JSON erzeugt und es gegen das Block-Schema validiert. Anschließend laden Sie das Ergebnis in den Editor und verfeinern es wie jedes andere Template.

Es gibt kein Backend und keinen API-Schlüssel: Ihr Agent ist die Inferenz. Nichts wird an Templatical gesendet.

::: tip Lieber eine gehostete Lösung?
Ein KI-Chat direkt im Editor, feinabgestimmte Prompts und ein gehosteter MCP-Server sind Teil des [Templatical-Cloud](/de/cloud/)-Tarifs. Dieser Skill ist der offene, selbst gehostete Weg — bringen Sie Ihren eigenen Agenten mit und behalten Sie die volle Kontrolle.
:::

## Installation

### Claude Code (Plugin)

```text
/plugin marketplace add templatical/sdk
/plugin install templatical-email@templatical
```

Fügen Sie den Marketplace über das Git-Repository hinzu (nicht über eine rohe Datei-URL), damit die Quelle des Plugins aufgelöst wird. Der Skill wird automatisch aktiv, wenn Sie Claude Code bitten, eine Templatical-E-Mail zu erstellen.

### Beliebiger Agent (Ordner kopieren)

Das `SKILL.md`-Format ist ein offener Standard, daher funktioniert der Skill mit kompatiblen Agenten. Kopieren Sie ihn aus einem Klon des Repositorys in das Skills-Verzeichnis Ihres Agenten:

```bash
# Claude Code / Claude Desktop
cp -r skills/templatical-email ~/.claude/skills/
# Cursor
cp -r skills/templatical-email ~/.cursor/skills/
# OpenAI Codex (und andere Agenten, die das neutrale Agent-Skills-Verzeichnis lesen)
cp -r skills/templatical-email ~/.agents/skills/
```

Installieren Sie anschließend die einzige Abhängigkeit des Validators im kopierten Ordner:

```bash
npm install ajv
# optional — ergänzt Barrierefreiheits-, Struktur- und Link-Prüfungen:
npm install @templatical/quality
```

## Verwendung

Beschreiben Sie die gewünschte E-Mail. Zum Beispiel:

> Gib mir eine Produktlaunch-E-Mail für eine Outdoor-Marke — ein Hero-Bild, eine kurze Einleitung und einen „Jetzt shoppen"-Button, in Waldgrün und mit einem warmen, neutralen Hintergrund.

Der Agent wird:

1. das Block-Schema und die mitgelieferten Beispiele des Skills lesen,
2. ein vollständiges Template als `{ blocks, settings }`-JSON erzeugen,
3. den mitgelieferten Validator selbst ausführen und die gemeldeten Struktur- oder Barrierefreiheitsprobleme beheben — so lange, bis das Template besteht,
4. Ihnen das JSON übergeben — laden Sie es mit `editor.setContent(json)` (oder dem Äquivalent Ihres Frameworks) und verfeinern Sie es visuell.

## Bringen Sie Ihre eigene Marke und Regeln mit

Der Skill definiert das _Format_ — den _Stil_ bringen Sie ein. Ergänzen Sie Ihren eigenen Kontext: Markenfarben und -schriften, Tonalität, einen eigenen System-Prompt, einen verpflichtenden Footer oder Abmelde-Block. Wenn Sie dem Agenten Ihre Markeneinstellungen mitgeben, verwendet er diese anstelle generischer Standardwerte.

Benutzerdefinierte Blöcke sind die einzige Ausnahme: Sie sind zur Laufzeit registrierte Erweiterungen des Konsumenten, daher erzeugt der Skill sie nicht aus einem Prompt. Siehe [Benutzerdefinierte Blöcke](/de/guide/custom-blocks).

## Template-JSON direkt validieren

Der Agent führt diesen Validator bereits selbst aus (Schritt 3 oben), Sie müssen es also nicht tun. Es ist aber ein einfaches Node-Skript, das Sie bei Bedarf auch selbst ausführen können — in CI oder um ein Template zu prüfen:

```bash
node scripts/validate.mjs pfad/zum/template.json
```

Es prüft jeden Block gegen seinen Typ im [Block-Schema](/de/guide/blocks) und meldet präzise Fehler (zum Beispiel `blocks[2] (button) must have required property 'url'`). Wenn `@templatical/quality` installiert ist, kommen Barrierefreiheits-, Struktur- und Link-Prüfungen hinzu. Exit-Code `0` bei Erfolg, `1` bei Fehler.

## Wie es korrekt bleibt

Das JSON-Schema des Skills wird direkt aus `@templatical/types` generiert — denselben Typen, die Editor und Renderer verwenden —, sodass es nie vom tatsächlichen Blockmodell abweicht. Details zur Neugenerierung und zu Beiträgen finden Sie in der [README des Skills](https://github.com/templatical/sdk/tree/main/skills/templatical-email).

## Wo das in Ihr Produkt passt

Dieser Skill ist eine Hilfe zur **Entwicklungszeit**, keine Laufzeit-Integration. Ihre eigentliche Integration sind zwei Pakete: [`@templatical/editor`](/de/getting-started/quick-start), um den Editor einzubetten (Ihre Nutzer bauen E-Mails, Sie erhalten JSON), und [`@templatical/renderer`](/de/api/renderer-typescript), um dieses JSON in MJML/HTML zum Versand umzuwandeln. Den Skill selbst binden Sie nicht in Ihr Produkt ein.

Nutzen Sie den Skill beim _Bauen_ — um markenkonforme Start-Templates, Fixtures und Prototypen in Ihrem eigenen Coding-Agenten zu erzeugen.

Für eine **„Mit KI erstellen"**-Funktion im Produkt (Ihre Nutzer geben einen Prompt ein und erhalten ein Template) ruft Ihr Backend ein LLM mit dem Block-Schema auf, validiert das Ergebnis mit [`@templatical/quality`](/de/quality/) und rendert es. Wenn Sie das nicht selbst bauen und hosten möchten, bietet [Templatical Cloud](/de/cloud/) verwaltete KI-Generierung und Zusammenarbeit.

Ein hauseigener lokaler MCP-Server (`@templatical/mcp`) ist für **agentenbasierte** Integrationen geplant — er läuft lokal über stdio (kein Konto und kein Schlüssel nötig) und stellt Validieren / Rendern / Linten als aufrufbare Tools bereit. Bis er verfügbar ist, verwenden Sie die obigen Pakete direkt.
