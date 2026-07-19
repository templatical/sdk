---
title: Lizenz-FAQ
description: Klare Antworten zu Templaticals Lizenzen FSL-1.1-MIT und MIT — was erlaubt ist, was nicht und wann FSL automatisch zu MIT wird.
---

# Lizenz-FAQ

Diese Seite beantwortet die Fragen, die Teams bei der Bewertung von Templaticals Lizenz am häufigsten stellen. Bewusst in klarer Sprache gehalten; falls Sie den formalen Wortlaut brauchen, sind die maßgeblichen Dokumente [`LICENSE`](https://github.com/templatical/sdk/blob/main/LICENSE) (FSL-1.1-MIT) und [`LICENSE-MIT`](https://github.com/templatical/sdk/blob/main/LICENSE-MIT) (MIT).

## Auf einen Blick

- **Sie können Templatical kostenlos in jedem kommerziellen Produkt einsetzen**, einschließlich kostenpflichtigem SaaS, internen Tools und On-Premise-Installationen.
- **Das Einzige, was Sie nicht dürfen**, ist Templatical selbst als konkurrierendes E-Mail-Editor-SaaS zu vermarkten.
- **Nach zwei Jahren** wird jede unter FSL veröffentlichte Version automatisch zu MIT. Keine Aktion erforderlich.
- **Vier der sieben Pakete sind heute schon reines MIT** — types, renderer und die BeeFree- und Unlayer-Importer.

## Was ist FSL-1.1-MIT?

FSL steht für [**Functional Source License**](https://fsl.software/). Eine moderne Open-Source-Lizenz, von Sentry entworfen, um zwei Dinge auszubalancieren, die Teams wichtig sind:

- **Freiheit** — der Code ist offen, Sie können ihn lesen, forken, modifizieren und weitergeben.
- **Nachhaltigkeit** — der Maintainer kann ein tragfähiges Geschäft drumherum aufbauen, ohne dass ein Cloud-Riese das Projekt als Managed Service neu verpackt.

FSL-1.1-**MIT** ist die Variante, die nach zwei Jahren automatisch zur MIT-Lizenz wird. Templatical ist also heute Open Source mit einer einzigen schmalen Einschränkung — und nach dem Stichtag vollständig MIT-lizenziertes Open Source.

## Welches Paket nutzt welche Lizenz?

| Paket | Lizenz |
|---|---|
| `@templatical/editor` | [FSL-1.1-MIT](https://github.com/templatical/sdk/blob/main/LICENSE) (wird nach 2 Jahren MIT) |
| `@templatical/core` | [FSL-1.1-MIT](https://github.com/templatical/sdk/blob/main/LICENSE) (wird nach 2 Jahren MIT) |
| `@templatical/media-library` | [FSL-1.1-MIT](https://github.com/templatical/sdk/blob/main/LICENSE) (wird nach 2 Jahren MIT) |
| `@templatical/types` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE-MIT) |
| `@templatical/renderer` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE-MIT) |
| `@templatical/import-beefree` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE-MIT) |
| `@templatical/import-unlayer` | [MIT](https://github.com/templatical/sdk/blob/main/LICENSE-MIT) |

Die Aufteilung sorgt dafür, dass alles, was Sie in Ihr eigenes Backend oder eine Codegen-Pipeline einbinden würden (Types, Renderer, Importer), unter permissiver MIT-Lizenz steht und keine Future-License-Überlegungen nötig sind.

## Darf ich Templatical kommerziell nutzen?

**Ja.** Sie können Templatical in jedes kommerzielle Produkt einbetten — kostenpflichtiges SaaS, interne Tools, On-Premise-Software, Agentur-Builds, was auch immer — ohne uns zu bezahlen und ohne um Erlaubnis zu fragen.

Die einzige Einschränkung steht in der LICENSE: Sie dürfen Templatical nicht nehmen, einen anderen Namen draufkleben und *das* als gehosteten E-Mail-Editor-Service anbieten, der mit uns konkurriert.

## Darf ich Templatical in mein SaaS einbetten?

**Ja.** Das ist der häufigste Anwendungsfall und ist vollständig erlaubt.

Konkret erlaubt:

- ✅ Den Editor in Ihr CRM, Ihre Marketing-Automation, Ihr Transactional-E-Mail-Tool, Ihre Newsletter-Plattform oder jedes Produkt einzubetten, in dem E-Mail-Komposition eine Funktion unter vielen ist.
- ✅ Ihren Kunden für die Nutzung Ihres Produkts Geld zu berechnen, einschließlich des eingebetteten Editors als Teil davon.
- ✅ Den Editor mit Ihrem Branding, Theme, eigenen Blöcken und Cloud-Funktionen anzupassen.
- ✅ Den Editor in einem internen Tool zu verwenden, das nie an externe Kunden ausgeliefert wird.

Konkret nicht erlaubt:

- ❌ Ein Produkt zu bauen, dessen primärer Zweck "Templatical, von Ihnen gehostet" ist und das mit unserem gemanagten Cloud-Tarif konkurriert.
- ❌ Templatical zu forken und den Fork als Drop-in-Ersatz für Templatical selbst kommerziell anzubieten.

Sind Sie sich nicht sicher, ob Ihr Anwendungsfall die Linie überschreitet, [öffnen Sie eine Diskussion](https://github.com/templatical/sdk/discussions) oder schreiben Sie an <licensing@templatical.com>. Lieber geben wir Ihnen vorher eine klare Antwort, als dass Unklarheit bleibt.

## Was bedeutet "konkurrierende Nutzung" konkret?

Eine "konkurrierende Nutzung" ist eine, bei der der E-Mail-Editor *das* Produkt ist. Ein paar Beispiele aus der Praxis:

| Anwendungsfall | Erlaubt? |
|---|---|
| Sie bauen Templatical in Ihr CRM ein, damit Nutzer Kampagnen-E-Mails verfassen | ✅ Ja — der Editor ist eine Funktion Ihres CRMs. |
| Sie integrieren Templatical in eine Transactional-E-Mail-API, damit Kunden Templates designen, bevor sie über Ihre API senden | ✅ Ja — der Editor ist eine Funktion Ihrer Sende-Plattform. |
| Sie bauen ein Newsletter-SaaS, in dem Templatical eines von mehreren Kompositionswerkzeugen ist | ✅ Ja — der Editor ist eine Funktion Ihres Newsletter-Produkts. |
| Sie betten den Editor in das interne Marketing-Portal Ihres Unternehmens ein | ✅ Ja — interne Nutzung ist uneingeschränkt. |
| Sie forken Templatical, branden es um und verkaufen Abos eines gehosteten Templatical-Klons | ❌ Nein — das ist ein konkurrierender Managed Service. |
| Sie bauen "Templatical Cloud, aber günstiger" und bieten es als SaaS an | ❌ Nein — das ist ein konkurrierender Managed Service. |

Die Faustregel: Wenn Sie Templatical aus Ihrem Produkt entfernen, haben Sie dann immer noch ein Produkt? Wenn ja, sind Sie auf der sicheren Seite.

## Wann wird FSL-Code zu MIT?

**Zwei Jahre nach jeder Veröffentlichung.** Jede FSL-lizenzierte Version von `@templatical/editor`, `@templatical/core` und `@templatical/media-library` wechselt automatisch zur MIT-Lizenz, zwei Jahre nach dem Veröffentlichungsdatum dieser konkreten Version.

Das heißt: Erscheint eine stabile Version Templatical 1.0 im Jahr 2026, wird genau diese Version 2028 MIT-lizenziert — automatisch, ohne dass jemand etwas tun muss. Neuere Versionen starten mit einer frischen Zwei-Jahres-Uhr.

In der Praxis bedeutet das: Sie haben immer eine vollständig MIT-lizenzierte Version des Codebase verfügbar — nur eben zwei Jahre hinter der neuesten Version.

## Warum nicht von Anfang an reines MIT?

Templatical wird hauptsächlich von einem Entwickler gebaut und gepflegt. Reines MIT würde bedeuten, dass ein gut finanzierter Wettbewerber Templatical morgen als Managed Service hosten und damit die Fähigkeit des Projekts untergraben könnte, seine eigene Entwicklung zu finanzieren — ohne im Gegenzug etwas beizutragen.

FSL-1.1-MIT hält den Code für alle mit legitimen Anwendungsfällen offen und forkbar (das sind im Prinzip alle, die das hier lesen) und verhindert genau das parasitäre Managed-Service-Szenario. Nach zwei Jahren entfällt diese Einschränkung automatisch und der Code ist vollständig MIT.

Denselben Ansatz nutzen [Sentry](https://sentry.io), [PowerSync](https://www.powersync.com), [GitButler](https://gitbutler.com) und andere, die nachhaltiges Open Source wollen, ohne proprietär zu werden.

## Darf ich zu Templatical beitragen?

**Ja, bitte.** Open-Source-Beiträge sind willkommen — Bugfixes, Features, Doku-Verbesserungen, zusätzliche Locales und Beispiele für eigene Blöcke werden geschätzt.

Mit Ihrem Beitrag stimmen Sie zu, dass Ihr Beitrag unter derselben Lizenz steht wie das Paket, zu dem Sie beitragen (MIT für `types`, `renderer`, `import-beefree`, `import-unlayer`; FSL-1.1-MIT für `editor`, `core`, `media-library`).

Es gibt derzeit **kein separates Contributor License Agreement (CLA)** zu unterschreiben — Ihr PR allein reicht.

Den vollständigen Beitragsleitfaden finden Sie in [`CONTRIBUTING.md`](https://github.com/templatical/sdk/blob/main/CONTRIBUTING.md).

## Muss ich einen Lizenzhinweis anzeigen?

**Ja, bei weitergegebenem Code.** Wenn Sie Templaticals Quellcode oder Build-Artefakte weitergeben, müssen Sie den Lizenzhinweis behalten. Das ist derselbe Standard wie bei jeder Open-Source-Lizenz.

Sie müssen **kein** "Powered by Templatical" oder einen für Endnutzer sichtbaren Hinweis im Editor anzeigen. Die Lizenz verlangt keine Namensnennung in der Editor-UI.

Standardmäßig zeigt der Editor einen kleinen "Powered by Templatical"-Footer im Canvas an. Sie können ihn ausblenden, indem Sie `branding: false` an `init()` übergeben:

```ts
await init({
  container: "#editor",
  branding: false, // blendet den Footer aus
});
```

Es gibt kein Header-Logo oder anderes erzwungenes Branding — der Footer ist die einzige Attributions-Stelle und kann optional deaktiviert werden.

## Muss ich den Cloud-Tarif nutzen?

**Nein.** Der Cloud-Tarif ist optional. Das OSS-SDK funktioniert komplett eigenständig — jede Funktion in `@templatical/editor` (der OSS-Init-Pfad) läuft ohne Backend.

Der Cloud-Tarif fügt KI-Umschreibung, Echtzeit-Zusammenarbeit, Kommentare, Snapshots und gespeicherte Module hinzu. Er befindet sich in Entwicklung und wird als gemanagter Dienst angeboten.

## Was, wenn ich eine Frage habe, die hier nicht beantwortet wird?

Für Lizenzfragen schreiben Sie an <licensing@templatical.com>. Für alles andere [öffnen Sie eine Diskussion](https://github.com/templatical/sdk/discussions) oder [erstellen Sie ein Issue](https://github.com/templatical/sdk/issues).

Falls Ihnen hier etwas unklar oder fehlend vorkommt, sagen Sie uns Bescheid — Klarheit nutzt allen.
