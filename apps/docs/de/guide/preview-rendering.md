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

Mit konfigurierten `mergeTags.tags` erscheint ein Tag als menschenlesbares `label` mit Hervorhebung, sodass die Vorlage wie Prosa statt wie Tokens liest. Logik-Tags erscheinen als Schlüsselwort-Badges — **IF**, **ENDIF**, **FOR**. Siehe [Merge-Tags](/de/guide/merge-tags) und [Hervorhebung von Logik-Tags](/de/guide/merge-tags#hervorhebung-von-logik-tags).

Das beantwortet die Frage *„welches Feld steht hier?"*. Es sagt nichts darüber, wie die E-Mail aussehen wird.

## Beispielwerte

Geben Sie einem Tag ein `sample`, und Vorschauen zeigen es anstelle der Bezeichnung:

```ts
mergeTags: {
  tags: [
    { label: 'Vorname', value: '{{first_name}}', sample: 'Ada' },
    { label: 'Tarif', value: '{{plan_name}}', sample: 'Pro' },
  ],
}
```

`sample` zu setzen ist die vollständige Aktivierung — es gibt keinen zusätzlichen Schalter. Zum Feld selbst siehe [Merge-Tags](/de/guide/merge-tags#beispielwerte).

### Der Umschalter Beispiel / Bezeichnung

Ein Umschalter **Beispiel / Bezeichnung** erscheint neben dem Viewport-Umschalter, sobald eine Vorschau angezeigt wird, sodass Nutzer zwischen der realistischen Ansicht und den Feldnamen wechseln können. Die Wahl gilt für die Sitzung.

Er erscheint **nur, wenn mindestens ein konfiguriertes Tag ein `sample` deklariert**, und nur dann starten Vorschauen in der Ansicht „Beispiel". Konfigurieren Sie keines, verhält sich der Editor genau wie zuvor — Ansicht „Bezeichnung", kein Umschalter. Die Funktion bleibt also unsichtbar, bis Sie sie aktivieren.

### Die Hervorhebung folgt dem Tag, nicht der Ansicht

| | In der Ansicht „Beispiel" | In der Ansicht „Bezeichnung" |
| --- | --- | --- |
| Tag **mit** `sample` | der Beispielwert als gewöhnlicher Text — ohne Hervorhebung | die Bezeichnung, hervorgehoben |
| Tag **ohne** `sample` | die Bezeichnung, **hervorgehoben** | die Bezeichnung, hervorgehoben |

Eine teilweise konfigurierte Vorlage liest sich damit natürlich, wo Sie Daten hinterlegt haben, und bleibt sichtbar dynamisch, wo nicht — die verbleibenden Hervorhebungen sind gleichzeitig eine Liste der Tags, denen noch ein `sample` fehlt.

**Beispielwerte können keine Logik auswerten.** Einen Wert zu ersetzen ist nicht dasselbe wie eine Verzweigung auszuwerten, daher bleiben `{% if %}` … `{% endif %}`-Blöcke als Badges sichtbar, egal wie viele Beispielwerte Sie setzen. Genau für diese Grenze existiert die nächste Ebene.

## Aufgelöste Daten mit `resolvePreview`

Übergeben Sie einen Callback, und Ihr eigenes Backend löst die Vorlage auf:

```ts
import { init } from '@templatical/editor';

await init({
  container: '#editor',
  resolvePreview: async ({ content, recipient }) => {
    const res = await fetch('/api/resolve-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, recipient }),
    });
    if (!res.ok) throw new Error('Vorschau konnte nicht aufgelöst werden');
    return res.json(); // ein TemplateContent
  },
});
```

`initCloud()` akzeptiert **denselben Schlüssel mit demselben Typ** — die Option zu übernehmen oder zu entfernen ist in beide Richtungen eine Ein-Zeilen-Änderung. Sie ist nicht planabhängig: eine Vorschau aufzulösen ist eine Anzeigefrage, keine Berechtigung.

### Warum ein Callback und keine integrierte Engine

Templatical unterstützt vier Merge-Tag-Syntaxen, und zwei davon — **Mailchimp** und **AMPscript** — drücken Verzweigungen in einem serverseitigen Dialekt aus, der sich im Browser nicht auswerten lässt, weder von uns noch von jemand anderem. Eine eigene Engine würde Logik für Liquid-Nutzer auflösen und für alle anderen nicht — schlechter als konsistentes Verhalten. Ihr Backend kennt Ihre Daten und Ihren Dialekt bereits; dieser Hook übergibt ihm die Vorlage.

### Was Sie erhalten

```ts
interface PreviewResolveContext {
  content: TemplateContent; // die Vorlage im aktuellen Stand, als Kopie
  recipient?: string;       // nur vorhanden, wo die Fläche einen Empfänger hat
}
```

`content` ist eine Kopie — sie zu verändern kann den Editor nicht beeinflussen. `recipient` ist im Test-E-Mail-Dialog vorhanden und im Vorschaumodus des Editors nicht; behandeln Sie das Fehlen als *„kein bestimmter Empfänger"* und geben Sie trotzdem darstellbaren Inhalt zurück.

Geben Sie ein `TemplateContent` zurück. Alles andere wird als Fehler behandelt (siehe unten).

### Wann sie ausgeführt wird

- **Sofort**, wenn eine Vorschau geöffnet wird. In diesem Moment gibt es nichts zusammenzufassen, daher ohne Verzögerung — der Platzhalter erscheint im selben Frame wie der Klick.
- **Mit 500 ms Verzögerung** bei erneutem Auflösen, was heute den Empfängerwechsel im Test-E-Mail-Dialog bedeutet. Schnelle Wechsel werden zu einem Aufruf zusammengefasst.
- **Niemals während der Bearbeitung.** Ein Editor, der nie in den Vorschaumodus wechselt, ruft Ihren Hook nie auf.

Beim **ersten** Auflösen erscheint ein Platzhalter. Bei einem erneuten Auflösen bleibt das vorherige Ergebnis stehen, statt einen Platzhalter über bereits korrekten Inhalt zu blitzen.

Langsame Antworten werden verworfen, wenn eine neuere Anfrage sie überholt — ein zweifacher Empfängerwechsel kann also nicht die erste Antwort zuletzt anzeigen.

### Wenn sie fehlschlägt

Wenn Ihr Callback abbricht — oder etwas zurückgibt, das kein `TemplateContent` ist — fällt die Vorschau auf die **unaufgelöste** Vorlage zurück und weist darauf hin. Ein Ausfall verschlechtert die Vorschau, macht sie aber nie leer oder kaputt.

Fehler werden bewusst **nicht** an `config.onError` gemeldet. Eine verschlechterte Vorschau ist für Nutzer sichtbar und nicht fatal; sie dort zu melden würde schwerwiegender wirken, als sie ist.

### Ausschließlich zur Anzeige

Aufgelöster Inhalt erreicht nur Vorschauflächen. Er wird nie in den Editor-Zustand geschrieben, nie von `getContent()` zurückgegeben, nie von der Test-E-Mail-Funktion versendet und nie exportiert — dort stehen immer die echten Tokens.

Das ist die Garantie, die es erlaubt, mit dem Hook kreativ zu sein: nichts, was Sie zurückgeben, kann einen Empfänger erreichen.

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

### Nutzer eine Beispielzielgruppe wählen lassen

Da der Callback `async` ist, können Sie **Ihre eigene UI** darin öffnen und erst nach der Auswahl auflösen. Wenn Sie verschiedene Arten von Abonnenten haben — kostenlos vs. Pro, Testphase vs. abgewandert, EU vs. USA — kann jemand so zwischen ihnen wechseln und jede Version der E-Mail sehen.

**Einmal fragen und die Auswahl zwischenspeichern.** Ein Resolver, der bei jedem Aufruf einen Dialog öffnet, fragt bei jedem erneuten Auflösen erneut — und schlimmer: überholt eine neuere Anfrage diejenige, deren Dialog offen ist, wird die Antwort beim Eintreffen verworfen und die Auswahl scheint wirkungslos.

```ts
let persona: Persona | null = null;

async function choosePersona(): Promise<Persona | null> {
  // Ihr eigener Dialog. Liefert die gewählte Persona oder null bei Abbruch.
  return openPersonaPicker();
}

// Ihre eigene Schaltfläche „Vorschau als …" kann den Cache leeren.
export function resetPersona() {
  persona = null;
}

const resolvePreview = async ({ content }) => {
  persona ??= await choosePersona();
  if (!persona) {
    // Abgebrochen. Ein Fehler zeigt die unaufgelöste Vorlage *mit* Hinweis;
    // `content` unverändert zurückzugeben zeigt sie ohne Hinweis.
    // Entscheiden Sie bewusst.
    return content;
  }
  return renderWithMyEngine(content, persona.data);
};
```

Während Ihr Dialog offen ist, zeigt die Vorschau ihren Platzhalter — genau richtig, denn sie ist tatsächlich noch nicht fertig.

### Anzeigebedingungen auswerten

[Anzeigebedingungen](/de/guide/display-conditions) lassen einen Block nur erscheinen, wenn eine Regel zutrifft. Im Editor *simuliert* ein Nutzer das per Klick auf das Filtersymbol des Blocks — nichts prüft die Regel gegen Daten. Ein Resolver kann es richtig machen: Blöcke weglassen, deren Bedingung für den Empfänger nicht zutrifft, sodass die Vorschau die echte Variante zeigt.

### Eine Template-Engine ausführen, die der Browser nicht kann

Wenn Ihre Tokens AMPscript- oder Mailchimp-Syntax sind, ist dies die einzige Möglichkeit, Verzweigungen überhaupt aufgelöst zu sehen. Senden Sie die Vorlage an den Dienst, der Ihre Aussendungen bereits rendert, und geben Sie dessen Ausgabe zurück.

### Live-Daten einbeziehen

Preise, Lagerbestände, ein personalisiertes Produktraster. Alles, worauf die Vorlage verweist, ohne es zu speichern, kann zum Vorschauzeitpunkt geladen werden — so spiegelt die Vorschau die Realität und nicht den Stand bei der Erstellung.

## Selbst ausprobieren

Der [Playground](https://play.templatical.com) verdrahtet einen simulierten Resolver **nur** in der Vorlage **Welcome Email** — er ersetzt Werte und wertet die `{% if plan_name == … %}`-Verzweigungen dieser Vorlage nach kurzer Verzögerung aus, sodass Sie den Platzhalter sehen und beobachten können, wie der Bedingungsblock auf den zutreffenden Zweig zusammenfällt.

Alle anderen Vorlagen lassen ihn aus und demonstrieren stattdessen den Umschalter Beispiel / Bezeichnung. Beide Vorlagen beschreiben in ihrem Panel „Was diese Vorlage zeigt", welche Funktion sie darstellen.

## Siehe auch

- [Merge-Tags](/de/guide/merge-tags) — Tags, Bezeichnungen und `sample`-Werte konfigurieren
- [Logik-Tags](/de/guide/logic-tags) — Kontrollfluss einfügen und hervorheben
- [Anzeigebedingungen](/de/guide/display-conditions) — Bedingungen simulieren und über diesen Hook echt auswerten
- [Test-E-Mails](/de/guide/test-email) — der Dialog, dessen Vorschau pro Empfänger auflöst
- [Editor-API](/api/editor) — Referenz für `resolvePreview` und `mergeTags`
