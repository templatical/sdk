---
title: Template-Bewertung
description: Automatische Qualitätsprüfungen für Zustellbarkeit, Barrierefreiheit und Best Practices.
---

# Template-Bewertung

Die Template-Bewertung führt automatische Qualitätsprüfungen Ihres E-Mail-Templates durch und liefert umsetzbares Feedback zu Zustellbarkeit, Barrierefreiheit und Design-Best-Practices.

## So funktioniert es

1. Der Nutzer klickt in der Editor-Toolbar auf den Bewertungs-Button
2. Die KI analysiert den Inhalt und die Struktur des Templates
3. Die Ergebnisse erscheinen als Score mit kategorisierten Findings
4. Jedes Finding enthält eine Beschreibung und einen optionalen Auto-Fix

## Auto-Fix

Einige Findings können automatisch behoben werden. Die KI schreibt den Inhalt des betroffenen Blocks um, um das Problem zu beheben, und bewahrt dabei die Absicht des Nutzers. Die Fixes werden in Echtzeit gestreamt, sodass Nutzer die Änderung live mitverfolgen können.

## Composable

```js
import { useTemplateScoring } from '@templatical/core/cloud';

const {
  // Zustand
  isScoring,          // Ref<boolean>
  scoringResult,      // Ref<ScoringResult | null>
  error,              // Ref<string | null>
  fixingFindingId,    // Ref<string | null> — wird gerade behoben
  fixStreamingText,   // Ref<string> — Fix-Text während er gestreamt wird
  fixError,           // Ref<string | null>

  // Methoden
  score,              // (content, mergeTags) => Promise<ScoringResult | null>
  fixFinding,         // (blockContent, finding, mergeTags) => Promise<string | null>
  removeFinding,      // (category, findingId) => void
  reset,              // () => void
} = useTemplateScoring({
  authManager,
  getTemplateId: () => templateId,
});
```

## Konfiguration

Die Template-Bewertung ist eine KI-Funktion und kann unabhängig umgeschaltet werden:

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  ai: {
    chat: true,
    scoring: true,        // Bewertung aktivieren (Standard: true)
    designToTemplate: false,
  },
});
```
