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
  onChange(content) {
    console.log('[e2e onChange]', content)
  },
})

// Expose for Playwright assertions on the public API surface.
;(window as unknown as { editor: typeof editor }).editor = editor
console.log('[e2e] editor mounted')
