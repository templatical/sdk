---
title: AI Assistant
description: Generate email content, rewrite text, and convert designs to templates with AI.
---

# AI Assistant

Templatical Cloud includes AI-powered features for generating email content, rewriting text, scoring templates, and converting designs into editable templates.

## Enable AI

AI is enabled by default when using `initCloud()`. To disable it or configure specific features:

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },

  // Enable all AI features (default)
  ai: true,

  // Or configure individually
  ai: {
    chat: true,              // AI chat for content generation
    scoring: true,           // Template quality scoring
    designToTemplate: true,  // Design-to-template conversion
  },

  // Or disable AI entirely
  ai: false,
});
```

## AI Chat

The AI chat panel lets users generate and modify email content through natural language prompts. The AI understands the current template structure and can add, modify, or remove blocks.

**How it works:**
1. User opens the AI chat panel in the editor
2. Types a prompt like "Add a hero section with a product image and CTA button"
3. The AI generates template changes and applies them
4. User can accept, revert, or continue the conversation

The AI maintains conversation history per template, so follow-up prompts have full context of previous changes.

### Suggestions

The AI can also generate prompt suggestions based on the current template content, helping users discover what improvements are possible.

## Text Rewrite

The text rewrite feature allows users to select text within a text block and rewrite it with AI assistance. Users can provide instructions like:

- "Make this more concise"
- "Change the tone to be more professional"
- "Translate to Spanish"
- "Add a sense of urgency"

The rewrite streams in real-time, and users can undo/redo the change.

## Design to Template

Upload a design image (screenshot, mockup, PDF) or describe what you want, and the AI generates a complete email template that matches. This is useful for:

- Converting Figma/Sketch designs into editable templates
- Reproducing competitor emails
- Quickly prototyping from rough sketches

## Composables

If you're building a custom UI on top of the Cloud SDK, these composables are available from `@templatical/core/cloud`:

### `useAiChat`

```js
import { useAiChat } from '@templatical/core/cloud';

const {
  messages,           // Ref<AiChatMessage[]> — conversation history
  isGenerating,       // Ref<boolean> — currently generating
  suggestions,        // Ref<string[]> — prompt suggestions
  error,              // Ref<string | null>

  sendPrompt,         // (prompt, content, mergeTags) => Promise<TemplateContent | null>
  loadConversation,   // () => Promise<void>
  loadSuggestions,    // (content, mergeTags) => Promise<void>
  clearChat,          // () => void
} = useAiChat({
  authManager,
  getTemplateId: () => templateId,
  onApply: (content) => { /* AI applied changes */ },
  onError: (error) => { /* handle error */ },
});
```

### `useAiRewrite`

```js
import { useAiRewrite } from '@templatical/core/cloud';

const {
  isRewriting,        // Ref<boolean>
  streamingText,      // Ref<string> — text as it streams in
  rewrittenContent,   // Ref<string | null> — final result
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
  onApply: (content) => { /* design converted */ },
});

// Generate from an uploaded image
await generate({ imageUpload: file });

// Generate from a prompt
await generate({ prompt: 'A product launch email with hero image and pricing table' });
```
