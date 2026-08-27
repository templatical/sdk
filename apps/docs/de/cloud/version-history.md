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

## Der Adapter

| Methode | Cloud |
|---|---|
| `list` | Liefert alle Versionen der Vorlage — **samt Inhalt**, sodass das Blättern durch den Verlauf nie wartet |
| `get` | Holt den Inhalt einer einzelnen Version |
| `create` | Zeichnet auf Anforderung eine Version auf |
| `restore` | Ein atomarer, protokollierter Server-Endpunkt |

Beide Mutationen sind aktiviert: Versionsspeicher ist Teil dessen, wofür der Tarif bezahlt wird. Es gibt also keine Cloud-Stufe, die den Verlauf auflisten, aber nicht wiederherstellen kann.

## Automatische Versionen

Der **Vorlagen**-Adapter von Cloud zeichnet sie als Teil seines eigenen `save` auf, gedrosselt auf höchstens eine pro Minute. Das ist die Regel des Vertrags für jede Implementierung — [wer den Speicher besitzt, bestimmt die Aufbewahrung](/de/backend/version-history#versionen-aufzeichnen). Ein Speichern, das nur die Vorlage umbenennt, zeichnet nichts auf.

## Eigene Implementierung

Nicht der Speicher. Eine Version ist an eine von **Cloud ausgestellte** Vorlagen-ID gebunden, und der `templates`-Adapter von Cloud zeichnet bei jedem Speichern eine automatische Version auf, und dieselbe ID verankert zugleich Zusammenarbeit, Kommentare, KI-Umformulierung, Bewertung und den serverseitigen Export — deshalb nimmt `initCloud()` den Schlüssel `templates` für [seine Konfiguration und Events](/de/cloud/templates#eigene-implementierung) entgegen, nie für einen vollständigen Provider. Ein selbst bereitgestellter Verlauf würde die Oberfläche steuern, während Cloud weiter Versionen in den eigenen Speicher schreibt: zwei Speicher, einer davon unsichtbar und kostenpflichtig.

`versionHistory` folgt derselben Form. `initCloud({ versionHistory })` nimmt `VersionHistoryOptions` entgegen — `onCreated`, `onRestored` — und sonst nichts: keine Boolean-Form zum Abschalten, keine vollständige Provider-Form. Ein Wert mit `list` / `get` / `create` / `restore` hat diese Methoden weiterhin ignoriert, benannt in einer Konsolenwarnung, wobei nur seine Events übernommen werden.

```js
await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  versionHistory: {
    onRestored: (template) => navigate(`/templates/${template.id}`),
  },
});
```

Bringen Sie Ihren eigenen Speicher mit [`init()`](/de/backend/version-history) mit — dort gehört Ihnen der gesamte Satz: Vorlagen, Versionsverlauf, Rendering.

## Events

```ts
versionHistory: {
  onCreated: (version) => {},
  onRestored: (template) => {},
}
```

Dieselben Events wie im [offenen Vertrag](/de/backend/version-history#events).

## Headless-Nutzung

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
