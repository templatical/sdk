import {
  mount,
  type ComponentMountingOptions,
  type VueWrapper,
} from '@vue/test-utils';
import { ref, computed, type Component } from 'vue';
import { SYNTAX_PRESETS } from '@templatical/types';
import {
  TRANSLATIONS_KEY,
  FONTS_MANAGER_KEY,
  THEME_STYLES_KEY,
  UI_THEME_KEY,
  BLOCK_DEFAULTS_KEY,
  MERGE_TAGS_KEY,
  MERGE_TAG_SYNTAX_KEY,
  ON_REQUEST_MERGE_TAG_KEY,
  ON_REQUEST_MEDIA_KEY,
  DISPLAY_CONDITIONS_KEY,
  ALLOW_CUSTOM_CONDITIONS_KEY,
  CAPABILITIES_KEY,
} from '../../src/keys';
import { makeStubTranslations } from './translations';

function stubFontsManager() {
  return {
    fonts: ref([{ label: 'Default', value: '' }]),
    loadCustomFonts: async () => {},
    cleanupFontLinks: () => {},
    setCustomFontsEnabled: () => {},
  };
}

/**
 * Mount a Vue component with sensible default provides for the editor's
 * injection keys (translations, theme, capabilities, merge tags, etc.).
 *
 * Override any provide by passing it in `provides`. Symbol-keyed provides
 * (the editor's injection keys) are merged with defaults.
 */
export function mountEditor<C extends Component>(
  component: C,
  options: ComponentMountingOptions<C> & {
    provides?: Record<symbol, unknown>;
  } = {} as ComponentMountingOptions<C>,
): VueWrapper<any> {
  const { provides = {}, global = {}, ...rest } = options as any;

  const defaults: Record<symbol, unknown> = {
    [TRANSLATIONS_KEY]: makeStubTranslations(),
    [FONTS_MANAGER_KEY]: stubFontsManager(),
    [THEME_STYLES_KEY]: computed(() => ({})),
    [UI_THEME_KEY]: computed(() => 'light'),
    [BLOCK_DEFAULTS_KEY]: undefined,
    [MERGE_TAGS_KEY]: [],
    [MERGE_TAG_SYNTAX_KEY]: SYNTAX_PRESETS.liquid,
    [ON_REQUEST_MERGE_TAG_KEY]: null,
    [ON_REQUEST_MEDIA_KEY]: null,
    [DISPLAY_CONDITIONS_KEY]: [],
    [ALLOW_CUSTOM_CONDITIONS_KEY]: false,
    [CAPABILITIES_KEY]: {},
  };

  const mergedProvides = { ...defaults, ...provides };

  return mount(component as any, {
    ...rest,
    global: {
      ...global,
      provide: { ...mergedProvides, ...(global.provide ?? {}) },
    },
  });
}
