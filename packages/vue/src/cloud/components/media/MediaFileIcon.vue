<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    mimeType: string;
}>();

interface FileTypeConfig {
    label: string;
    color: string;
    bgColor: string;
    icon: 'document' | 'video' | 'audio';
}

const FILE_TYPE_MAP: Record<string, FileTypeConfig> = {
    'application/pdf': {
        label: 'PDF',
        color: '#dc2626',
        bgColor: '#fef2f2',
        icon: 'document',
    },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        label: 'DOC',
        color: '#2563eb',
        bgColor: '#eff6ff',
        icon: 'document',
    },
    'application/msword': {
        label: 'DOC',
        color: '#2563eb',
        bgColor: '#eff6ff',
        icon: 'document',
    },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        label: 'XLS',
        color: '#16a34a',
        bgColor: '#f0fdf4',
        icon: 'document',
    },
    'application/vnd.ms-excel': {
        label: 'XLS',
        color: '#16a34a',
        bgColor: '#f0fdf4',
        icon: 'document',
    },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        {
            label: 'PPT',
            color: '#ea580c',
            bgColor: '#fff7ed',
            icon: 'document',
        },
    'application/vnd.ms-powerpoint': {
        label: 'PPT',
        color: '#ea580c',
        bgColor: '#fff7ed',
        icon: 'document',
    },
    'text/csv': {
        label: 'CSV',
        color: '#16a34a',
        bgColor: '#f0fdf4',
        icon: 'document',
    },
    'text/plain': {
        label: 'TXT',
        color: '#6b7280',
        bgColor: '#f9fafb',
        icon: 'document',
    },
    'video/mp4': {
        label: 'MP4',
        color: '#9333ea',
        bgColor: '#faf5ff',
        icon: 'video',
    },
    'video/quicktime': {
        label: 'MOV',
        color: '#9333ea',
        bgColor: '#faf5ff',
        icon: 'video',
    },
    'video/webm': {
        label: 'WEBM',
        color: '#9333ea',
        bgColor: '#faf5ff',
        icon: 'video',
    },
    'audio/mpeg': {
        label: 'MP3',
        color: '#0d9488',
        bgColor: '#f0fdfa',
        icon: 'audio',
    },
    'audio/wav': {
        label: 'WAV',
        color: '#0d9488',
        bgColor: '#f0fdfa',
        icon: 'audio',
    },
    'audio/ogg': {
        label: 'OGG',
        color: '#0d9488',
        bgColor: '#f0fdfa',
        icon: 'audio',
    },
};

const DEFAULT_CONFIG: FileTypeConfig = {
    label: 'FILE',
    color: '#6b7280',
    bgColor: '#f9fafb',
    icon: 'document',
};

const config = computed(
    (): FileTypeConfig => FILE_TYPE_MAP[props.mimeType] ?? DEFAULT_CONFIG,
);
</script>

<template>
    <div
        class="tpl:flex tpl:aspect-square tpl:flex-col tpl:items-center tpl:justify-center tpl:gap-2"
    >
        <!-- Document icon -->
        <svg
            v-if="config.icon === 'document'"
            width="60"
            height="60"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            :style="{ color: config.color }"
        >
            <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            />
            <polyline points="14 2 14 8 20 8" />
            <line x1="8" y1="13" x2="16" y2="13" />
            <line x1="8" y1="17" x2="12" y2="17" />
        </svg>

        <!-- Video icon -->
        <svg
            v-else-if="config.icon === 'video'"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            :style="{ color: config.color }"
        >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <polygon
                points="10,8 16,12 10,16"
                fill="currentColor"
                stroke="none"
            />
        </svg>

        <!-- Audio icon -->
        <svg
            v-else
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            :style="{ color: config.color }"
        >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
        </svg>

        <span
            class="tpl:text-xs tpl:font-bold tpl:tracking-wider"
            :style="{ color: config.color }"
        >
            {{ config.label }}
        </span>
    </div>
</template>
