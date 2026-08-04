---
title: Merge-Tags
description: Dynamische Inhalte mit Merge-Tags in Templatical-E-Mail-Templates.
---

# Merge-Tags

Merge-Tags sind Tokens für dynamische Inhalte -- zum Beispiel den Namen eines Empfängers, einen Produktpreis oder eine Abmelde-URL. Sie erscheinen als hervorgehobene Tokens im Editor und werden unverändert im gerenderten MJML durchgereicht. Ihre E-Mail-Versandplattform ersetzt sie beim Versand durch echte Werte.

Templatical bietet integrierte Syntax-Presets für beliebte Plattformen und unterstützt benutzerdefinierte Syntaxdefinitionen.

## Konfiguration

Übergeben Sie ein `tags`-Array, um Ihre Merge-Tags beim Editor zu registrieren. Wenn der Editor einen Merge-Tag-Wert im Inhalt erkennt (z. B. <code v-pre>{{first_name}}</code>), ersetzt er ihn visuell durch das menschenlesbare `label` ("First Name") — was das Template viel einfacher lesbar und bearbeitbar macht. Der Rohwert bleibt in der Ausgabe erhalten.

![Daten-Tag im Editor angezeigt](/images/data-tag.png)

Beim Hovern über ein Tag wird der Rohwert hinter dem Label angezeigt.

Die Eigenschaft `syntax` ist optional und standardmäßig `'liquid'`.

```ts
import { init } from '@templatical/editor';

const editor = await init({
  container: '#editor',
  mergeTags: {
    tags: [
      { label: 'First Name', value: '{{first_name}}' },
      { label: 'Last Name', value: '{{last_name}}' },
      { label: 'Email', value: '{{email}}' },
      { label: 'Company', value: '{{company.name}}' },
      { label: 'Unsubscribe URL', value: '{{unsubscribe_url}}' },
    ],
  },
});
```

## MergeTag-Typ

Jedes Tag wird mit einem Label (in der Editor-Oberfläche angezeigt) und einem Wert (der vollständige Merge-Tag-String einschließlich Trennzeichen) definiert. Zwei optionale Felder — `group` und `description` — werden vom integrierten Picker zur Gruppierung und Erklärung verwendet:

```ts
interface MergeTag {
  label: string;
  value: string;
  group?: string;        // optionale Gruppierung im Picker
  description?: string;  // optionaler Hilfetext im Picker
  sample?: string;       // optionaler Beispielwert für Vorschauen
}
```

Der `value` muss die Syntax-Trennzeichen enthalten. Zum Beispiel mit Liquid-Syntax:

<code v-pre>value: '{{first_name}}'</code>

Die Felder `group` und `description` sind ausschließlich für den Picker — sie erscheinen weder im Editor-Canvas, noch in der Autovervollständigung, noch in der gerenderten MJML-Ausgabe. Sie werden ignoriert, wenn Sie nur `onRequest` für die Tag-Auswahl verwenden.

## Beispielwerte in Vorschauen

Standardmäßig zeigt eine Vorschau die **Bezeichnung** jedes Tags — `First Name` statt des echten Empfängernamens. Das beantwortet die Frage „welches Feld steht hier?", liest sich aber nicht wie eine E-Mail, die jemand erhält. Geben Sie einem Tag ein `sample`, damit Vorschauen stattdessen diesen Wert anzeigen:

```ts
mergeTags: {
  tags: [
    { label: 'Vorname', value: '{{first_name}}', sample: 'Ada' },
    { label: 'Tarif', value: '{{plan_name}}', sample: 'Pro' },
  ],
}
```

`sample` zu setzen ist die vollständige Aktivierung — es gibt keinen zusätzlichen Schalter.

### Wo es greift

**Nur auf Vorschauflächen, niemals während der Bearbeitung.** Die Ersetzung geschieht im Vorschaumodus und in der Vorschau des Test-E-Mail-Dialogs; im Editor-Canvas zeigt ein Tag immer seine Bezeichnung, sodass Sie weiterhin das eingefügte Feld sehen und nicht einen Wert, den Sie nie eingegeben haben.

Ein Umschalter **Beispiel / Bezeichnung** erscheint neben dem Viewport-Umschalter, sobald eine Vorschau angezeigt wird. Die Wahl gilt für die Sitzung.

### Nichts erscheint, bis Sie ein `sample` konfigurieren

Der Umschalter erscheint **nur, wenn mindestens ein konfiguriertes Tag ein `sample` deklariert**, und nur dann starten Vorschauen in der Ansicht „Beispiel". Konfigurieren Sie keines, verhält sich der Editor genau wie zuvor — Ansicht „Bezeichnung", kein Umschalter. Die Funktion bleibt also unsichtbar, bis Sie sie aktivieren.

### Was sich visuell ändert

Die Hervorhebung folgt dem einzelnen Tag, nicht der Ansicht:

| | In der Ansicht „Beispiel" | In der Ansicht „Bezeichnung" |
| --- | --- | --- |
| Tag **mit** `sample` | der Beispielwert als gewöhnlicher Text — ohne Hervorhebung | die Bezeichnung, hervorgehoben |
| Tag **ohne** `sample` | die Bezeichnung, **hervorgehoben** | die Bezeichnung, hervorgehoben |

Eine gemischte Vorlage liest sich damit natürlich, wo Sie Daten hinterlegt haben, und bleibt sichtbar dynamisch, wo nicht — die verbleibenden Hervorhebungen sind gleichzeitig eine Liste der Tags, denen noch ein `sample` fehlt.

### Ausschließlich zur Anzeige

`sample` verlässt die Vorschau nie. Der Wert wird nicht in die Vorlage geschrieben, nicht in `getContent()` aufgenommen, nicht von der Test-E-Mail-Funktion versendet und erscheint nicht in der MJML- oder HTML-Ausgabe — dort steht immer das echte Token. Nichts, was Sie in ein `sample` schreiben, kann einen Empfänger erreichen.

Logik-Tags (`{% if %}` … `{% endif %}`) sind nicht betroffen: Die Ersetzung tauscht einen Wert aus, sie kann keine Verzweigung auswerten. Sie bleiben daher in beiden Ansichten als Schlüsselwort-Badges sichtbar. Um auch diese aufzulösen, siehe [Vorschau-Rendering](/de/guide/preview-rendering).

::: tip
`sample` wird auch im integrierten Picker angezeigt, sodass Autoren vor dem Einfügen sehen, was ein Tag darstellen wird.
:::

## Vorschauen mit echten Daten auflösen

::: tip Vollständige Anleitung
Dies ist eine Zusammenfassung. [**Vorschau-Rendering**](/de/guide/preview-rendering) behandelt alle drei Vorschau-Ebenen — Bezeichnungen, Beispielwerte und aufgelöste Daten —, wie sie zusammenspielen, sowie Anwendungsfälle wie die Auswahl einer Beispielzielgruppe durch den Nutzer.
:::

`MergeTag.sample` deckt Wert-Tags ab, kann aber **Logik-Tags** nicht auswerten — `{% if %}` … `{% endif %}`-Blöcke bleiben als Schlüsselwort-Badges sichtbar, denn einen Wert zu ersetzen ist nicht dasselbe wie eine Verzweigung auszuwerten. Bei Mailchimp- oder AMPscript-Syntax ist Verzweigung zudem ein serverseitiger Dialekt, den kein Browser auswerten kann.

Übergeben Sie `resolvePreview`, und Ihr eigenes Backend übernimmt das:

```ts
await init({
  container: '#editor',
  resolvePreview: async ({ content, recipient }) => {
    const res = await fetch('/api/resolve-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, recipient }),
    });
    if (!res.ok) throw new Error('Auflösen nicht möglich');
    return res.json(); // ein TemplateContent
  },
});
```

`initCloud()` akzeptiert **denselben Schlüssel mit demselben Typ** — die Option zu übernehmen oder zu entfernen ist in beide Richtungen eine Ein-Zeilen-Änderung. Sie ist nicht planabhängig: eine Vorschau aufzulösen ist eine Anzeigefrage.

### Wann sie ausgeführt wird

Beim Wechsel in den Vorschaumodus und — im Test-E-Mail-Dialog — bei jedem Empfängerwechsel. Mit 500 ms Verzögerung, und **niemals während der Bearbeitung**: das Canvas, in das Sie schreiben, zeigt immer das eingefügte Tag.

`recipient` ist nur dort vorhanden, wo eine Fläche einen Empfänger hat. Behandeln Sie das Fehlen als „kein bestimmter Empfänger" und geben Sie trotzdem darstellbaren Inhalt zurück.

### Während der Ausführung und bei Fehlern

Beim **ersten** Auflösen erscheint ein Platzhalter. Bei einem erneuten Auflösen bleibt das vorherige Ergebnis stehen, statt über bereits korrekten Inhalt zu blitzen.

Wenn Ihr Resolver abbricht — oder etwas zurückgibt, das kein `TemplateContent` ist — fällt die Vorschau auf die **unaufgelöste** Vorlage zurück und weist darauf hin. Ein Ausfall verschlechtert die Vorschau, macht sie aber nie leer oder kaputt. Fehler werden bewusst **nicht** an `onError` gemeldet: eine verschlechterte Vorschau ist sichtbar und nicht fatal.

Langsame Antworten werden verworfen, wenn eine neuere Anfrage sie überholt — ein zweifacher Empfängerwechsel kann also nicht die erste Antwort zuletzt anzeigen.

### Sie hat vollständig Vorrang vor Beispielwerten

Ein konfigurierter Resolver schaltet Beispielwerte **ab** — der Umschalter **Beispiel / Bezeichnung** erscheint überhaupt nicht, und der Vorschauhinweis nennt Ihr Backend als Datenquelle. Sind beide konfiguriert, gewinnt `resolvePreview`, ohne Möglichkeit zurückzuwechseln.

Das gilt ab dem ersten Frame, nicht erst wenn das erste Ergebnis vorliegt: Hätte man es an ein aufgelöstes Ergebnis gekoppelt, wäre der Umschalter für die Dauer der Verzögerung plus der Resolver-Latenz erschienen und dann verschwunden — das wirkt wie ein Fehler. Außerdem bleibt der Fehlerhinweis so korrekt: er sagt, dass die *unaufgelöste* Vorlage angezeigt wird, was nur zutrifft, wenn keine Beispielwerte in den Rückfall eingesetzt werden.

### Ausschließlich zur Anzeige

Aufgelöster Inhalt erreicht nur Vorschauflächen. Er wird nie in den Editor-Zustand geschrieben, nie von `getContent()` zurückgegeben, nie von der Test-E-Mail-Funktion versendet und nie exportiert — dort stehen immer die echten Tokens. Der an Ihren Resolver übergebene `content` ist eine Kopie; ihn zu verändern hat keine Wirkung auf den Editor.

## Syntax-Presets

Templatical enthält vier integrierte Syntax-Presets. Die Einstellung `syntax` teilt dem Editor mit, wie sowohl Daten-Tags als auch Logik-Tags im Inhalt erkannt und hervorgehoben werden sollen.

Jedes Preset definiert zwei Muster:
- **Daten-Tags** -- Variable Merge-Tags wie der Name oder die E-Mail eines Empfängers
- **Logik-Tags** -- Kontrollflussanweisungen wie Bedingungen und Schleifen

| Preset | Daten-Tag | Logik-Tag | Plattform |
|--------|----------|-----------|----------|
| `'liquid'` | <code v-pre>{{first_name}}</code> | <code v-pre>{% if vip %}</code> | Shopify, Jekyll, Django, Jinja2 |
| `'handlebars'` | <code v-pre>{{first_name}}</code> | <code v-pre>{{#if vip}}</code> | Handlebars.js, Mandrill |
| `'mailchimp'` | `*\|FIRST_NAME\|*` | `*\|IF:VIP\|*` | Mailchimp |
| `'ampscript'` | `%%=first_name=%%` | `%%[IF @vip]%%` | Salesforce Marketing Cloud |

```ts
mergeTags: {
  syntax: 'handlebars',
  tags: [
    { label: 'First Name', value: '{{first_name}}' },
  ],
}
```

## Hervorhebung von Logik-Tags

Neben Daten-Tags erkennt der Editor auch Logik-Tags -- bedingte Anweisungen, Schleifen und andere Kontrollflusssyntax, die von Ihrer E-Mail-Plattform verwendet wird. Diese werden automatisch mit dem `logic`-Regex-Muster aus dem ausgewählten Syntax-Preset erkannt.

Wenn ein Logik-Tag im Inhalt erkannt wird, extrahiert der Editor das Schlüsselwort (die erste Erfassungsgruppe aus der Logik-Regex) und zeigt es als Großbuchstaben-Abzeichen an -- zum Beispiel wird `{% if customer.vip %}` als **IF** gerendert und `{% endif %}` als **ENDIF**. Beim Hovern über das Abzeichen wird der vollständige Tag-Wert als Tooltip angezeigt. Benutzer können auf das Abzeichen klicken, um den Rohwert zu bearbeiten.

![Logik-Tag im Editor angezeigt](/images/logic-tags-selection-3.png)

Logik-Tags werden anders formatiert als Daten-Tags (umrahmtes Abzeichen mit Primärfarbe vs. gefüllter Hintergrund), sodass Template-Autoren auf einen Blick zwischen Daten-Tags und Kontrollfluss unterscheiden können.

Wie Daten-Tags werden Logik-Tags unverändert im gerenderten MJML durchgereicht — Ihre Versandplattform wertet sie zum Versandzeitpunkt aus.

::: tip Logik-Tags einfügen
Dieser Abschnitt behandelt die **Hervorhebung** — jedes Logik-Tag, das Sie tippen oder einfügen, wird automatisch erkannt. Um Benutzern das **Einfügen** von Logik-Tags ohne Tippen zu ermöglichen (eine eigene Schaltfläche **Logik**, Bedingungs-/Schleifenblöcke, die eine Auswahl umschließen), siehe den separaten Leitfaden [Logik-Tags](/de/guide/logic-tags). Logik wird unabhängig von Merge-Tags konfiguriert.
:::

Beispiele für Logik-Tags nach Preset:

::: code-group
```html [Liquid]
{% if customer.vip %}
  <p>Exclusive offer just for you!</p>
{% endif %}

{% for item in cart.items %}
  <p>{{item.name}} - {{item.price}}</p>
{% endfor %}
```
```html [Handlebars]
{{#if hasSubscription}}
  <p>Your plan renews on {{renewal_date}}</p>
{{/if}}

{{#each products}}
  <p>{{this.name}}</p>
{{/each}}
```
```html [Mailchimp]
*|IF:VIP|*
  <p>VIP discount applied</p>
*|END:IF|*
```
```html [AMPscript]
%%[IF @subscriber_type == "premium"]%%
  <p>Premium content here</p>
%%[ENDIF]%%
```
:::

## Benutzerdefinierte Syntax

Wenn die integrierten Presets nicht zu Ihrer Plattform passen, definieren Sie eine benutzerdefinierte Syntax mit zwei Regex-Mustern -- eines für Daten-Tags und eines für Logik-Tags:

```ts
interface SyntaxPreset {
  value: RegExp;  // matches data tags like ${user.name}
  logic: RegExp;  // matches logic tags like $[IF ...]
}
```

Beispiel für eine `${...}` / `$[...]`-Syntax:

```ts
mergeTags: {
  syntax: {
    value: /\$\{.+?\}/g,
    logic: /\$\[\s*(\w+).*?\]/g,
  },
  tags: [
    { label: 'User Name', value: '${user.name}' },
    { label: 'Order Total', value: '${order.total}' },
  ],
}
```

Die `value`-Regex erkennt Daten-Tags. Die `logic`-Regex erkennt Kontrollflussanweisungen — die erste Erfassungsgruppe `(\w+)` extrahiert das Schlüsselwort (z. B. `IF`, `FOR`), das der Editor als Anzeigelabel verwendet.

## Autovervollständigung

Wenn Benutzer den Syntax-Öffner (z. B. <code v-pre>{{</code> für Liquid/Handlebars, `*|` für Mailchimp, `%%=` für AMPscript) eingeben, zeigt der Editor ein Popup mit übereinstimmenden Tags aus dem konfigurierten `tags`-Array an. Das Auswählen eines Eintrags (Mausklick, `Enter` oder `Tab`) fügt es als Merge-Tag ein — dieselbe Form, die der Toolbar-Picker erzeugt. `Esc` oder ein Klick außerhalb schließt das Popup.

Die Autovervollständigung funktioniert sowohl in Titel- und Absatz-Rich-Text-Blöcken **als auch** in jedem Eingabe- und Textbereichsfeld mit Merge-Tag-Unterstützung (Schaltflächen- und Bild-URLs, Bild-Alt-Text, Video- und Menü-Links, Template-Einstellungen und Textfelder benutzerdefinierter Blöcke). Popup, Filterung, Tastaturnavigation und Positionierung sind auf beiden Oberflächen identisch.

Die Filterung ist nicht groß-/kleinschreibungsabhängig und gleicht sowohl `label` als auch `value` ab. Die Liste ist auf 10 Ergebnisse begrenzt.

Die Autovervollständigung ist standardmäßig aktiviert. Sie wird **automatisch deaktiviert**, wenn:

- `tags` leer ist (keine Kandidaten zum Vorschlagen) oder
- `syntax` eine benutzerdefinierte Regex ist (der Editor kann aus beliebigen Regex-Mustern keine Trigger-Zeichenkette ableiten).

Um sie explizit zu deaktivieren, setzen Sie `autocomplete: false`:

```ts
const editor = await init({
  container: '#editor',
  mergeTags: {
    autocomplete: false,
    tags: [
      { label: 'Vorname', value: '{{first_name}}' },
    ],
  },
});
```

Die Schaltfläche **Merge-Tag** in der Symbolleiste funktioniert weiterhin unabhängig von der Autovervollständigungs-Einstellung.

## Integrierter Picker

Wenn Sie `mergeTags.tags` ohne `onRequest`-Callback konfigurieren, öffnet ein Klick auf die Schaltfläche **Merge-Tag** in der Rich-Text-Symbolleiste (oder neben einem Texteingabefeld in der Seitenleiste) ein integriertes modales Picker-Fenster. Der Picker listet jedes Tag aus `tags` auf, unterstützt Tastaturnavigation und bietet ein Suchfeld, das gegen `label`, `value` und `description` filtert.

![Integrierter Merge-Tag-Picker](/images/merge-tag-picker.png)

Der Picker zeigt:

- das **Label** (fett)
- den rohen **Wert** (Monospace, gedimmt)
- die optionale **Beschreibung** (klein, gedimmt), sofern gesetzt

Wenn mindestens ein Tag ein `group`-Feld trägt, rendert der Picker sektionierte Überschriften in Einfügereihenfolge (der Reihenfolge in Ihrem `tags`-Array). Tags ohne `group` landen unter einer lokalisierten „Sonstige"-Überschrift. Wenn kein Tag eine `group` hat, rendert der Picker eine flache Liste — keine Überschriften, kein „Sonstige"-Eimer.

Während Sie tippen, werden Gruppen aufgelöst und die Liste gefiltert. Die Filterung ist nicht groß-/kleinschreibungsabhängig und gleicht Teilzeichenketten in `label`, `value` oder `description` ab. Beim Löschen der Suche wird das gruppierte (oder flache) Layout wiederhergestellt.

Ein-Schritt-Einfügen: Ein Klick auf eine Zeile oder das Drücken von `Enter` auf der hervorgehobenen Zeile fügt das Tag ein und schließt das Modal. `Esc`, das Schließen-Symbol im Header (×) oder ein Klick auf den Hintergrund schließen den Picker ohne Einfügen.

```ts
const editor = await init({
  container: '#editor',
  mergeTags: {
    tags: [
      {
        label: 'Vorname',
        value: '{{first_name}}',
        group: 'Empfänger',
        description: 'Persönliche Anrede',
      },
      {
        label: 'Nachname',
        value: '{{last_name}}',
        group: 'Empfänger'
      },
      {
        label: 'Unternehmen',
        value: '{{company.name}}',
        group: 'Konto'
      },
      {
        label: 'Abmelde-URL',
        value: '{{unsubscribe_url}}',
        description: 'Gesetzlich vorgeschrieben (Anti-Spam)',
      },
    ],
  },
});
```

## Dynamisches Tag-Laden

Für große oder kontextabhängige Tag-Listen verwenden Sie den `onRequest`-Callback anstelle von (oder zusätzlich zu) einem statischen `tags`-Array. Der Editor ruft diese Funktion auf, wenn der Benutzer klickt, um ein Merge-Tag einzufügen. Verwenden Sie sie, um ein benutzerdefiniertes Picker-Modal zu öffnen, verfügbare Merge-Tags von Ihrer API abzurufen oder eine kontextbezogene Tag-Liste basierend auf dem aktuellen Benutzer zu erstellen. Geben Sie das ausgewählte `MergeTag` oder `null` zurück, um abzubrechen.

```ts
const editor = await init({
  container: '#editor',
  mergeTags: {
    onRequest: async () => {
      const tag = await showMyMergeTagPicker();
      return tag; // MergeTag or null if cancelled
    },
  },
});
```

::: tip Vorrangregel
Wenn Sie sowohl `tags` als auch `onRequest` angeben, hat `onRequest` Vorrang — die Schaltfläche **Merge-Tag** ruft immer Ihren Callback auf. Das statische `tags`-Array versorgt weiterhin die Autovervollständigungs-Vorschläge beim Tippen.
:::

## Merge-Tags in anderen Eingaben

Merge-Tags sind nicht auf Titel- und Absatzblöcke beschränkt. Der Editor erkennt und hebt Merge-Tags auch in anderen Blockeingaben hervor — Schaltflächentext, Schaltflächen-URL, Bild-URL, Bild-Alternativtext und Link-href-Werte. Das gleiche Label-Ersetzungs- und Tooltip-Verhalten gilt in diesen Feldern.

<img src="/images/button-merge-tag.png" alt="Merge-Tag in einer Schaltflächen-URL" style="max-width: 360px;" />

## Merge-Tags außerhalb des Editors verwenden

Der Editor verwaltet Merge-Tags auf allen Oberflächen, die zu ihm gehören — Rich-Text-Blöcke, den Toolbar-Picker und die oben genannten weiteren Blockeingaben. Für Eingaben **außerhalb** des Editors, etwa ein Betreffzeilenfeld in Ihrer eigenen Anwendung, bauen Sie ein kleines eigenes Feld mit den Merge-Tag-Primitiven, die `@templatical/types` exportiert. Es sind dieselben Funktionen, die der Editor intern verwendet, sodass Ihr Feld konsistent mit der `syntax` bleibt, die Sie für den Editor konfiguriert haben.

Das Paket (MIT) exportiert das vollständige Toolkit:

- `SYNTAX_PRESETS` — die integrierten Syntaxdefinitionen (`liquid`, `handlebars`, `mailchimp`, `ampscript`)
- `getSyntaxTriggerChar` / `getSyntaxClosingChar` — die öffnenden/schließenden Trennzeichen eines Presets, für die Autovervollständigungs-Erkennung
- `isMergeTagValue`, `getMergeTagLabel`, `containsMergeTag` — Abgleich und Label-Auflösung
- `isLogicMergeTagValue`, `getLogicMergeTagKeyword` — dasselbe für Logik-Tags
- die Typen `MergeTag` und `SyntaxPreset`

### Einen gespeicherten Wert als Label-Chips darstellen

Teilen Sie eine Rohzeichenkette in Klartext und aufgelöste Tag-Labels auf — im Wesentlichen die Segmentierung des Editors selbst:

```ts
import { SYNTAX_PRESETS, getMergeTagLabel, type MergeTag } from '@templatical/types';

const syntax = SYNTAX_PRESETS.liquid;
const tags: MergeTag[] = [{ label: 'First name', value: '{{first_name}}' }];

function segments(value: string) {
  const re = new RegExp(syntax.value.source, 'g');
  const out: { text: string; isTag: boolean; label?: string }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    if (m.index > last) out.push({ text: value.slice(last, m.index), isTag: false });
    out.push({ text: m[0], isTag: true, label: getMergeTagLabel(m[0], tags) });
    last = m.index + m[0].length;
  }
  if (last < value.length) out.push({ text: value.slice(last), isTag: false });
  return out;
}

// segments('Hi {{first_name}}!') →
//   [ { text: 'Hi ', isTag: false },
//     { text: '{{first_name}}', isTag: true, label: 'First name' },
//     { text: '!', isTag: false } ]
```

### Autovervollständigung in einer einfachen Eingabe

Die Trennzeichen-Helfer halten Ihr eigenes Dropdown über alle Presets hinweg syntaxgenau:

```ts
import { SYNTAX_PRESETS, getSyntaxTriggerChar, getSyntaxClosingChar } from '@templatical/types';

const syntax = SYNTAX_PRESETS.liquid;
const open = getSyntaxTriggerChar(syntax);   // '{{'
const close = getSyntaxClosingChar(syntax);  // '}}'

// Prüfen Sie bei jedem Tastendruck den Text vor dem Cursor: Enthält er ein
// nicht geschlossenes `open`-Trennzeichen, nehmen Sie das Fragment danach als
// Suchbegriff und filtern Sie Ihre Tags in ein eigenes Dropdown.
```

Ein eigenes Feld bedeutet, dass es in Ihrem Framework gerendert wird, im Stil Ihres Designsystems und gegen Ihr eigenes Tag-Modell — was für etwas wie eine Betreffzeile in der Regel genau das ist, was Sie möchten.
