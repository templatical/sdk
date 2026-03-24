---
title: React
description: Using Templatical in a React application via the createApp wrapper pattern.
---

# React

Templatical is built with Vue 3, but you can use it in React applications by mounting it into a DOM element managed by a ref.

## Setup

```bash
npm install @templatical/vue @templatical/renderer
```

## React Wrapper Component

```tsx
import { useRef, useEffect, useCallback } from 'react';
import { init, unmount } from '@templatical/vue';
import '@templatical/vue/style.css';
import type { TemplaticalEditor } from '@templatical/vue';
import type { TemplateContent } from '@templatical/types';

interface EmailEditorProps {
  content?: TemplateContent;
  onChange?: (content: TemplateContent) => void;
  onSave?: (content: TemplateContent) => void;
  darkMode?: boolean;
}

export function EmailEditor({ content, onChange, onSave, darkMode }: EmailEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<TemplaticalEditor | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    editorRef.current = init({
      container: containerRef.current,
      content,
      darkMode,
      onChange,
      onSave,
      mergeTags: {
        syntax: 'liquid',
        tags: [
          { label: 'First Name', value: '{{first_name}}' },
          { label: 'Email', value: '{{email}}' },
        ],
      },
    });

    return () => {
      unmount();
      editorRef.current = null;
    };
  }, [darkMode]); // Re-mount when dark mode changes

  const getContent = useCallback(() => {
    return editorRef.current?.getContent();
  }, []);

  const exportMjml = useCallback(() => {
    return editorRef.current?.toMjml?.();
  }, []);

  return <div ref={containerRef} style={{ height: '100vh' }} />;
}
```

## Usage

```tsx
import { EmailEditor } from './components/EmailEditor';

function App() {
  return (
    <EmailEditor
      onChange={(content) => console.log('Changed:', content)}
      onSave={(content) => saveTemplate(content)}
      darkMode={false}
    />
  );
}
```

## Notes

- The editor mounts its own Vue app inside the container div. React and Vue don't interfere with each other.
- When props like `darkMode` change, the editor needs to be re-mounted (handled by the `useEffect` dependency array).
- The `onChange` and `onSave` callbacks work the same as in the Vue integration.
- A dedicated `@templatical/react` package is planned for a more native React experience.
