---
title: Den Editor einbetten
description: CSS-Einschränkungen für den Container, in den Sie den Editor mounten, und was bricht, wenn ein Vorfahre sie verletzt.
---

# Den Editor einbetten

Der Editor ist eine Komponente, die Sie in ein Element Ihrer eigenen Seite mounten. Fast alles, was an dieser Nahtstelle schiefgeht, ist eine CSS-Wechselwirkung zwischen Ihrer Seite und den Overlays des Editors — verursacht von einer kleinen Menge von Eigenschaften.

Nichts davon ist Templatical-spezifisch: Es sind reine CSS-Regeln, die jede Bibliothek betreffen, die Overlays mit `position: fixed` positioniert. Siehe außerdem [Shadow DOM](../guide/shadow-dom) dazu, wie der Editor seine eigenen Styles isoliert, und [Theming](../guide/theming) für die `--tpl-user-*`-Oberfläche.

## Der Container des Editors

Der Editor mountet seine Dialoge in eine Popover-Wurzel mit `z-index: 10000` innerhalb des Containers, den Sie an `init()` übergeben. Ein z-index wirkt nur innerhalb seines eigenen Stacking-Kontexts. Deshalb **darf der Container keinen eigenen Stacking-Kontext erzeugen** — sonst bleiben alle Dialoge des Editors darin eingeschlossen, und jedes Chrome von Ihnen mit höherem z-index im übergeordneten Kontext überdeckt sie.

Diese Eigenschaften erzeugen einen Stacking-Kontext, wenn sie auf dem Container oder einem Vorfahren zwischen Container und dem Stacking-Kontext Ihres Chromes liegen:

| Eigenschaft | Auslösender Wert |
| ----------- | ---------------- |
| `isolation` | `isolate` |
| `transform` / `translate` / `rotate` / `scale` | alles außer `none` |
| `filter` / `backdrop-filter` | alles außer `none` |
| `perspective` | alles außer `none` |
| `opacity` | kleiner als `1` |
| `will-change` | `transform`, `filter`, `opacity`, `perspective` |
| `contain` | `paint`, `layout`, `content`, `strict` |
| `mix-blend-mode` | alles außer `normal` |
| `position: fixed` / `sticky` | immer |
| `position: relative` / `absolute` | mit einem `z-index` außer `auto` |

Wenn sich eine davon nicht vermeiden lässt — ein Route-Übergang, der `transform` animiert, oder ein Wrapper, den Sie nicht kontrollieren — geben Sie diesem Element einen `z-index` oberhalb Ihres eigenen Headers, Ihrer Sidebar oder Ihrer Toast-Ebene:

```css
#your-editor-container {
  /* Über Ihrem eigenen Chrome, damit die Dialoge des Editors es auch sind. */
  z-index: 200;
  position: relative;
}
```

::: tip Warum ein höherer z-index auf dem Dialog nicht hilft
Ein `fixed` positionierter Nachfahre kann einen Stacking-Kontext mit keinem z-index verlassen — verglichen wird zwischen der Wurzel des Kontexts und Ihrem Chrome, der Wert des Nachfahren geht dabei nie ein. Der Wert muss also auf den Container, nicht auf den Dialog. Den Container höher zu legen ist unbedenklich, weil sich dessen eigene Box nicht mit Ihrem Chrome überschneidet; betroffen sind nur die Dialoge, die `fixed` sind und den Viewport ausfüllen.
:::

### Dieselben Eigenschaften verschieben auch

`transform`, `filter`, `perspective`, `will-change` und `contain` erledigen zwei Aufgaben gleichzeitig: Neben dem Stacking-Kontext oben erzeugt jede auch einen **umgebenden Block für `position: fixed`**. Ein `fixed` positionierter Nachfahre bezieht seine Koordinaten dann auf diesen Vorfahren statt auf den Viewport — und zwar auch dann, wenn der berechnete Wert von `transform` `none` lautet, denn eine laufende oder animierte Transformation befördert das Element trotzdem.

Was das für den Editor bedeutet:

| Overlay | Unter einem transformierten Vorfahren |
| ------- | ------------------------------------- |
| Farbwähler, Rich-Text-Toolbars, Merge-Tag-Autovervollständigung | Nicht betroffen. Sie verankern sich `absolute` in der Popover-Wurzel und rechnen Viewport-Koordinaten in wurzel-lokale um, wodurch sich der Versatz des Vorfahren aufhebt. |
| Dialoghöhe | Nicht betroffen. Jeder Dialog begrenzt seine Höhe gegen seinen eigenen Backdrop statt gegen den Viewport und bleibt damit in der Box, die er bekommt. |
| Drag-and-drop-Ghost | **Versetzt.** Der Ghost ist `position: fixed` und wird aus Viewport-Koordinaten platziert, driftet also um den Versatz des Vorfahren vom Cursor weg. |

Wenn Sie Drag-and-drop nutzen, halten Sie `transform` daher von allen Vorfahren des Containers fern.

::: warning Ersetzen Sie es nicht durch `opacity`
`opacity` statt `transform` zu animieren vermeidet das Containing-Block-Problem und führt direkt in das Stacking-Problem — `opacity` unter `1` erzeugt einen Stacking-Kontext, sodass Ihr Chrome anfängt, über die Dialoge des Editors zu zeichnen. Es gibt keine Eigenschaft, die beides umgeht. Legen Sie einen Scroll- oder Einblend-Effekt auf ein Element, das den Container des Editors nicht umschließt.
:::

### Beschneidende Vorfahren in Safari

`overflow: hidden`, `clip`, `auto` oder `scroll` auf einem Vorfahren des Containers erzeugt weder einen Stacking-Kontext noch einen umgebenden Block und fehlt deshalb in der Tabelle oben — in Safari beschneidet es die Dialoge trotzdem.

Safari zeichnet einen `position: fixed` positionierten Nachfahren auf die Box eines solchen Vorfahren beschnitten, bezieht sein Layout aber weiterhin auf den Viewport. Ein Dialog wird also korrekt platziert und dann an der Kante dieses Vorfahren abgeschnitten, und sein abdunkelnder Backdrop bedeckt nur dessen Fläche. Chrome und Firefox zeichnen ihn über den gesamten Viewport.

Der Editor hält seinen eigenen Clip von der Vorfahrenkette der Dialoge fern, sein Container darf also in einem scrollbaren oder beschnittenen Layout liegen. Ein Vorfahre **des** Containers liegt außerhalb dessen, was der Editor beeinflussen kann:

```css
.your-app-shell {
  /* Beschneidet die Dialoge des Editors in Safari. */
  overflow: hidden;
}
```

Wenn das Element nur seine eigenen Kinder umschließen soll, hilft auch `overflow: clip` mit `overflow-clip-margin` nicht — jeder Wert beschneidet. Verschieben Sie die Eigenschaft auf ein Element, das den Container nicht umschließt, oder lassen Sie die Seite normal scrollen.

## Typografie der Host-Seite dringt nicht ein

Der Editor neutralisiert an seiner Wurzel jede vererbbare Typografie-Eigenschaft, sodass die globalen Schriftstile Ihrer Seite weder sein Chrome noch seine Canvas erreichen:

`letter-spacing` · `word-spacing` · `text-transform` · `font-style` · `font-weight` · `text-indent` · `text-align` · `white-space` · `list-style-type` · `cursor` · `font-variant-numeric` · `text-shadow` — dazu `font-family`, `font-size`, `line-height` und `color`.

Am wichtigsten ist das für die Canvas. Ein seitenweites `text-transform: uppercase`, das die Vorschau erreicht, würde Ihnen eine E-Mail zeigen, die der Empfänger nie bekommt. Die Zusage gilt deshalb für E-Mail-Inhalte, nicht nur für das Chrome des Editors.

::: tip Warum Shadow DOM allein nicht genügt
Shadow DOM blockiert *Regeln* der Host-Seite — ein Selektor aus Ihrem Stylesheet greift innerhalb der Shadow-Wurzel des Editors nie. Es blockiert jedoch keine *Vererbung*, die dem flachgelegten Baum folgt; vererbbare Eigenschaften überschreiten die Grenze also trotzdem. Aufgehalten werden sie vom Reset des Editors, und der wirkt mit `shadowDom: false` genauso.
:::

**`direction` darf bewusst vererbt werden.** Eine RTL-Seite gibt ihre Schreibrichtung an den Editor weiter, was RTL-Einbettungen genau so wollen. `visibility` bleibt aus demselben Grund unangetastet.

### Sie brauchen kein CSS-Reset auf dem Container

Ein Reset des Containers ist nicht nötig, und ein aggressives Reset schadet: `all: initial` oder `all: revert` löscht dort die `--tpl-user-*`-Custom-Properties, auf denen [Theming](../guide/theming) beruht, und kann die `height: 100%`-Kette zerreißen, an der sich der Editor bemisst. Gestalten Sie die Box des Containers — Größe, Position, Rahmen — und lassen Sie seine vererbten Werte unberührt.
