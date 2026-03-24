import { createApp, shallowRef, h, type Component } from 'vue';
import App from './App.vue';
import Cloud from './Cloud.vue';
import '@templatical/vue/src/styles/index.css';
import './style.css';

const pages: Record<string, Component> = {
    '': App,
    '#cloud': Cloud,
};

const currentPage = shallowRef<Component>(pages[window.location.hash] ?? App);

window.addEventListener('hashchange', () => {
    currentPage.value = pages[window.location.hash] ?? App;
});

createApp({
    setup() {
        return () => h(currentPage.value);
    },
}).mount('#app');
