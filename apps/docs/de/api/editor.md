---
title: Editor-API
description: Vollständige Referenz für die init()-Funktion, TemplaticalEditorConfig und die TemplaticalEditor-Instanz.
---

# Editor-API

Der Haupteinstiegspunkt ist die `init()`-Funktion aus `@templatical/editor`.

## `init(config)`

Erstellt und hängt den Editor in ein Container-Element ein. Gibt ein Promise zurück, das aufgelöst wird, sobald der Editor bereit ist.

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: "#editor",
  content: savedTemplate,
  onChange(content) {
    // Automatisch speichern oder Zustand aktualisieren
  },
});
```

**Rückgabewert:** [`TemplaticalEditor`](#templaticaleditor)

## `unmount()`

Zerstört die Editor-Instanz und räumt Event-Listener auf.

```ts
import { unmount } from "@templatical/editor";

unmount();
```

## TemplaticalEditorConfig

| Property            | Type                                                              | Required | Beschreibung                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `container`         | `string \| HTMLElement`                                           | Ja       | CSS-Selektor oder DOM-Element, in das der Editor eingehängt wird. Im Standardmodus (Shadow DOM) muss es ein Element sein, das einen Shadow Root aufnehmen kann — `<div>` wird empfohlen. Siehe [Anforderungen an das Container-Element](#anforderungen-an-das-container-element) unten                                            |
| `shadowDom`         | `boolean`                                                         | Nein     | Mountet innerhalb eines Shadow DOM zur CSS-Isolation von der Host-Seite. Standardwert `true`. Auf `false` setzen, um stattdessen im Light DOM zu mounten (z. B. für `document.querySelector`-Zugriff auf Editor-Interna oder Firefox-<101 / Safari-<16.4-Unterstützung). Siehe [Shadow DOM](/de/guide/shadow-dom) für Kompromisse |
| `content`           | `TemplateContent`                                                 | Nein     | Anfänglicher Template-Inhalt. Standardmäßig ein leeres Template                                                                                                                                                                                                                                                                   |
| `onChange`          | `(content: TemplateContent) => void`                              | Nein     | Wird aufgerufen, wenn sich der Template-Inhalt ändert (entprellt)                                                                                                                                                                                                                                                                 |
| `onError`           | `(error: Error) => void`                                          | Nein     | Wird aufgerufen, wenn ein Fehler auftritt                                                                                                                                                                                                                                                                                         |
| `onDirtyChange`     | `(isDirty: boolean) => void`                                      | Nein     | Wird aufgerufen, wenn der Zustand „ungespeicherte Änderungen" umschlägt. Funktioniert mit und ohne `templates`-Provider — damit sichern Sie einen clientseitigen Router ab, den `beforeunload` nicht abdecken kann. Siehe [Speichern & Laden](/de/backend/templates#ungespeicherte-anderungen) |
| `templates`         | `TemplatesProvider`                                               | Nein     | Speicher-Backend für die Vorlage selbst — der Speicher-/Ladezyklus. Dasselbe Objekt trägt auch die Konfiguration `autoSave`, `unsavedChangesGuard` und `nameField` sowie die Events `onSaved` / `onCreated` / `onLoaded` — nichts davon bedeutet etwas ohne ein Ziel zum Speichern. Der Editor liefert Namensfeld, Speichern-Schaltfläche, Statusanzeige und Cmd+S; Sie liefern die Persistenz. Lassen Sie `templates` weg, ist die Funktion vollständig deaktiviert: kein Namensfeld, keine Speichern-Schaltfläche, keine Statusanzeige. Siehe [Speichern & Laden](/de/backend/templates) |
| `render`            | `RenderProvider`                                                  | Nein     | Rendering-Backend für `toMjml()` / `toHtml()`. Jede Methode (`toMjml`, `toHtml`, `compileMjml`) ist unabhängig optional und wird separat aufgelöst. Weglassen: `toMjml()` rendert lokal, `toHtml()` lehnt ab — das SDK bündelt keinen MJML-Compiler. Siehe [Rendering & Export](/de/backend/render) |
| `versionHistory`    | `VersionHistoryProvider`                                          | Nein     | Speicher-Backend für den Versionsverlauf der Vorlage — die früheren Stände, die Nutzende durchsehen, in der Vorschau ansehen und wiederherstellen können. Der Editor liefert das Header-Steuerelement, das Vorschaubanner und den Wiederherstellungsablauf; Sie liefern den Speicher. Dasselbe Objekt trägt auch die Events `onCreated` und `onRestored`. Er zeichnet nie selbst eine Version auf: Das entscheidet Ihr `templates.save`. Weglassen, um die Funktion vollständig zu deaktivieren. Siehe [Versionsverlauf](/de/backend/version-history) |
| `comments`          | `CommentsProvider`                                                | Nein     | Speicher-Backend für Review-Kommentare — Threads, die an einem Block oder der Vorlage hängen. Dasselbe Objekt trägt auch die Events `onCreated`, `onUpdated`, `onDeleted`, `onResolved` und `onUnresolved`. Der Editor liefert die Seitenleiste, den Editor, Auflösen/Antworten und die Block-Marker; Sie liefern die Persistenz. **Erfordert `user`**: ohne Identität meldet sich die Funktion als nicht verfügbar, statt anonyme Kommentare zu schreiben. Ein optionales `subscribe` schiebt entfernte Änderungen herein. Siehe [Kommentare](/de/backend/comments) |
| `user`              | `EditorUser`                                                      | Nein     | Wer den Editor benutzt — `{ id, name }`. Wird von jeder Funktion benötigt, die Arbeit einer Person zuordnet; heute ist das `comments`. Keine Sicherheitsgrenze: Die Angabe identifiziert die Person gegenüber der Oberfläche, im Browser dieser Person. Ordnen Sie Schreibvorgänge serverseitig der Sitzung zu, der Ihr Backend ohnehin vertraut |
| `changeDebounce`    | `number`                                                          | Nein     | Wie lange der Editor nach der letzten Änderung wartet, bevor `onChange` auslöst und, sofern `templates.autoSave` aktiv ist, bevor gespeichert wird. Ein Timer treibt beides, sodass er `onChange` auch ohne konfigurierten `templates`-Provider taktet. Standardwert `2000`. Siehe [Speichern & Laden](/de/backend/templates#autosave) |
| `onRequestMedia`    | `(context?: MediaRequestContext) => Promise<MediaResult \| null>` | Nein     | Wird aufgerufen, wenn der Benutzer ein Bild auswählen möchte. Gibt `{ url, alt? }` oder `null` zurück                                                                                                                                                                                                                             |
| `resolveImageUrl`   | `(src: string) => string \| null \| Promise<string \| null>`      | Nein     | Reiner Anzeige-Resolver für Bild-`src`-Werte: bildet einen kanonischen src auf eine Vorschau-URL für die Leinwand ab. Inhalt und `toMjml()`-Ausgabe behalten den kanonischen Wert. `null` zurückgeben, um den src unverändert zu verwenden. Wird einmal pro bestätigtem src aufgerufen (entprellt), pro src zwischengespeichert. Siehe [Bilder](/de/guide/images#reine-anzeige-aufloesung-von-bild-urls) |
| `mergeTags`         | `MergeTagsConfig`                                                 | Nein     | Merge-Tag-Konfiguration. Jedes Tag kann ein optionales `sample` tragen — einen Beispielwert, den Vorschauen an seiner Stelle anzeigen. Siehe [Merge-Tags](/de/guide/merge-tags) |
| `resolvePreview`    | `ResolvePreview`                                                  | Nein     | Löst die Vorlage für Vorschauflächen auf — typischerweise durch Auswerten von Logik-Tags mit echten Daten in Ihrem Backend. Nur zur Anzeige: nie in `getContent()`, im Versand oder im Export. Siehe [Vorschau-Rendering](/de/guide/preview-rendering) |
| `displayConditions` | `DisplayConditionsConfig`                                         | Nein     | Konfiguration für Anzeigebedingungen. Siehe [Anzeigebedingungen](/de/guide/display-conditions)                                                                                                                                                                                                                                    |
| `logicTags`         | `LogicTagsConfig`                                                 | Nein     | Konfiguration für Logik-Tags — Kontrollfluss Ihrer Template-Sprache (Bedingungen, Schleifen), inline im Rich Text und in Textfeldern eingefügt. Siehe [Logik-Tags](/de/guide/logic-tags)                                                                                                                                            |
| `customBlocks`      | `CustomBlockDefinition[]`                                         | Nein     | Definitionen für benutzerdefinierte Blocktypen. Siehe [Benutzerdefinierte Blöcke](/de/guide/custom-blocks)                                                                                                                                                                                                                        |
| `savedBlocks`       | `SavedBlocksProvider`                                             | Nein     | Speicher-Backend für gespeicherte Blöcke — wiederverwendbare Blockgruppen, die Nutzer speichern und erneut einfügen. Der Editor stellt die Oberfläche, Sie die Persistenz. Dasselbe Objekt trägt auch die Events `onCreated`, `onUpdated` und `onDeleted`. Weglassen deaktiviert die Funktion vollständig. `createLocalStorageSavedBlocksProvider()` bietet eine Variante ohne Backend. Siehe [Gespeicherte Blöcke](/de/backend/saved-blocks) |
| `testEmail`         | `TestEmailProvider`                                               | Nein     | Versand-Backend für Test-E-Mails — Nutzer senden sich die Vorlage zu, die sie bearbeiten. Der Editor stellt Auslöser, Dialog, Prüfung und Zustände; Sie stellen den Versand. Dasselbe Objekt trägt auch das Event `onSent`. Weglassen deaktiviert die Funktion vollständig. `allowedRecipients` schränkt nur die Auswahl ein und ist **keine** Sicherheitsgrenze — serverseitig prüfen. Siehe [Test-E-Mails](/de/backend/test-email) |
| `paletteBlocks`     | `string[]`                                                        | Nein     | Allowlist + Reihenfolge für die Block-Palette. Nur die aufgeführten Typen erscheinen, in dieser Reihenfolge; nicht aufgeführte integrierte Blöcke werden ausgeblendet. Integrierte Blöcke über ihren reinen Typ (`'image'`), benutzerdefinierte über den `custom:`-präfixierten Typ (`'custom:qrcode'`). Siehe [Block-Palette anpassen](#block-palette-anpassen) |
| `footerBlocks`      | `Block[]`                                                         | Nein     | Schreibgeschützte Blöcke, die nach den Blöcken der Vorlage gerendert werden. Nur zur Anzeige: nie in `getContent()`, im Versand oder im Export. Siehe [Inhalte anzeigen, die Ihre Anwendung anhängt](#inhalte-anzeigen-die-ihre-anwendung-anhaengt) |
| `htmlBlockPreview`  | `boolean \| { enabled: boolean }`                                 | Nein     | Rendert den Inhalt jedes HTML-Blocks als Live-Vorschau in der Leinwand — in einem sandboxed `<iframe>` ohne Skriptausführung — statt des statischen Platzhalters. Standardmäßig `false`. Nur Vorschau; der MJML-/HTML-Export rendert HTML-Blöcke unabhängig davon. Siehe [HTML-Blöcke in der Vorschau](#html-bloecke-in-der-vorschau) |
| `blockDefaults`     | `BlockDefaults`                                                   | Nein     | Standard-Property-Überschreibungen für neue Blöcke. Siehe [Standardwerte](/de/guide/defaults)                                                                                                                                                                                                                                     |
| `templateDefaults`  | `TemplateDefaults`                                                | Nein     | Standardeinstellungen für leere Templates. Siehe [Standardwerte](/de/guide/defaults)                                                                                                                                                                                                                                              |
| `fonts`             | `FontsConfig`                                                     | Nein     | Schriftart-Konfiguration. Siehe [Benutzerdefinierte Schriftarten](/de/guide/fonts)                                                                                                                                                                                                                                                |
| `colors`            | `ColorsConfig`                                                    | Nein     | Farbwähler-Palette. `presets` werden als anklickbares Raster in jedem Farbwähler gerendert; `allowCustom: false` beschränkt Autoren darauf. Siehe [Vordefinierte Farben](#vordefinierte-farben)                                                                                                                                   |
| `theme`             | `ThemeOverrides`                                                  | Nein     | Überschreibungen für Farb-Tokens. Unterstützt einen `dark`-Schlüssel für Dark-Mode-Überschreibungen. Siehe [Theming](/de/guide/theming)                                                                                                                                                                                           |
| `uiTheme`           | `'light' \| 'dark' \| 'auto'`                                     | Nein     | UI-Farbschema. `'auto'` folgt den Systemeinstellungen. Standardwert ist `'auto'`                                                                                                                                                                                                                                                  |
| `locale`            | `string`                                                          | Nein     | Locale-Code (z. B. `'en'`, `'de'`, `'pt-BR'`, `'es'`, `'ca'`, `'fr'`, `'nl'`). Standardwert ist `'en'`                                                                                                                                                                                                                                                                       |
| `branding`          | `boolean`                                                         | Nein     | Zeigt den "Powered by Templatical"-Footer. Standardwert `true`. Auf `false` setzen, um ihn auszublenden                                                                                                                                                                                                                           |
| `smallScreenNotice` | `boolean`                                                         | Nein     | Zeigt auf Viewports schmaler als ~768px einen Hinweis „Bitte größeren Bildschirm verwenden" anstelle des Editors. Standardwert `true`. Der Drag-and-Drop-Editor ist ein Desktop-Werkzeug und lässt sich auf einem Smartphone nicht sinnvoll darstellen. Auf `false` setzen, um den Editor bei jeder Breite zu rendern, wenn Sie kleine Bildschirme selbst behandeln |
| `lint`              | `LintOptions`                                                     | Nein     | Konfiguration des Template-Linters aus `@templatical/quality` (eine optionale Peer-Dependency). Ohne Angabe wird der Linter bei Bedarf geladen, sobald das Panel geöffnet wird. `disabled: true` überspringt den Import vollständig und blendet den Sidebar-Tab sowie die Inline-Marker aus. Siehe [Quality-Optionen](/de/quality/options) |

### Anforderungen an das Container-Element

Das Standard-Mount (Shadow DOM) ruft `attachShadow()` auf Ihrem Container auf, und die HTML-Spezifikation erlaubt Shadow Roots nur für eine feste Menge von Elementen. Verwenden Sie eines davon:

`<article>`, `<aside>`, `<blockquote>`, `<body>`, `<div>` (empfohlen), `<footer>`, `<h1>`–`<h6>`, `<header>`, `<main>`, `<nav>`, `<p>`, `<section>`, `<span>` sowie jedes von Ihnen definierte Custom Element.

**Nicht erlaubt:** `<table>`, `<tr>`, `<td>`, `<form>`, `<input>`, `<button>`, `<select>`, Listenelemente (`<ul>`, `<ol>`, `<li>`), `<iframe>`, ersetzte Elemente (`<img>`, `<video>` usw.). Die Übergabe eines dieser Elemente wirft eine `DOMException` aus `attachShadow()`.

Wenn Ihre Integration ein nicht unterstütztes Element verwenden muss (z. B. Mount in eine `<form>`-Zelle eines CMS-Layouts), übergeben Sie `shadowDom: false` — das Light-DOM-Mount akzeptiert jedes Element. Der Kompromiss ist die Host-CSS-Isolation, auf die Sie verzichten.

### Block-Palette anpassen

### Inhalte anzeigen, die Ihre Anwendung anhängt {#inhalte-anzeigen-die-ihre-anwendung-anhaengt}

Wenn Ihre Plattform jeder E-Mail nach dem Editor etwas hinzufügt — ein
Tarif-Abzeichen, eine rechtliche Zeile, einen Abmelde-Hinweis —, rendert
`footerBlocks` diese Inhalte am unteren Rand der Leinwand, damit die
bearbeitende Person sie sieht. Die Blöcke sind schreibgeschützt: Sie lassen sich
weder auswählen noch bearbeiten, verschieben oder löschen.

```ts
footerBlocks: [
  {
    id: "platform-footer",
    type: "html",
    props: { html: '<p style="text-align:center">Gesendet mit Acme</p>' },
  },
]
```

Sie werden inline im E-Mail-Rahmen gerendert, mit den Schriften und Link-Stilen
der Vorlage, damit sie wie ein Teil der Nachricht wirken und nicht wie eine
separate Karte.

Sie dienen **nur zur Anzeige**: nie in `getContent()`, `toMjml()`, im Versand
oder im Export. Die gespeicherte Vorlage bleibt also genau das, was die
bearbeitende Person verfasst hat.

Das ist Absicht, und darum ist es nicht dasselbe, wie den Block in die Vorlage
zu legen und zu sperren. Ein Block in der Vorlage wird gespeichert und friert
damit den Stand des letzten Speicherns ein — hängt das Abzeichen am Tarif, wird
es nach einem Upgrade weiterhin mitgesendet. Und eine clientseitige Sperre ist
keine Garantie, sobald dieselben Inhalte über Ihre API beschreibbar sind. Hängen
Sie den Footer weiterhin dort an, wo Sie es beim Versand ohnehin tun;
`footerBlocks` zeigt lediglich, was dieser Schritt ergänzt.

Standardmäßig listet die Seitenleisten-Palette jeden integrierten Blocktyp auf. Übergeben Sie `paletteBlocks`, um die Palette auf eine bestimmte Menge zu beschränken und ihre Reihenfolge zu steuern — nützlich, um nicht verwendete Blocktypen (`video`, `table`, …) auszublenden oder einen häufig genutzten [benutzerdefinierten Block](/de/guide/custom-blocks) über die integrierten Blöcke zu stellen.

```ts
const editor = await init({
  container: "#editor",
  customBlocks: [qrCodeDefinition],
  paletteBlocks: [
    "section",
    "title",
    "paragraph",
    "image",
    "custom:qrcode", // ein benutzerdefinierter Block, zwischen integrierten Blöcken
    "button",
  ],
});
```

- **Strikte Allowlist + Reihenfolge.** Es werden nur die aufgeführten Typen angezeigt, in genau dieser Reihenfolge. Jeder nicht aufgeführte integrierte Block (hier `divider`, `video`, `social`, `menu`, `table`, `spacer`, `html`) wird aus der Palette ausgeblendet.
- **Integrierte Blöcke über ihren reinen Typ** (`"section"`, `"image"`, …) und **benutzerdefinierte Blöcke über ihren `custom:`-präfixierten Typ** (`"custom:qrcode"`) referenzieren, sodass beide frei vermischt werden können.
- **Unbekannte Einträge werden übersprungen.** Ein Tippfehler, ein nicht registrierter benutzerdefinierter Block oder `countdown` außerhalb eines Cloud-Plans wird mit einer Warnung in der Konsole protokolliert und nicht in die Palette aufgenommen.
- **Das Filtern der Palette wirkt sich nie auf das Rendering aus.** Das Ausblenden eines Blocktyps entfernt ihn nur aus der Palette — vorhandener Inhalt, der diesen Typ bereits verwendet, wird weiterhin korrekt gerendert. `paletteBlocks` steuert, was Benutzer _einfügen_ können, nicht, was der Editor _anzeigen_ kann.

Lassen Sie `paletteBlocks` weg (oder übergeben Sie ein leeres Array), um die vollständige Standard-Palette anzuzeigen.

### HTML-Blöcke in der Vorschau {#html-bloecke-in-der-vorschau}

Standardmäßig zeigt ein HTML-Block in der Leinwand eine Platzhalterkarte an, anstatt sein Markup zu rendern — der Inhalt wird erst beim Export realisiert. Setzen Sie `htmlBlockPreview`, um den Inhalt jedes HTML-Blocks stattdessen live in der Leinwand zu rendern:

```ts
const editor = await init({
  container: "#editor",
  htmlBlockPreview: true, // Kurzform für { enabled: true }
});
```

- **Standardmäßig aus.** Lassen Sie die Option weg (oder übergeben Sie `false` / `{ enabled: false }`), um den statischen Platzhalter beizubehalten.
- **In einem sandboxed `<iframe>` gerendert.** Der Inhalt wird unverändert in einem `<iframe sandbox="allow-same-origin">` **ohne** `allow-scripts` angezeigt — Skripte und Inline-Event-Handler werden nie ausgeführt, und die Styles des Fragments können nicht in den Rest des Editors gelangen. So wird verhindert, dass beliebiges oder von Mitarbeitenden erstelltes HTML im Origin Ihrer App ausgeführt wird.
- **Nur Vorschau.** Diese Einstellung steuert die Editor-Leinwand, nicht die Ausgabe — `renderToMjml()` / `editor.toMjml()` rendern HTML-Blöcke unabhängig davon.

### Vordefinierte Farben {#vordefinierte-farben}

Jeder Farbwähler im Editor — Block-Symbolleisten, Template-Einstellungen, Rich-Text-Farbe, Farbfelder benutzerdefinierter Blöcke — öffnet ein Popover mit einem Farbrad und einem Hex-Eingabefeld. Übergeben Sie `colors`, um diesem Popover eine Reihe vordefinierter Farben hinzuzufügen und optional die freien Eingabefelder zu entfernen. Die Konfiguration ist die Grundlage für jeden Farbwähler; das Farbfeld eines benutzerdefinierten Blocks kann sie für sich selbst weiter einschränken (siehe den letzten Punkt):

```ts
const editor = await init({
  container: "#editor",
  colors: {
    presets: ["#0b5cff", "#111827", "#6b7280", "#ffffff"],
    allowCustom: false,
  },
});
```

- **`presets`** — Hex-Zeichenketten, die als anklickbares Raster gerendert werden. Ein Klick übernimmt die Farbe; die vordefinierte Farbe, die dem aktuellen Wert entspricht, wird als ausgewählt markiert. Ergänzt das Farbrad und das Hex-Eingabefeld. Jeder Eintrag muss eine `#rgb`- oder `#rrggbb`-Hex-Zeichenkette sein — 4-/8-stellige Alpha-Hex-Werte und andere Formate werden übersprungen und mit einer Konsolenwarnung protokolliert, die die betreffenden Einträge auflistet.
- **`allowCustom`** — standardmäßig `true`. Auf `false` gesetzt (zusammen mit `presets`) werden das Farbrad und das Hex-Eingabefeld ausgeblendet, sodass Autoren nur aus der Palette wählen können — nützlich beim Einbetten des Editors als White-Label- / Brand-Kit-Werkzeug. In diesem gesperrten Modus beginnt die Palette mit einem „Keine Farbe“-Feld, das den nicht gesetzten (geerbten) Zustand wiederherstellt, da die Schaltfläche zum Löschen des Hex-Eingabefelds ausgeblendet ist. Ebenfalls im gesperrten Modus protokolliert der Editor eine Entwicklungswarnung, wenn eine Farbe aus `blockDefaults` / `templateDefaults` außerhalb von `presets` liegt — neue Blöcke würden sonst mit einer Farbe beginnen, die kein Farbwähler erneut auswählen kann; setzen Sie diese Standardwerte daher aus derselben Palette. Wird mit einer Warnung ignoriert, wenn keine `presets` konfiguriert sind, da der Farbwähler sonst keine Möglichkeit hätte, eine Farbe festzulegen.
- **Einschränkung auf Feldebene.** Das `color`-Feld eines benutzerdefinierten Blocks kann eigene `presets` / `allowCustom` mitbringen — siehe [vordefinierte Farben pro Feld](/de/guide/custom-blocks#color). Ein Feld darf eine eigene Palette vorgeben oder einzeln gesperrt werden, während der übrige Editor freie Eingaben zulässt; seine `presets` ersetzen dieses Raster für dieses Feld, statt eine Schnittmenge damit zu bilden, sodass ein gesperrtes Feld Farben anbieten kann, die in diesen `presets` überhaupt nicht vorkommen. Was ein Feld nie kann, ist den Editor entsperren — `allowCustom: false` sperrt hier weiterhin jeden Farbwähler.

## TemplaticalEditor

Das von `init()` zurückgegebene Objekt.

### `getContent()`

Gibt den aktuellen Template-Inhalt als `TemplateContent`-Objekt zurück.

```ts
const content = editor.getContent();
// { blocks: [...], settings: { width: 600, ... } }
```

### `setContent(content)`

Ersetzt den Editor-Inhalt.

```ts
import { createDefaultTemplateContent } from "@templatical/types";

editor.setContent(createDefaultTemplateContent());
```

### `setTheme(theme)`

Wechselt das UI-Farbschema zur Laufzeit, ohne den Editor neu zu initialisieren.

```ts
editor.setTheme("dark");
editor.setTheme("light");
editor.setTheme("auto"); // folgt der Systemeinstellung
```

**Parameter:** `theme: 'light' | 'dark' | 'auto'`

### `unmount()`

Zerstört diese Editor-Instanz.

### `create(input?)` / `load(id)` / `save()`

Der Speicher-/Ladezyklus der Vorlage, über den `templates`-Provider.

```ts
const template = await editor.create({ name: "Willkommens-E-Mail" });
await editor.load(template.id);
await editor.save();
```

- **`create(input?)`** speichert den aktuellen Inhalt als neue Vorlage und übernimmt das Ergebnis. Übergeben Sie `content`, um zuvor den Inhalt des Editors zu ersetzen.
- **`load(id)`** holt eine Vorlage und macht sie zum Inhalt des Editors; lokale Änderungen werden verworfen.
- **`save()`** speichert Name und Inhalt der geladenen Vorlage als einen Patch.

Alle drei geben ein `Promise<Template>` zurück und sind stets im Typ vorhanden. Sie werden mit einer erklärenden Fehlermeldung abgelehnt, wenn kein `templates`-Provider konfiguriert ist, wenn der Provider die jeweilige Methode zurückhält (`create: false` / `save: false`) oder — bei `save()` — wenn noch nichts erstellt oder geladen wurde. Siehe [Speichern & Laden](/de/backend/templates).

### `isDirty()`

Ob es Änderungen gibt, von denen der Editor weiß, dass sie nicht gespeichert sind. Wird durch ein erfolgreiches `save()`, `create()` oder `load()` zurückgesetzt.

```ts
router.beforeEach((to, from, next) => {
  if (editor.isDirty() && !confirm("Ungespeicherte Änderungen verwerfen?"))
    return next(false);
  next();
});
```

`onDirtyChange` ist das gegenläufige Push-Pendant.

### `toMjml()`

Rendert den aktuellen Inhalt in MJML-Markup. Gibt ein `Promise<string>` zurück, da das Auflösen benutzerdefinierter Blöcke asynchrone Arbeit erfordern kann (der Liquid-Renderer des Editors wird bei Bedarf geladen).

```ts
const mjml = await editor.toMjml();
```

Löst zuerst `render.toMjml` auf, wenn ein [`render`-Provider](/de/backend/render) es bereitstellt, danach den lokalen `@templatical/renderer`. Lehnt mit einem klaren Fehler ab, wenn keines von beiden verfügbar ist — der Renderer ist eine optionale Peer-Abhängigkeit, installieren Sie ihn also für lokalen MJML-Export. Siehe [Installation](/de/getting-started/installation).

### `toHtml()`

Rendert den aktuellen Inhalt in versandfertiges HTML.

```ts
const html = await editor.toHtml();
```

Löst zuerst `render.toHtml` auf, danach die Ausgabe von `toMjml()` über `render.compileMjml`. **Eines von beiden ist erforderlich**: Das SDK bündelt keinen MJML-Compiler, ohne `render`-Provider lehnt dieser Aufruf also immer ab, und der Fehler nennt die zu ergänzende Methode. Siehe [Rendering & Export](/de/backend/render).

::: tip Cloud-Editor
Der Cloud-Editor stellt **beide** Methoden bereit, aufgelöst über Clouds serverseitigen Renderer (oder Ihren eigenen `render`-Provider). Beachten Sie: Cloud rendert das *gespeicherte* Template, jeder Aufruf speichert also zuerst.
:::

### `renderCustomBlock(block)`

Rendert einen einzelnen benutzerdefinierten Block in seine HTML-Darstellung. Nützlich für Headless-Aufrufer, die `@templatical/renderer`s `renderCustomBlock`-Option von außerhalb der Editor-Instanz steuern möchten – etwa beim direkten Aufruf des Renderers mit eigener Konfiguration.

```ts
const html = await editor.renderCustomBlock(customBlock);
```

### `getCustomBlockStylesheet(customType)`

Gibt das auf Definitionsebene registrierte CSS eines Custom-Block-Typs zurück — oder `undefined`, wenn der Typ unbekannt ist oder kein Stylesheet hat. Das Gegenstück zu `renderCustomBlock()` für Headless-Aufrufe, die die Option `getCustomBlockStylesheet` von `@templatical/renderer` selbst bedienen.

```ts
const css = editor.getCustomBlockStylesheet("qrcode");
```

## Core-Composables

Für fortgeschrittene Anwendungsfälle können Sie die Composables aus `@templatical/core` direkt verwenden.

### `useEditor(options)`

Das Kern-Composable, das den gesamten Editor-Zustand verwaltet: den Block-Baum, Template-Einstellungen, Block-Auswahl, Viewport-Modus sowie alle Mutationsmethoden. Dies ist das, was `init()` intern verwendet. Verwenden Sie es direkt, wenn Sie eine vollständig benutzerdefinierte Editor-Oberfläche auf der Templatical-State-Engine aufbauen.

```ts
import { useEditor } from "@templatical/core";

const editor = useEditor({ content: templateContent });

editor.selectBlock(blockId);
editor.updateBlock(blockId, { content: "New text" });
editor.setViewport("mobile");
```

### `useHistory(options)`

Verfolgt Inhalts-Snapshots und stellt Undo/Redo bereit. Wird mit der Content-Ref des Editors verbunden und erfasst den Zustand nach jeder Mutation. Eine konfigurierbare maximale Verlaufsgröße verhindert unbegrenztes Speicherwachstum.

```ts
import { useHistory } from "@templatical/core";

const history = useHistory({
  content: editor.content,
  setContent: editor.setContent,
  isRemoteOperation: () => false, // Aufzeichnung bei Remote-/Kollaborations-Updates überspringen
  maxSize: 50,
});

history.undo();
history.redo();
```

### `useBlockActions(options)`

Komfortmethoden auf höherer Ebene für gängige Block-Operationen: einen Block erstellen und in einem Schritt einfügen, einen bestehenden Block duplizieren (Deep Clone mit neuer ID) und Löschen mit automatischer Auswahl-Bereinigung.

```ts
import { useBlockActions } from "@templatical/core";

const actions = useBlockActions({
  addBlock: editor.addBlock,
  removeBlock: editor.removeBlock,
  updateBlock: editor.updateBlock,
  selectBlock: editor.selectBlock,
});

const newBlock = actions.createAndAddBlock("paragraph");
actions.duplicateBlock(existingBlock);
actions.deleteBlock(blockId);
actions.updateBlockProperty(blockId, "content", "<p>Updated</p>");
```

### `useAutoSave(options)`

Überwacht den Editor-Inhalt und ruft Ihren Speicher-Callback mit konfigurierbarer Entprellung (Debounce) auf. Enthält Pause/Resume zum vorübergehenden Deaktivieren von Speichervorgängen (z. B. während Massenoperationen) sowie eine `flush()`-Methode für sofortiges Speichern.

```ts
import { useAutoSave } from "@templatical/core";

const autoSave = useAutoSave({
  content: editor.content,
  isDirty: () => editor.state.isDirty,
  onChange: (content) => saveToServer(content),
  debounce: 2000, // der Standardwert
  enabled: true, // boolean oder () => boolean
});

autoSave.flush(); // Sofort speichern
autoSave.cancel(); // Ausstehenden entprellten Speichervorgang abbrechen
autoSave.pause(); // Auto-Save pausieren
autoSave.resume(); // Fortsetzen
autoSave.destroy(); // Überwachung beenden und aufräumen
```

### `useConditionPreview()`

Verwaltet den Vorschauzustand für Anzeigebedingungen im Editor. Ermöglicht das Ein-/Ausschalten einzelner Blöcke, um zu simulieren, wie bedingter Inhalt aussieht, wenn unterschiedliche Bedingungen erfüllt sind.

```ts
import { useConditionPreview } from "@templatical/core";

const preview = useConditionPreview(editor);

preview.isHidden(blockId); // Prüfen, ob ein Block in der Vorschau ausgeblendet ist
preview.toggleBlock(blockId); // Sichtbarkeit eines Blocks umschalten
preview.reset(); // Alle Blöcke auf sichtbar zurücksetzen
preview.hasHiddenBlocks; // ComputedRef<boolean>
```

### `useDataSourceFetch(options)`

Übernimmt das Abrufen externer Daten für benutzerdefinierte Blöcke mit Datenquellen. Verwaltet den Ladezustand und die Fehlerbehandlung für den `onFetch`-Callback.

```ts
import { useDataSourceFetch } from "@templatical/core";

const dataFetch = useDataSourceFetch({
  definition: computed(() => customBlockDefinition),
  block: computed(() => customBlock),
  onUpdate: (fieldValues, fetched) => {
    updateBlock(block.id, { fieldValues, dataSourceFetched: fetched });
  },
});

dataFetch.isFetching; // Ref<boolean>
dataFetch.fetchError; // Ref<boolean>
dataFetch.hasDataSource; // ComputedRef<boolean>
dataFetch.needsFetch; // ComputedRef<boolean>
await dataFetch.fetch(); // Abruf auslösen
```
