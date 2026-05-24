import { init } from '@templatical/editor'
import '@templatical/editor/style.css'

const editor = await init({
  container: '#editor',
  customBlocks: [
    {
      type: 'event-card',
      name: 'Event Card',
      template: '<div class="event">{{ title }}</div>',
      fields: [{ key: 'title', type: 'text', label: 'Title', default: 'My Event' }],
    },
  ],
  mergeTags: {
    tags: [
      {
        label: 'First Name',
        value: '{{first_name}}',
        group: 'Recipient',
        description: 'Personalized greeting',
      },
      {
        label: 'Email',
        value: '{{email}}',
        group: 'Recipient',
        description: 'Primary contact address',
      },
      {
        label: 'Unsubscribe URL',
        value: '{{unsubscribe_url}}',
        description: 'Required by anti-spam legislation',
      },
    ],
  },
  onChange(content) {
    console.log('[e2e onChange]', content)
  },
})

// Expose for Playwright assertions on the public API surface.
;(window as unknown as { editor: typeof editor }).editor = editor
console.log('[e2e] editor mounted')
