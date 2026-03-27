---
title: React
description: Using Templatical in a React application via the createApp wrapper pattern.
---

# React

Templatical is built with Vue 3, but you can use it in React applications by mounting it into a DOM element managed by a ref. Vue is bundled inside `@templatical/vue` -- you don't need to install it separately, and it adds no extra dependency for React users to manage.

## Setup

```bash
npm install @templatical/vue @templatical/renderer
```

## React wrapper component

```tsx
import {
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { init } from '@templatical/vue';
import '@templatical/vue/style.css';
import type { TemplaticalEditor } from '@templatical/vue';
import type { TemplateContent } from '@templatical/types';

interface EmailEditorProps {
  content?: TemplateContent;
  onChange?: (content: TemplateContent) => void;
  onSave?: (content: TemplateContent) => void;
  darkMode?: boolean | 'auto';
}

export interface EmailEditorHandle {
  getContent: () => TemplateContent | undefined;
  toMjml: () => string | undefined;
}

export const EmailEditor = forwardRef<EmailEditorHandle, EmailEditorProps>(
  function EmailEditor({ content, onChange, onSave, darkMode }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<TemplaticalEditor | null>(null);

    // Store latest callbacks in refs so the editor always calls the current version
    const onChangeRef = useRef(onChange);
    const onSaveRef = useRef(onSave);
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;

    useEffect(() => {
      if (!containerRef.current) return;

      editorRef.current = init({
        container: containerRef.current,
        content,
        darkMode,
        onChange: (c) => onChangeRef.current?.(c),
        onSave: (c) => onSaveRef.current?.(c),
      });

      return () => {
        editorRef.current?.unmount();
        editorRef.current = null;
      };
    }, [darkMode]); // Re-mount when dark mode changes

    useImperativeHandle(ref, () => ({
      getContent: () => editorRef.current?.getContent(),
      toMjml: () => editorRef.current?.toMjml?.(),
    }));

    return <div ref={containerRef} style={{ height: '100vh' }} />;
  },
);
```

## Usage

```tsx
import { useRef } from 'react';
import { EmailEditor } from './components/EmailEditor';
import type { EmailEditorHandle } from './components/EmailEditor';

function App() {
  const editorRef = useRef<EmailEditorHandle>(null);

  function handleExport() {
    const mjml = editorRef.current?.toMjml();
    if (mjml) {
      console.log('Exported MJML:', mjml);
    }
  }

  return (
    <>
      <button onClick={handleExport}>Export HTML</button>
      <EmailEditor
        ref={editorRef}
        darkMode="auto"
        onChange={(content) => console.log('Changed:', content)}
        onSave={(content) => saveTemplate(content)}
      />
    </>
  );
}
```

## Notes

- The editor mounts its own Vue app inside the container div. React and Vue don't interfere with each other.
- When `darkMode` changes, the editor re-mounts automatically (handled by the `useEffect` dependency array). The current content is not preserved across re-mounts -- pass the latest content via the `content` prop if you need persistence.
- The `onChange` and `onSave` callbacks are stored in refs so they can change without triggering a re-mount.
- A dedicated `@templatical/react` package is planned for a more native React experience.
