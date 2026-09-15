import DefaultTheme from 'vitepress/theme';
import mediumZoom from 'medium-zoom';
import { h, onMounted, watch, nextTick } from 'vue';
import { useRoute } from 'vitepress';
import HeroPreview from './HeroPreview.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'home-hero-image': () => h(HeroPreview),
    }),
  setup() {
    const route = useRoute();

    const initZoom = () => {
      mediumZoom('.main img', { background: 'var(--vp-c-bg)' });
    };

    onMounted(() => {
      initZoom();
    });

    watch(
      () => route.path,
      () => nextTick(() => initZoom()),
    );
  },
};
