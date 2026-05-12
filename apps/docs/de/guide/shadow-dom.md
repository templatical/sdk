---
title: Shadow DOM
description: Wie Templatical den Editor mit Shadow DOM vom Host-Seiten-CSS isoliert und wann Sie sich abmelden sollten.
---

# Shadow DOM

Templatical wird standardmäßig innerhalb eines [Shadow DOM](https://developer.mozilla.org/de/docs/Web/API/Web_components/Using_shadow_DOM) eingebunden. Die Shadow-Grenze isoliert die Chrome-, Canvas- und Rich-Text-Inhalte des Editors vom CSS Ihrer Host-Seite — selbst globale Resets wie `* { color: red !important }` können sie nicht überschreiben.

Diese Seite ist die kanonische Referenz für das Isolationsmodell. Wenn Sie den Editor nur stylen möchten, springen Sie zum [Theming-Leitfaden](./theming).

## So funktioniert es

Wenn Sie `init()` oder `initCloud()` aufrufen und ein Container-Element übergeben, geht Templatical folgendermaßen vor:

1. Ruft `container.attachShadow({ mode: 'open' })` auf, um einen Shadow Root auf Ihrem Element zu erstellen.
2. Hängt die Vue-App in den Shadow Root ein, statt die Kinder des Containers direkt zu ersetzen.
3. Übernimmt ein gemeinsames `CSSStyleSheet`, das jedes Tailwind-Utility, jeden SFC-`<style>`-Block und `styles/index.css` enthält, via `adoptedStyleSheets`.

Alle Editor-Styles leben innerhalb des Shadow Root und können nicht nach außen dringen. Alle Host-Seiten-Styles enden an der Shadow-Grenze und können nicht eindringen. Der Modus ist **`open`** — `container.shadowRoot` ist nicht null und DevTools kann den Baum vollständig inspizieren.

## Standardverhalten

Sie erhalten die Grenze ohne Konfiguration kostenlos:

```ts
import { init } from "@templatical/editor";
import "@templatical/editor/style.css";

const editor = await init({
  container: "#editor",
  // shadowDom: true ist der Standard — weglassen, sofern Sie kein Light DOM möchten
});
```

Nach dem Mount sieht das DOM so aus:

```html
<div id="editor">
  #shadow-root (open)
  <link rel="stylesheet" href="…" />
  <!-- übernommenes Stylesheet -->
  <div class="tpl tpl-editor-host">
    <!-- Editor-Chrome, Sidebars, Canvas, Toolbars -->
  </div>
</div>
```

Das `tpl:`-Tailwind-Präfix und die `.tpl-*`-SDK-Klassen des Editors sind weiterhin im Einsatz, aber durch die Shadow-Grenze sind sie funktional überflüssig für Kollisionsschutz. Sie bleiben erhalten, damit der [Opt-out-Modus](#opt-out-shadowdom-false) weiter funktioniert.

## Warum das existiert

Das `tpl:`-Präfix schützt nur eine Richtung: Editor-Utilities können niemals mit Host-Klassen kollidieren. Es verhindert **nichts** in der anderen Richtung — eine Host-Seiten-Regel wie `p { font-family: Comic Sans }` kaskadiert in jeden Absatz innerhalb des Editors, einschließlich der Canvas-Vorschau.

Shadow DOM ist der einzige standardbasierte Weg, diese Kaskade zu blockieren. Derselbe Ansatz wird von Stripe Elements, Intercom-Widgets und den meisten einbettbaren Drittanbieter-UIs verwendet. Siehe [Issue #70](https://github.com/templatical/sdk/issues/70) für den ursprünglichen Bericht.

## Warum als Standard

Shadow DOM garantiert, dass keine Stile zwischen Host-Seite und Editor-UI leaken — Host-CSS kann nicht in den Editor kaskadieren, und Editor-CSS kann nicht in Ihre App durchsickern. Templatical aktiviert diese Garantie standardmäßig, nicht als Opt-in, weil die Bedingungen, die sie notwendig machen, auf fast jede Host-Seite zutreffen:

- **Globale Resets, Design-Systeme und Framework-Preflight sind überall.** Tailwind, Bootstrap, Material UI, Chakra, Mantine — jeder moderne Stack liefert Regeln wie `* { box-sizing: border-box }` und `body { font-family: … }` aus. Ohne die Shadow-Grenze würde jedes Editor-Element übernehmen, was Ihre Host-Seite definiert.
- **Der Canvas rendert E-Mail-ähnliche Inhalte, bei denen Typografie und Abstände am wichtigsten sind.** Ein Host-`body { font-family: Comic Sans }`, das in die Vorschau kaskadiert, beschädigt jede Vorlage, bevor sie exportiert wird.
- **Jeder Editor auf der Seite erhält seinen eigenen Scope.** Mit mehreren nebeneinander gemounteten Editoren (z. B. Entwurf + Vorschau, A/B-Vergleich) isoliert jeder Shadow Root Theming und Host-Targeting pro Instanz — Host-Overrides auf einem erreichen den anderen nicht.
- **Formularelemente in Toolbars und Dialogen würden Host-Styling übernehmen.** Texteingaben, Auswahl-Dropdowns und Buttons würden mit Padding, Schriften und Fokusringen der Host-Seite gerendert — pro Konsument unterschiedlich.

## Kompromisse

Was Sie aufgeben, wenn Sie innerhalb eines Shadow Root eingebunden werden:

- **Host-seitiges `document.querySelector` kann Editor-Interna nicht sehen.** Gehen Sie den Shadow Root entlang: `container.shadowRoot.querySelector(...)`.
- **Browser-Mindestanforderungen steigen.** Der Pfad mit übernommenen Stylesheets benötigt Chrome 80+, Edge 80+, Firefox 101+ und Safari 16.4+. Wenn Sie ältere Firefox- oder Safari-Versionen unterstützen müssen, [melden Sie sich ab](#opt-out-shadowdom-false).
- **Der Container muss geeignet sein, einen Shadow Root zu hosten.** Die HTML-Spezifikation beschränkt `attachShadow()` auf eine bestimmte Elementliste — `<div>`, `<span>`, `<section>`, `<article>`, `<aside>`, `<header>`, `<footer>`, `<main>`, `<nav>`, `<p>`, `<blockquote>` und benutzerdefinierte Elemente mit Bindestrich-Name. `<table>`, `<tr>`, `<td>`, `<form>`, `<input>`, `<button>`, `<select>`, Listenelemente (`<ul>`, `<ol>`, `<li>`), `<iframe>` und ersetzte Elemente (`<img>`, `<video>` usw.) sind nicht erlaubt. Verwenden Sie ein `<div>`.
- **Schriftarten sind die einzige absichtliche globale Ausnahme.** Webschriftarten innerhalb von Shadow Roots sind browserübergreifend unzuverlässig (Safaris `@font-face`-Auflösung aus einem Shadow Root war historisch defekt). Templaticals Schriftartenlader fügt `<link>`-Tags weiterhin in `document.head` ein, damit Schriftartenanfragen auf Dokumentebene aufgelöst werden. Dies ist der einzige Seiteneffekt auf der Host-Seite.

## Theming via `:host`

Host-Seiten-CSS kann CSS-Variablen auf dem Container setzen, und die Werte werden über die Shadow-Grenze hinweg in den Editor vererbt. Templatical definiert jedes Design-Token als `var(--tpl-user-<name>, <standard>)`, sodass jede `--tpl-user-*`-Überschreibung auf dem Container (oder einem beliebigen Vorfahren) den Standardwert übersteigt.

```css
/* Überschreibt die Primärfarbe des Editors von der Host-Seite */
#editor {
  --tpl-user-primary: oklch(65% 0.2 280);
  --tpl-user-primary-hover: oklch(58% 0.2 280);
  --tpl-user-primary-light: oklch(94% 0.05 280);

  /* Dark-Mode-Äquivalente liegen im Namensraum --tpl-user-dark-* */
  --tpl-user-dark-primary: oklch(75% 0.16 280);
}
```

Setzen Sie die Variablen auf dem Container, den Sie an `init()` übergeben (oder auf einem Vorfahren), und der Editor erbt sie.

Siehe den [Theming-Leitfaden](./theming) für die vollständige Token-Liste und die Dark-Mode-Behandlung.

## Opt-out: `shadowDom: false`

Wann Sie sich abmelden würden:

- Ihre Host-Integration ist auf Light-DOM-`document.querySelector` angewiesen, um in den Editor hineinzugreifen (für Test-Harnesses, die Verdrahtung von Drittanbieter-Widgets in benutzerdefinierten Blöcken usw.).
- Sie müssen Firefox 80–100 oder Safari 14–16.3 unterstützen — die `adoptedStyleSheets`-API fehlt dort.
- Ihr Container ist an einen Elementtyp gebunden, der keinen Shadow Root hosten kann (Tabellenzelle, Formularfeld usw.).

```ts
const editor = await init({
  container: "#editor",
  shadowDom: false,
});
```

Was Sie verlieren:

- Host-CSS kaskadiert wieder in den Editor. Das `tpl:`-Präfix schützt vor Klassennamen-Kollisionen; der handgeschriebene `.tpl`-Reset-Block in `styles/index.css` schützt Schriftart-, Schaltflächen- und Formular-Standardwerte, aber **beliebige Host-Regeln, die nackte Tags (`p`, `a`, `input`) ansprechen, dringen ein**.

Was weiterhin funktioniert:

- Jede andere Funktion ist identisch: dieselben Blöcke, dieselbe i18n, dieselben Cloud-Funktionen, dieselbe API-Oberfläche. Die Grenze ist die einzige Änderung.

### Light-DOM-Modus gegen Host-CSS härten

Wenn Sie sich vom Shadow DOM abmelden, mounten Sie den Editor in einem Container, der vererbte Host-Deklarationen explizit zurücksetzt, bevor sie den Editor erreichen. Der eingebaute `.tpl`-Reset des Editors deckt Schriftart-, Schaltflächen-, Scrollbar- und Fokus-Stile des Chromes ab — aber Host-Regeln, die nackte Tags (`p`, `a`, `input`, `*`) ansprechen, kaskadieren im Light-DOM-Modus weiterhin in das Canvas.

Die einfachste Abhilfe ist eine einzige CSS-Zeile auf dem Container:

```css
#editor {
  /* Author-Layer-Host-Stile an dieser Grenze neutralisieren, sodass das
     eigene .tpl-Stylesheet des Editors die einzige Quelle innerhalb ist. */
  all: revert-layer;
}
```

`all: revert-layer` ist die chirurgischste Option — sie entfernt Author-Layer-Stile (Host-CSS, Framework-Resets, CSS-in-JS-Injektionen) am Container, behält jedoch die User-Agent-Standardwerte des Browsers. Die eigenen, gescopeten Stile des Editors innerhalb von `.tpl` greifen dann normal.

Andere Optionen:

- **Aggressive globale Regeln einschränken.** Schreiben Sie `* { … }` oder Bare-Tag-Regeln so um, dass sie keine Nachfahren des Editor-Containers treffen — z. B. `.my-app:not(#editor *) p { … }`.
- **Reset auf einem Wrapper, der den Editor ausschließt.** Wenden Sie Ihren CSS-Reset auf einen Wrapper an, der Ihr App-Chrome enthält, aber NICHT den Editor-Container.
- **`!important` auf Tag-Selektor-Regeln vermeiden.** `p { font: … !important }` ist im Light-DOM-Modus der schlimmste Übeltäter, weil es die eigenen `font-family`-Deklarationen des Editors überschreibt.

Im Standard-Shadow-DOM-Modus ist nichts davon nötig — die Grenze erledigt das für Sie. Die `all: revert-layer`-Zeile ist auch bei `shadowDom: true` harmlos hinzuzufügen (sie greift am Container, nicht an den Interna des Editors).

## Editor-Interna von der Host-Seite ansprechen

Im Shadow-DOM-Modus stellt der Container einen Nicht-Null-`shadowRoot` bereit. Durchstoßen Sie ihn explizit:

```ts
const container = document.querySelector("#editor");
const block = container.shadowRoot?.querySelector('[data-block-id="abc-123"]');
```

Eingebaute Browser-Werkzeuge, die das Light DOM durchlaufen (z. B. `document.querySelectorAll('.tpl-block')`), liefern im Shadow-Modus eine leere Menge — Sie müssen den Shadow Root explizit betreten. Integrationen für benutzerdefinierte Blöcke, die host-seitigen Zugriff benötigen, sollten entweder:

1. `container.shadowRoot.querySelector(...)` verwenden (funktioniert ohne Opt-out) oder
2. `shadowDom: false` übergeben, falls die Integration nicht umgeschrieben werden kann.

## Debugging-Tipps

**DevTools.** Der Shadow Root ist `open`, daher rendert das Elemente-Panel ihn inline mit einem `#shadow-root (open)`-Label. Klicken Sie, um aufzuklappen. Berechnete Stile, Layout und Inspect-on-Hover funktionieren normal.

**Playwright.** Locator, die mit `page.locator()` und `page.getByTestId()` erstellt werden, durchstoßen automatisch offene Shadow Roots. Für `data-testid`-Treffer wird kein `>>>`-Shadow-Pierce-Selektor benötigt. CSS-Selektoren, die Shadow-Grenzen explizit durchlaufen (`#editor >>> .tpl-canvas`), funktionieren ebenfalls.

**ProseMirror-Auswahl.** Der TipTap-Rich-Text-Editor verwendet ProseMirror unter der Haube. ProseMirror 1.41+ erkennt Shadow Roots automatisch und liest die Auswahl über `view.root.getSelection()`. Es ist keine zusätzliche Verdrahtung erforderlich.

**Host-Stylesheet-Experimente.** Um zu beweisen, dass die Grenze ihre Arbeit tut, öffnen Sie DevTools im Playground (`https://play.templatical.com`) und injizieren Sie:

```js
const style = document.createElement("style");
style.textContent =
  "* { color: red !important; font-family: Comic Sans !important; }";
document.head.appendChild(style);
```

Die Host-Seite wird rot und hässlich; das Editor-Canvas und -Chrome bleiben unberührt.

## FAQ

**Funktionieren über die `fonts`-Konfiguration geladene Webschriftarten?**
Ja. Der Schriftartenlader injiziert `<link>`-Tags explizit in `document.head` statt in den Shadow Root, weil die `@font-face`-Auflösung aus Shadow Roots unzuverlässig ist. Dies ist der einzige absichtliche globale Seiteneffekt.

**Funktioniert das Drucken?**
Ja. Übernommene Stylesheets respektieren `@media print`-Regeln, und das Drucklayout des Editors ist von der Shadow-Grenze unberührt.

**Funktioniert die TipTap-Textauswahl über die Shadow-Grenze hinweg?**
Ja. ProseMirror-view 1.41+ verwendet `view.root` (den Shadow Root im Shadow-Modus) für Auswahl-APIs.

**Kann ich mehr als einen Editor auf einer Seite einbinden?**
Ja. Jeder `init()`-Aufruf hängt einen Shadow Root an seinen eigenen Container an, und die Per-Container-Instanzkarte hält den Zustand isoliert. Zwei Editoren auf derselben Seite teilen keinen Inhalt, keinen Verlauf und keinen Auswahlzustand.

**Funktioniert der Editor in einem iframe?**
Ja. Das `document` des iframes wird zum Host, und der Shadow Root wird wie üblich angehängt.

**Beeinflusst CSS-in-JS (styled-components, emotion) aus dem Host den Editor?**
Nein. Host-seitige Laufzeit-Stilinjektion landet in `document.head`, das außerhalb der Shadow-Grenze sitzt.

**Setzt das Tailwind-Preflight des Hosts die Typografie des Editors zurück?**
Nein. Tailwind-Preflight ist global, lebt also in `document.head`, was die Shadow-Grenze blockiert.

**Was, wenn das CSS-Reset meines Frameworks (z. B. Bootstrap, Foundation) vorhanden ist?**
Dieselbe Antwort — alles in `document.head` (oder `<style>`-Tags in `document.body`) wird blockiert.

## Siehe auch

- [Theming](./theming) — vollständige Design-Token-Liste, Dark Mode, `:host`-Überschreibungsmuster
- [API-Referenz](../api/editor) — `shadowDom`-Konfigurationsfeld und Container-Element-Anforderungen
- [Benutzerdefinierte Blöcke](./custom-blocks) — Host-seitiger Abfrage-Hinweis für Integrationen
- [Installation](../getting-started/installation) — Browser-Unterstützungsstufen für Standard- vs. Opt-out-Modus
