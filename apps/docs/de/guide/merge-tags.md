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

## Beispielwerte

Ein Tag kann ein `sample` tragen — einen Beispielwert, den **Vorschauflächen** an seiner Stelle anzeigen, sodass eine Vorschau wie eine zugestellte E-Mail liest statt wie eine Liste von Feldnamen:

```ts
mergeTags: {
  tags: [
    { label: 'Vorname', value: '{{first_name}}', sample: 'Ada' },
    { label: 'Tarif', value: '{{plan_name}}', sample: 'Pro' },
  ],
}
```

`sample` zu setzen ist die vollständige Aktivierung — es gibt keinen zusätzlichen Schalter. Der Wert verlässt die Vorschau nie: er wird nicht in die Vorlage geschrieben, nicht von `getContent()` zurückgegeben, nicht versendet und erscheint nicht in der MJML-Ausgabe. Er wird außerdem im integrierten Picker angezeigt, sodass Autoren vor dem Einfügen sehen, was ein Tag darstellen wird.

**Wie Vorschauen ihn verwenden — der Umschalter Beispiel / Bezeichnung, welche Tags ihre Hervorhebung behalten und was im Bearbeitungs-Canvas passiert — ist unter [Vorschau-Rendering](/de/guide/preview-rendering) beschrieben.** Diese Seite dokumentiert auch `resolvePreview`, den Hook, mit dem Ihr eigenes Backend eine Vorschau auflöst — der einzige Weg, Logik-Tags auszuwerten.

## Syntax-Presets

Templatical enthält vier integrierte Syntax-Presets. Die Einstellung `syntax` teilt dem Editor mit, wie sowohl Daten-Tags als auch Logik-Tags im Inhalt erkannt und hervorgehoben werden sollen.

Jedes Preset definiert zwei Muster:
- **Daten-Tags** -- Variable Merge-Tags wie der Name oder die E-Mail eines Empfängers
- **Logik-Tags** -- Kontrollflussanweisungen wie Bedingungen und Schleifen

| Preset | Daten-Tag | Logik-Tag | Plattform |
|--------|----------|-----------|----------|
| `'liquid'` | <code v-pre>{{first_name}}</code> | `{% if vip %}` | Shopify, Jekyll, Django, Jinja2 |
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

## Tokens in geladenen Inhalten

Ein Merge-Tag liegt in gespeicherten Inhalten in einer von zwei physischen Formen vor:

- **Als Tag-Knoten** — `<span data-merge-tag="{{first_name}}">Vorname</span>`. Alles funktioniert: Er zeigt ein lesbares Label, wird hervorgehoben, löst seinen [Beispielwert](#beispielwerte) auf und lässt sich als eine Einheit auswählen und löschen.
- **Als reines Token** — der wörtliche Text `{{first_name}}` im HTML. Für sich genommen ist er nur Text: kein Label, keine Hervorhebung, kein Beispielwert, und er lässt sich Zeichen für Zeichen löschen.

Alles, was ein Benutzer tippt oder einfügt, wird automatisch zu einem Knoten. Als reines Token verbleibt nur Inhalt, der nie die Eingabeverarbeitung des Editors durchlaufen hat — eine Vorlage, die Sie aus Ihrem eigenen Speicher laden, oder eine, die von den [`@templatical/import-*`](/de/guide/migration-from-html)-Konvertern erzeugt wurde und typischerweise voller Tokens ist, von denen keines ein Knoten ist.

Der Editor wandelt reine Tokens in Tag-Knoten um, sobald Inhalt hereinkommt, sodass sich beide Formen nach dem Laden identisch verhalten. Das geschieht auf jedem Weg, über den Inhalt eintrifft — Sie müssen nichts aufrufen und nichts aktivieren:

| Weg | Zeitpunkt |
|---|---|
| `init({ content })` / `initCloud({ content })` | vor dem Mounten |
| `editor.setContent(content)` | bevor der Inhalt die Arbeitsfläche erreicht |
| `editor.create({ content })` | bevor der Inhalt zum Editor-Status wird |
| `editor.load(id)` | sobald das Ergebnis des [`templates`](/de/backend/templates)-Providers zurückkommt |
| Vorschau und Wiederherstellung der [Versionshistorie](/de/backend/version-history) | sobald eine Version die Arbeitsfläche erreicht |

Die Versionshistorie ist enthalten, weil eine gespeicherte Version genau das enthält, was in sie geschrieben wurde — auch eine Vorlage, die Ihr Backend direkt aus einem Import versioniert hat. Sie kann also wie jeder andere geladene Inhalt reine Tokens tragen. Das Öffnen einer Vorschau markiert die Vorlage nicht als geändert.

Die Erkennung richtet sich nach Ihrer konfigurierten `syntax`, nicht nach dem `tags`-Array. Dadurch werden die Tags einer migrierten Vorlage auch dann zu Einheiten, wenn Sie noch nicht alle deklariert haben. Ein nicht deklariertes Token zeigt seinen eigenen Rohwert als Label — ehrlich statt erfunden, und trotzdem als eine Einheit auswählbar. Das entspricht dem Tippen, wo dieselbe syntaxgesteuerte Regel bereits gilt.

### Was bewusst unangetastet bleibt

**Tokens in Attributposition.** Nur Text wird umgewandelt. Ein Token in einem `href`, `src` oder einem beliebigen anderen Attribut bleibt Byte für Byte identisch:

```html
<!-- vorher -->
<p>Hallo {{first_name}} — <a href="{{unsubscribe_url}}">abmelden</a></p>

<!-- nachher -->
<p>Hallo <span data-merge-tag="{{first_name}}">Vorname</span> —
   <a href="{{unsubscribe_url}}">abmelden</a></p>
```

Das `href` zu umschließen würde ein Element in eine URL einfügen. Die Umwandlung parst das Fragment und durchläuft ausschließlich Textknoten, sodass ein Attributwert konstruktionsbedingt unerreichbar ist.

**Felder mit einfachen Zeichenketten.** Nur `TitleBlock.content` und `ParagraphBlock.content` sind Rich Text. Schaltflächentext und -URLs, `src`/`alt` von Bildern, `HtmlBlock.content`, Feldwerte benutzerdefinierter Blöcke und `settings.preheaderText` werden als Text gerendert — ein dort eingefügter Span würde wörtlich angezeigt. Diese Felder behalten ihre reinen Tokens.

**Inhalt von Tabellenzellen.** Bewusst ausgenommen: Der Tabellenblock schreibt beim Verlassen einer Zelle deren `innerText` zurück, sodass eine umgewandelte Zelle ihr Markup beim ersten Fokussieren und Verlassen als wörtlichen Text speichern würde.

::: warning `getContent()` ist kein Byte-für-Byte-Roundtrip
Enthält eine geladene Vorlage reine Tokens in Titel- oder Absatzinhalten, gibt `getContent()` stattdessen Tag-Knoten zurück. Die Vorlage wird in Ihrem Speicher nicht verändert, solange Sie sie nicht speichern, und nichts wird als ungespeicherte Änderung markiert — wenn Sie gespeicherte Vorlagen jedoch vergleichen oder Prüfsummen bilden, rechnen Sie bei den betroffenen mit einer einmaligen Abweichung beim ersten Speichern.

Zwei Dinge sind ausdrücklich **nicht** betroffen: das gerenderte Ergebnis und der Versand. `toMjml()` / `toHtml()` ersetzen einen Tag-Knoten durch sein Token, sodass eine umgewandelte Vorlage und ihr Original mit reinen Tokens zu identischem Output kompilieren.
:::

::: tip Einen `resolvePreview`-Hook schreiben
Ihr [`resolvePreview`](/de/guide/preview-rendering)-Callback erhält Tag-Knoten, auch für Inhalt, der als reines Token in den Editor gelangt ist. Ein Resolver, der mit getippten Tags umgeht, braucht keinen Sonderfall. Ein naives `content.replaceAll('{{first_name}}', 'Grace')` trifft jedoch auch das Token innerhalb von `data-merge-tag="{{first_name}}"` und erzeugt stillschweigend ein Tag, das sein Label rendert. Gleichen Sie gegen das Tag-Markup ab, nicht gegen das rohe Token.
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
