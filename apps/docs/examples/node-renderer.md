---
title: Node.js Renderer
description: Server-side rendering of Templatical templates with Node.js.
---

# Node.js Renderer

Use `@templatical/renderer` in Node.js for server-side rendering, batch processing, or API endpoints. The renderer produces MJML; you compile it to HTML using the `mjml` package.

## Setup

```bash
npm install @templatical/renderer @templatical/types mjml
```

## Basic rendering

```ts
import { renderToMjml } from '@templatical/renderer';
import mjml2html from 'mjml';
import { readFileSync, writeFileSync } from 'fs';

const template = JSON.parse(readFileSync('template.json', 'utf8'));

// Render to MJML
const mjml = renderToMjml(template);
writeFileSync('output.mjml', mjml);

// Compile MJML to HTML
const { html } = mjml2html(mjml);
writeFileSync('output.html', html);
```

## Express API endpoint

```ts
import express from 'express';
import { renderToMjml } from '@templatical/renderer';
import mjml2html from 'mjml';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/api/render', (req, res) => {
  try {
    const mjml = renderToMjml(req.body.content, {
      customFonts: req.body.customFonts,
    });
    const { html } = mjml2html(mjml);

    res.json({ html, mjml });
  } catch (error) {
    res.status(400).json({ error: 'Failed to render template' });
  }
});

app.listen(3000);
```

## Batch rendering

```ts
import { renderToMjml } from '@templatical/renderer';
import mjml2html from 'mjml';
import type { TemplateContent } from '@templatical/types';

interface Recipient {
  email: string;
  first_name: string;
  company: string;
}

function renderForRecipients(
  template: TemplateContent,
  recipients: Recipient[],
): Map<string, string> {
  const mjml = renderToMjml(template);
  const { html: baseHtml } = mjml2html(mjml);
  const results = new Map<string, string>();

  for (const recipient of recipients) {
    let personalized = baseHtml;
    personalized = personalized.replace('{{ first_name }}', recipient.first_name);
    personalized = personalized.replace('{{ company }}', recipient.company);
    results.set(recipient.email, personalized);
  }

  return results;
}
```

## Building templates programmatically

```ts
import {
  createDefaultTemplateContent,
  createTextBlock,
  createButtonBlock,
  createImageBlock,
} from '@templatical/types';
import { renderToMjml } from '@templatical/renderer';
import mjml2html from 'mjml';

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

const mjml = renderToMjml(template);
const { html } = mjml2html(mjml);
```
