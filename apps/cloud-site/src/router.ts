import type { RouteRecordRaw } from 'vue-router';

export { prerenderRoutes } from './prerender';

export const routes: RouteRecordRaw[] = [
    { path: '/', name: 'home', component: () => import('./pages/Home.vue') },
    {
        path: '/features',
        name: 'features',
        component: () => import('./pages/Features.vue'),
    },
    {
        path: '/features/:slug',
        name: 'feature-detail',
        component: () => import('./pages/FeatureDetail.vue'),
        props: true,
    },
    { path: '/compare', name: 'compare', component: () => import('./pages/Compare.vue') },
    { path: '/faq', name: 'faq', component: () => import('./pages/Faq.vue') },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./pages/NotFound.vue') },
];
