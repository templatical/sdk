import { init } from '@templatical/editor'
import '@templatical/editor/style.css'

const editor = await init({
  container: '#editor',
  onChange(content) {
    console.log('[e2e onChange]', content)
  },
})

// Expose for Playwright assertions on the public API surface.
;(window as unknown as { editor: typeof editor }).editor = editor
console.log('[e2e] editor mounted')
