---
title: KI-Assistent
description: Erzeugen Sie E-Mail-Inhalte, schreiben Sie Texte um und wandeln Sie Designs mit KI in Templates um.
---

# KI-Assistent

Templatical Cloud enthält KI-gestützte Funktionen zum Erzeugen von E-Mail-Inhalten, zum Umschreiben von Texten, zur Bewertung von Templates und zur Umwandlung von Designs in bearbeitbare Templates.

## KI aktivieren

Die KI ist bei Verwendung von `initCloud()` standardmäßig aktiviert. Um sie zu deaktivieren oder einzelne Funktionen zu konfigurieren:

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },

  // Alle KI-Funktionen aktivieren (Standard, wenn weggelassen)
  ai: {},

  // Oder einzeln konfigurieren
  ai: {
    chat: true,              // KI-Chat zur Inhaltserzeugung
    rewrite: true,           // Textumschreibung in Titel-/Absatz-Blöcken
    scoring: true,           // Qualitätsbewertung von Templates
    designToTemplate: true,  // Umwandlung von Design zu Template
  },

  // Oder KI komplett deaktivieren
  ai: false,
});
```

## KI-Chat

Das KI-Chat-Panel ermöglicht es Nutzern, E-Mail-Inhalte über Prompts in natürlicher Sprache zu erzeugen und zu verändern. Die KI versteht die aktuelle Template-Struktur und kann Blöcke hinzufügen, ändern oder entfernen.

**So funktioniert es:**
1. Der Nutzer öffnet das KI-Chat-Panel im Editor
2. Er gibt einen Prompt ein wie „Füge einen Hero-Bereich mit einem Produktbild und CTA-Button hinzu"
3. Die KI erzeugt Template-Änderungen und wendet sie an
4. Der Nutzer kann die Änderungen übernehmen, verwerfen oder den Dialog fortsetzen

Die KI führt einen Gesprächsverlauf pro Template, sodass Folge-Prompts den vollständigen Kontext vorangegangener Änderungen kennen.

### Vorschläge

Die KI kann außerdem Prompt-Vorschläge auf Basis des aktuellen Template-Inhalts erzeugen und den Nutzern so helfen, mögliche Verbesserungen zu entdecken.

## Text-Umschreibung

Die Funktion zur Text-Umschreibung ermöglicht es Nutzern, Text innerhalb eines Titel- oder Absatz-Blocks auszuwählen und mit KI-Unterstützung neu zu formulieren. Nutzer können Anweisungen wie die folgenden geben:

- „Mach das prägnanter"
- „Ändere den Tonfall in etwas Professionelleres"
- „Übersetze ins Spanische"
- „Füge ein Gefühl von Dringlichkeit hinzu"

Die Umschreibung wird in Echtzeit gestreamt, und Nutzer können die Änderung rückgängig machen bzw. wiederherstellen.

## Design zu Template

Laden Sie ein Design-Bild (Screenshot, Mockup, PDF) hoch oder beschreiben Sie, was Sie möchten – die KI erzeugt ein vollständiges E-Mail-Template, das dazu passt. Das ist nützlich für:

- Die Umwandlung von Figma-/Sketch-Designs in bearbeitbare Templates
- Das Nachbauen von Wettbewerber-E-Mails
- Schnelles Prototyping aus groben Skizzen

## Composables

Wenn Sie eine eigene Oberfläche auf Basis des Cloud-SDK bauen, stehen diese Composables aus `@templatical/core/cloud` zur Verfügung:

### `useAiChat`

```js
import { useAiChat } from '@templatical/core/cloud';

const {
  messages,           // Ref<AiChatMessage[]> — Gesprächsverlauf
  isGenerating,       // Ref<boolean> — generiert gerade
  suggestions,        // Ref<string[]> — Prompt-Vorschläge
  error,              // Ref<string | null>

  sendPrompt,         // (prompt, content, mergeTags) => Promise<TemplateContent | null>
  loadConversation,   // () => Promise<void>
  loadSuggestions,    // (content, mergeTags) => Promise<void>
  clearChat,          // () => void
} = useAiChat({
  authManager,
  getTemplateId: () => templateId,
  onApply: (content) => { /* KI hat Änderungen angewendet */ },
  onError: (error) => { /* Fehler behandeln */ },
});
```

### `useAiRewrite`

```js
import { useAiRewrite } from '@templatical/core/cloud';

const {
  isRewriting,        // Ref<boolean>
  streamingText,      // Ref<string> — Text während er eingestreamt wird
  rewrittenContent,   // Ref<string | null> — finales Ergebnis
  error,              // Ref<string | null>

  rewrite,            // (content, instruction, mergeTags) => Promise<string | null>
  undo,               // () => string | null
  redo,               // () => string | null
  reset,              // () => void
} = useAiRewrite({
  authManager,
  getTemplateId: () => templateId,
});
```

### `useDesignReference`

```js
import { useDesignReference } from '@templatical/core/cloud';

const {
  isGenerating,       // Ref<boolean>
  error,              // Ref<string | null>

  generate,           // (input) => Promise<TemplateContent | null>
  reset,              // () => void
} = useDesignReference({
  authManager,
  getTemplateId: () => templateId,
  onApply: (content) => { /* Design umgewandelt */ },
});

// Aus einem hochgeladenen Bild erzeugen
await generate({ imageUpload: file });

// Aus einer hochgeladenen PDF erzeugen
await generate({ pdfUpload: pdfFile });

// Aus einem Prompt erzeugen
await generate({ prompt: 'A product launch email with hero image and pricing table' });
```
