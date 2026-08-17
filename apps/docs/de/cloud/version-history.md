---
title: Versionsverlauf
description: Templatical Cloud als eine Implementierung des Versionsverlauf-Vertrags.
---

# Versionsverlauf

Der Versionsverlauf ist ein [offener Vertrag](/de/backend/version-history). Templatical Cloud implementiert ihn genauso, wie Ihr eigenes Backend es täte.

```ts
const editor = await initCloud({ container: '#editor', auth: { url: '/api/token' } });
```

Nichts zu konfigurieren. Cloud stellt den Provider bereit, und das Verlaufs-Steuerelement im Header erscheint, sobald eine Vorlage erstellt oder geladen wurde.

## Was der Cloud-Adapter tut

| Methode | Cloud |
|---|---|
| `list` | Liefert alle Versionen der Vorlage — **samt Inhalt**, sodass das Blättern durch den Verlauf nie wartet |
| `get` | Holt den Inhalt einer einzelnen Version |
| `create` | Zeichnet auf Anforderung eine Version auf |
| `restore` | Ein atomarer, protokollierter Server-Endpunkt |

Beide Mutationen sind aktiviert: Versionsspeicher ist Teil dessen, wofür der Tarif bezahlt wird. Es gibt also keine Cloud-Stufe, die den Verlauf auflisten, aber nicht wiederherstellen kann.

## Automatische Versionen

Der **Vorlagen**-Adapter von Cloud zeichnet sie als Teil seines eigenen `save` auf, gedrosselt auf höchstens eine pro Minute — genau das, was [der Vertrag](/de/backend/version-history#ihr-save-zeichnet-die-versionen-auf-nicht-der-editor) für jede Implementierung vorsieht: Wer den Speicher besitzt, besitzt die Aufbewahrungsregel. Ein Speichern, das nur die Vorlage umbenennt, zeichnet nichts auf.

## Eigenen Verlauf mitbringen

Innerhalb von `initCloud()` geht das nicht — dieselbe Grenze, die `templates` zieht, und aus demselben Grund.

Eine Version ist an eine Vorlagen-ID gebunden, die **Cloud ausgegeben hat**. Der Vorlagen-Adapter von Cloud zeichnet bei jedem Speichern eine automatische Version auf, und `initCloud()` nimmt auch keinen `templates`-Provider entgegen, weil diese ID zugleich Zusammenarbeit, Kommentare, KI-Umformulierung, Bewertung und den serverseitigen Export verankert. Ein selbst bereitgestellter Verlauf würde also die Oberfläche steuern, während Cloud weiter Versionen in den eigenen Speicher schreibt: zwei Speicher, einer davon unsichtbar und kostenpflichtig.

`initCloud({ versionHistory })` steht deshalb nicht im Konfigurationstyp, und ein aus JavaScript übergebener Provider wird mit einer Konsolenwarnung ignoriert.

Bringen Sie Ihren eigenen mit [`init()`](/de/backend/version-history) mit — dort gehört Ihnen der gesamte Satz: Vorlagen, Versionsverlauf, Rendering.

## Headless

```js
import { createCloudVersionHistoryProvider } from '@templatical/core/cloud';
import { useVersionHistory } from '@templatical/core';

const history = useVersionHistory({
  provider: createCloudVersionHistoryProvider(authManager),
  getTemplateId: () => 'template-id',
});

await history.load();
await history.restore(history.versions.value[1].id);
```

Die zugrunde liegenden `ApiClient`-Methoden heißen `getVersions`, `getVersion`, `createVersion` und `restoreVersion` — siehe [Headless-API](/de/cloud/headless-api).
