<script setup lang="ts">
import { RouterView } from 'vue-router';
import SiteHeader from '@/components/layout/SiteHeader.vue';
import SiteFooter from '@/components/layout/SiteFooter.vue';
</script>

<template>
    <div class="flex min-h-screen flex-col bg-bg text-text">
        <SiteHeader />
        <main class="flex-1">
            <RouterView v-slot="{ Component, route }">
                <Transition name="route" mode="out-in">
                    <div :key="route.path">
                        <component :is="Component" />
                    </div>
                </Transition>
            </RouterView>
        </main>
        <SiteFooter />
    </div>
</template>
