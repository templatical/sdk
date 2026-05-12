---
title: Template Scoring
description: Automated quality checks for deliverability, accessibility, and best practices.
---

# Template Scoring

Template scoring runs automated quality checks on your email template and provides actionable feedback across deliverability, accessibility, and design best practices.

## How It Works

1. User clicks the scoring button in the editor toolbar
2. The AI analyzes the template content and structure
3. Results appear as a score with categorized findings
4. Each finding includes a description and an optional auto-fix

## Auto-Fix

Some findings can be fixed automatically. The AI rewrites the affected block content to address the issue while preserving the user's intent. Fixes stream in real-time so users can see the change as it happens.

## Composable

```js
import { useTemplateScoring } from '@templatical/core/cloud';

const {
  // State
  isScoring,          // Ref<boolean>
  scoringResult,      // Ref<ScoringResult | null>
  error,              // Ref<string | null>
  fixingFindingId,    // Ref<string | null> — currently fixing
  fixStreamingText,   // Ref<string> — fix text as it streams
  fixError,           // Ref<string | null>

  // Methods
  score,              // (content, mergeTags) => Promise<ScoringResult | null>
  fixFinding,         // (blockContent, finding, mergeTags) => Promise<string | null>
  removeFinding,      // (category, findingId) => void
  reset,              // () => void
} = useTemplateScoring({
  authManager,
  getTemplateId: () => templateId,
});
```

## Configuration

Template scoring is an AI feature and can be toggled independently:

```js
const editor = await initCloud({
  container: '#editor',
  auth: { url: '/api/templatical/token' },
  ai: {
    chat: true,
    scoring: true,        // Enable scoring (default: true)
    designToTemplate: false,
  },
});
```
