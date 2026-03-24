---
title: Node.js Renderer
description: Server-side batch rendering of Templatical templates with Node.js.
---

# Node.js Renderer

Use `@templatical/renderer` in Node.js for server-side rendering, batch processing, or API endpoints.

## Setup

```bash
npm install @templatical/renderer @templatical/types
```

## Basic Rendering

```ts
import { renderToMjml, renderToHtml } from '@templatical/renderer';
import { readFileSync, writeFileSync } from 'fs';

const template = JSON.parse(readFileSync('template.json', 'utf8'));

// Render to MJML
const mjml = renderToMjml(template);
writeFileSync('output.mjml', mjml);

// Render to HTML
const html = await renderToHtml(template);
writeFileSync('output.html', html);
```

## Express API Endpoint

```ts
import express from 'express';
import { renderToHtml } from '@templatical/renderer';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/api/render', async (req, res) => {
  try {
    const html = await renderToHtml(req.body.content, {
      customFonts: req.body.customFonts,
    });

    res.json({ html });
  } catch (error) {
    res.status(400).json({ error: 'Failed to render template' });
  }
});

app.listen(3000);
```

## Batch Rendering

```ts
import { renderToHtml } from '@templatical/renderer';
import { convertMergeTagsToValues } from '@templatical/renderer';
import type { TemplateContent } from '@templatical/types';

interface Recipient {
  email: string;
  first_name: string;
  company: string;
}

async function renderForRecipients(
  template: TemplateContent,
  recipients: Recipient[],
): Promise<Map<string, string>> {
  const baseHtml = await renderToHtml(template);
  const results = new Map<string, string>();

  for (const recipient of recipients) {
    const tags = [
      { label: 'First Name', value: recipient.first_name },
      { label: 'Company', value: recipient.company },
    ];

    const personalized = convertMergeTagsToValues(baseHtml, tags, 'liquid');
    results.set(recipient.email, personalized);
  }

  return results;
}
```

## Building Templates Programmatically

```ts
import {
  createDefaultTemplateContent,
  createTextBlock,
  createButtonBlock,
  createImageBlock,
  createSectionBlock,
} from '@templatical/types';
import { renderToHtml } from '@templatical/renderer';

const template = createDefaultTemplateContent();

template.blocks = [
  createImageBlock({
    src: 'https://example.com/header.png',
    alt: 'Header',
    width: 600,
  }),
  createTextBlock({
    content: '<h1>Welcome, {{first_name}}!</h1>',
    fontSize: 24,
    textAlign: 'center',
  }),
  createTextBlock({
    content: '<p>Thanks for signing up. Here is what you can do next.</p>',
  }),
  createButtonBlock({
    text: 'Get Started',
    url: 'https://example.com/dashboard',
    backgroundColor: '#4f46e5',
    textColor: '#ffffff',
  }),
];

template.settings.backgroundColor = '#f5f5f5';

const html = await renderToHtml(template);
```
