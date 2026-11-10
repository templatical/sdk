---
title: Vorschau-Rendering
description: Steuern Sie, was die Vorschauflächen des Editors anzeigen — Bezeichnungen, Beispielwerte oder echte Daten aus Ihrem Backend.
---

# Vorschau-Rendering

Eine Vorlage enthält vieles, was kein Inhalt ist: <code v-pre>{{first_name}}</code>, <code v-pre>{% if plan_name == 'pro' %}</code>. Der Editor muss dafür *etwas* anzeigen — und was er anzeigt, hängt davon ab, wie viel Sie ihm mitgeteilt haben.

Es gibt drei Ebenen, jede realistischer als die vorige. Alle gelten **nur für Vorschauflächen** — den Vorschaumodus des Editors und den Test-E-Mail-Dialog. Das Bearbeitungs-Canvas zeigt immer das eingefügte Tag, sodass Sie nie Text bearbeiten, den Sie nicht geschrieben haben.

| Ebene | Konfiguration | Eine Vorschau zeigt |
| --- | --- | --- |
| **Bezeichnungen** | keine — immer aktiv | `First Name`, hervorgehoben |
| **Beispielwerte** | `MergeTag.sample` | `Ada`, als gewöhnlicher Text |
| **Aufgelöste Daten** | `resolvePreview` | was Ihr Backend zurückgibt, Logik ausgewertet |

Spätere Ebenen gewinnen. Setzen Sie ein `sample`, verwenden Vorschauen es anstelle der Bezeichnung; konfigurieren Sie `resolvePreview`, hat es vollständig Vorrang vor Beispielwerten.

## Bezeichnungen (Standard)

Mit konfigurierten `mergeTags.tags` erscheint ein Tag als menschenlesbares `label` mit Hervorhebung, sodass die Vorlage wie Prosa statt wie Tokens liest. Logik-Tags erscheinen als Schlüsselwort-Badges — **IF**, **ENDIF**, **FOR**. Siehe [Merge-Tags](/de/guide/merge-tags) und [Hervorhebung von Logik-Tags](/de/guide/merge-tags#logic-tag-highlighting).

Das beantwortet die Frage *„welches Feld steht hier?"*. Es sagt nichts darüber, wie die E-Mail aussehen wird.

## Beispielwerte {#sample-values}

Geben Sie einem Tag ein `sample`, und Vorschauen zeigen es anstelle der Bezeichnung:

```ts
mergeTags: {
  tags: [
    { label: 'Vorname', value: '{{first_name}}', sample: 'Ada' },
    { label: 'Tarif', value: '{{plan_name}}', sample: 'Pro' },
  ],
}
```

[Im Playground öffnen](https://play.templatical.com/scenes/merge-tags-samples)

`sample` zu setzen ist die vollständige Aktivierung — es gibt keinen zusätzlichen Schalter. Zum Feld selbst siehe [Merge-Tags](/de/guide/merge-tags#sample-values).

### Der Umschalter Beispiel / Bezeichnung

Ein Umschalter **Beispiel / Bezeichnung** erscheint oben über der Arbeitsfläche, sobald eine Vorschau angezeigt wird, sodass Nutzer zwischen der realistischen Ansicht und den Feldnamen wechseln können. Die Wahl gilt für die Sitzung.

Er erscheint **nur, wenn mindestens ein konfiguriertes Tag ein `sample` deklariert**, und nur dann starten Vorschauen in der Ansicht „Beispiel". Konfigurieren Sie keines, verhält sich der Editor genau wie zuvor — Ansicht „Bezeichnung", kein Umschalter. Die Funktion bleibt also unsichtbar, bis Sie sie aktivieren.

### Die Hervorhebung folgt dem Tag, nicht der Ansicht

| | In der Ansicht „Beispiel" | In der Ansicht „Bezeichnung" |
| --- | --- | --- |
| Tag **mit** `sample` | der Beispielwert als gewöhnlicher Text — ohne Hervorhebung | die Bezeichnung, hervorgehoben |
| Tag **ohne** `sample` | die Bezeichnung, **hervorgehoben** | die Bezeichnung, hervorgehoben |

Eine teilweise konfigurierte Vorlage liest sich damit natürlich, wo Sie Daten hinterlegt haben, und bleibt sichtbar dynamisch, wo nicht — die verbleibenden Hervorhebungen sind gleichzeitig eine Liste der Tags, denen noch ein `sample` fehlt.

**Beispielwerte können keine Logik auswerten.** Einen Wert zu ersetzen ist nicht dasselbe wie eine Verzweigung auszuwerten, daher bleiben `{% if %}` … `{% endif %}`-Blöcke als Badges sichtbar, egal wie viele Beispielwerte Sie setzen. Genau für diese Grenze existiert die nächste Ebene.

## Aufgelöste Daten mit `resolvePreview` {#resolved-data-with-resolvepreview}

Übergeben Sie einen Callback, und Ihr eigenes Backend löst die Vorlage auf:

```ts
import { init } from '@templatical/editor';

await init({
  container: '#editor',
  resolvePreview: async ({ content, recipient, trigger }) => {
    const res = await fetch('/api/resolve-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, recipient, trigger }),
    });
    if (!res.ok) throw new Error('Vorschau konnte nicht aufgelöst werden');
    return res.json(); // ein TemplateContent
  },
});
```

[Im Playground öffnen](https://play.templatical.com/scenes/merge-tags-resolve-preview)

### Warum ein Callback und keine integrierte Engine

Der Editor **erkennt** Tags; er **wertet** sie nie aus. `mergeTags.syntax` besteht aus zwei Regex-Mustern — eines für Wert-Tags, eines für Logik-Tags — und mehr als dieses Erkennen braucht der Editor nicht, um sie hervorzuheben. Mehr tut er auch nicht: Logik-Tags werden unverändert in das gerenderte MJML durchgereicht und dort von dem System ausgewertet, das die E-Mail versendet.

Eine Verzweigung auszuwerten erfordert drei Dinge, die der Editor nicht hat — Ihre Daten, Ihre Template-Sprache und die Regeln, die festlegen, was eine Verzweigung bedeutet. Und `syntax` akzeptiert **Ihre eigenen Regexe**, die Menge der Sprachen, auf die Templatical gerichtet werden kann, ist also nicht begrenzt; es gibt keine Engine, die wir ausliefern könnten, die das abdeckt.

Deshalb übergibt der Hook die Vorlage dem System, das alle drei bereits besitzt. Was Ihre Aussendungen rendert, kann auch Ihre Vorschauen rendern.

### Was Sie erhalten

```ts
interface PreviewResolveContext {
  content: TemplateContent; // die Vorlage im aktuellen Stand, als Kopie
  recipient?: string;       // nur vorhanden, wo die Fläche einen Empfänger hat
  trigger: PreviewResolveTrigger; // Grund für den Aufruf
}

type PreviewResolveTrigger = 'open' | 'refresh' | 'recipient' | 'locale';
```

`content` ist eine Kopie — sie zu verändern kann den Editor nicht beeinflussen. Wenn `layout` gesetzt ist, ist `content` das zusammengesetzte Dokument. Siehe [Layout](/de/guide/layout). `recipient` ist im Test-E-Mail-Dialog vorhanden und im Vorschaumodus des Editors nicht. Das Fehlen bedeutet *„kein bestimmter Empfänger"*: Geben Sie Ihren eigenen Standard zurück oder ermitteln Sie selbst einen, zum Beispiel indem Sie auf Ihre eigene Auswahl warten (siehe [Nutzer eine Beispielzielgruppe wählen lassen](#let-the-user-pick-an-example-audience)). Das erforderliche Feld `trigger` zeigt an, ob neue Beispieldaten ausgewählt oder die aktuelle Auswahl wiederverwendet werden soll.

Geben Sie ein `TemplateContent` zurück. Alles andere wird als Fehler behandelt (siehe unten).

### Wann sie ausgeführt wird

- **`open`**, sofort beim Öffnen des Vorschaumodus oder des Test-E-Mail-Dialogs. Der Dialog übergibt den vorausgewählten Empfänger in diesem einen Aufruf.
- **`refresh`**, sofort beim Klick auf **Vorschau aktualisieren** oder beim Aufruf von `editor.refreshPreview()` durch den Host.
- **`recipient`**, nach 500 ms Verzögerung beim Wechsel des Test-E-Mail-Empfängers. Schnelle Wechsel werden zu einem Aufruf zusammengefasst.
- **`locale`**, sofort beim Wechsel der Template-Sprache während einer geöffneten Vorschau.
- **Niemals während der Bearbeitung.** Ein Editor, der nie in den Vorschaumodus wechselt, ruft Ihren Hook nie auf.

Die Schaltfläche **Vorschau aktualisieren** erscheint im Vorschaumodus und im Test-E-Mail-Dialog nur bei konfiguriertem `resolvePreview`. `refreshPreview(): void` aktualisiert den Dialog, solange er geöffnet ist, sonst den Vorschaumodus. Ohne geöffnete Vorschau, ohne Resolver oder nach dem Abbau des Editors bewirkt die Methode nichts. Eine Aktualisierung ersetzt auch eine ausstehende Empfängerauflösung.

Beim **ersten** Auflösen erscheint ein Platzhalter. Spätere Anfragen zeigen das letzte Ergebnis, bis sie abgeschlossen sind. Nach einem Fehler bleiben die unaufgelöste Vorlage und der Fehlerhinweis während der nächsten Anfrage sichtbar.

Langsame Antworten werden verworfen, wenn eine neuere Anfrage sie überholt — ein zweifacher Empfängerwechsel kann also nicht die erste Antwort zuletzt anzeigen.

### Wenn sie fehlschlägt

Wenn Ihr Callback abbricht — oder etwas zurückgibt, das kein `TemplateContent` ist — fällt die Vorschau auf die **unaufgelöste** Vorlage zurück und weist darauf hin. Das gilt auch nach einer erfolgreichen Auflösung: Eine fehlgeschlagene erneute Auflösung verwirft das ältere Ergebnis. Ein Ausfall verschlechtert die Vorschau, macht sie aber nie leer oder kaputt.

Fehler werden **nicht** an `config.onError` gemeldet. Eine verschlechterte Vorschau ist für Nutzer sichtbar und nicht fatal; sie dort zu melden würde schwerwiegender wirken, als sie ist.

### Ausschließlich zur Anzeige

Aufgelöster Inhalt erreicht nur Vorschauflächen. Er wird nie in den Editor-Zustand geschrieben, nie von `getContent()` zurückgegeben, nie von der Test-E-Mail-Funktion versendet und nie exportiert — dort stehen immer die echten Tokens.

Das ist die Garantie, die es erlaubt, mit dem Hook kreativ zu sein: nichts, was Sie zurückgeben, kann einen Empfänger erreichen.

### Prüfen {#check-it}

Öffnen Sie die Vorschau: Der Resolver wird einmal mit `trigger: "open"` aufgerufen. Klicken Sie auf **Vorschau aktualisieren**: Er wird erneut mit `trigger: "refresh"` aufgerufen, und die Vorschau zeigt, was dieser Aufruf zurückgibt.

## Anwendungsfälle

### Vorschau als bestimmter Empfänger

Der direkteste Fall. Der Test-E-Mail-Dialog übergibt die gewählte Adresse als `recipient`, sodass die Vorschau zeigt, was *diese Person* erhalten wird — mit ihrem Namen, ihrem Tarif, ihren ausgewerteten Verzweigungen.

```ts
resolvePreview: async ({ content, recipient }) => {
  const data = recipient
    ? await fetchSubscriber(recipient)
    : await fetchSampleSubscriber();
  return renderWithMyEngine(content, data);
},
```

### Nutzer eine Beispielzielgruppe wählen lassen {#let-the-user-pick-an-example-audience}

Da der Callback `async` ist, können Sie **Ihre eigene UI** darin öffnen und erst nach der Auswahl auflösen. Öffnen Sie die Auswahl bei `open` und `refresh`; verwenden Sie die aktuelle Auswahl bei `recipient` und `locale` erneut. Wenn Sie verschiedene Arten von Abonnenten haben — kostenlos vs. Pro, Testphase vs. abgewandert, EU vs. USA — kann jemand so zwischen ihnen wechseln und jede Version der E-Mail sehen. Die einfache Auswahl unten nutzt eine Browser-Eingabe; ersetzen Sie sie durch Ihren eigenen Dialog.

```ts
import { init } from '@templatical/editor';

let selectedAudience: string | null = null;

function openMyAudiencePicker(): string | null {
  return window.prompt('Beispielzielgruppe', selectedAudience ?? 'pro');
}

await init({
  container: '#editor',
  resolvePreview: async ({ content, recipient, trigger }) => {
    if (trigger === 'open' || trigger === 'refresh') {
      // Eine abgebrochene Auswahl behält die aktuelle Wahl.
      selectedAudience = openMyAudiencePicker() ?? selectedAudience;
    }
    if (!selectedAudience) return content;

    const res = await fetch('/api/resolve-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, recipient, audience: selectedAudience }),
    });
    if (!res.ok) throw new Error('Vorschau konnte nicht aufgelöst werden');
    return res.json();
  },
});
```

Während Ihre Auswahl bei der ersten Auflösung geöffnet ist, zeigt die Vorschau ihren Platzhalter; bei einer Aktualisierung bleibt die aktuelle Vorschau sichtbar. Solange noch keine Wahl getroffen wurde, zeigt die Rückgabe von `content` die unaufgelöste Vorlage ohne Fehlerhinweis.

### Anzeigebedingungen auswerten

[Anzeigebedingungen](/de/guide/display-conditions) lassen einen Block nur erscheinen, wenn eine Regel zutrifft. Im Editor *simuliert* ein Nutzer das per Klick auf das Filtersymbol des Blocks — nichts prüft die Regel gegen Daten. Ein Resolver kann es richtig machen: Blöcke weglassen, deren Bedingung für den Empfänger nicht zutrifft, sodass die Vorschau die echte Variante zeigt.

Solange Ihr Resolver die Vorschau liefert, tritt der manuelle Filter samt Wiederherstellungsschaltfläche zurück — Sie haben die Bedingungen gegen echte Daten geprüft, sodass ein von Hand ausgeblendeter Block genau die angeforderte Antwort überstimmen würde. Nichts geht verloren: die ausgeblendeten Blöcke sind zurück, sobald der Nutzer die Vorschau verlässt.

### Die Engine nutzen, die Ihre Aussendungen rendert

Irgendetwas rendert Ihre Aussendungen bereits — Ihre Versandplattform, Ihr eigener Dienst, eine Template-Engine auf Ihrem Server. Sie besitzt die Daten und spricht Ihre Template-Sprache. Die Vorlage dorthin zu senden und deren Ausgabe zurückzugeben lässt die Vorschau also von Grund auf mit der zugestellten E-Mail übereinstimmen, statt sie im Browser anzunähern.

Es ist außerdem der einzige Weg, wenn sich Ihre Template-Sprache im Browser überhaupt nicht auswerten lässt — was jede von Ihnen konfigurierte eigene `syntax` einschließt.

### Zeigen, was Ihre Plattform beim Versand anhängt

Wenn Ihre Anwendung jeder E-Mail nach dem Editor etwas hinzufügt — ein Marken-Abzeichen, eine rechtliche Fußzeile, einen Abmelde-Hinweis, eine Logo-Kopfzeile —, sieht die bearbeitende Person davon beim Schreiben nichts und erfährt nicht, wie die fertige Nachricht endet. Lassen Sie Ihr Backend dieselben Blöcke anhängen, die es auch tatsächlich anhängt, und die Vorschau zeigt die vollständige E-Mail.

```ts
resolvePreview: async ({ content, recipient }) => {
  // Ihr Backend löst die Vorlage auf und hängt dieselben Blöcke an wie
  // beim Versand — der Abmelde-Link ist also der echte dieses Empfängers.
  const res = await fetch("/api/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template: content, recipient }),
  });
  return res.json();
},
```

Geben Sie ein vollständiges `TemplateContent` zurück, nicht nur dessen `blocks`. Ein Objekt mit ausschließlich `blocks` wird akzeptiert — mehr prüft die Formatkontrolle nicht —, kommt aber ohne `settings` an, und der Vorschau fehlen dann Breite, Hintergrund und Schriften der Vorlage. Ansonsten werden die angehängten Blöcke wie alle anderen über die Leinwand gerendert und übernehmen Schriften und Link-Stile der Vorlage, die Dunkelmodus-Vorschau und den Viewport-Umschalter.

Serverseitig anzuhängen ist es, was beides im Gleichlauf hält. Die Blöcke sind genau einmal definiert — in dem Code-Pfad, der sie tatsächlich anhängt —, sodass die Vorschau nicht von der zugestellten E-Mail abweichen kann, wie es eine zweite Kopie im Browser täte. Außerdem sind die Werte damit aufgelöst statt angenähert: eine echte Abmelde-URL für `recipient` statt eines Tokens.

Doppelt anhängen können Sie dabei nicht. Aufgelöste Inhalte erreichen ausschließlich Vorschauflächen: was Ihr Endpunkt anhängt, wird nie von `getContent()` gespeichert, nie von `toMjml()` exportiert und ist nie Teil dessen, was die Test-E-Mail-Funktion versendet — nur Ihre Versand-Pipeline hängt tatsächlich etwas an.

### Live-Daten einbeziehen

Preise, Lagerbestände, ein personalisiertes Produktraster. Alles, worauf die Vorlage verweist, ohne es zu speichern, kann zum Vorschauzeitpunkt geladen werden — so spiegelt die Vorschau die Realität und nicht den Stand bei der Erstellung.

## Siehe auch

- [Merge-Tags](/de/guide/merge-tags) — Tags, Bezeichnungen und `sample`-Werte konfigurieren
- [Logik-Tags](/de/guide/logic-tags) — Kontrollfluss einfügen und hervorheben
- [Anzeigebedingungen](/de/guide/display-conditions) — Bedingungen simulieren und über diesen Hook echt auswerten
- [Test-E-Mails](/de/backend/test-email) — der Dialog, dessen Vorschau pro Empfänger auflöst
- [Editor-API](/de/api/editor) — Referenz für `resolvePreview` und `mergeTags`
