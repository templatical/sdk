<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{ text: string; accent?: string }>();

const root = ref<HTMLElement | null>(null);
const enhanced = ref(false);

// Split into words to avoid breaking word-wrap, then into chars inside each word.
const tokens = computeTokens(props.text, props.accent);

function computeTokens(text: string, accent?: string) {
    const words = text.split(/(\s+)/);
    let charIndex = 0;
    return words.map((w, i) => {
        if (/^\s+$/.test(w)) return { kind: 'space' as const, id: i };
        const isAccent = accent ? w.replace(/[.,]$/, '') === accent : false;
        const chars = Array.from(w).map((c) => ({
            c,
            i: charIndex++,
        }));
        return { kind: 'word' as const, id: i, isAccent, chars };
    });
}

let pointerHandler: ((e: PointerEvent) => void) | null = null;
let raf = 0;
let disposed = false;

onMounted(() => {
    if (typeof window === 'undefined') return;
    const prefersReduced = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
    ).matches;

    enhanced.value = true;

    const el = root.value;
    if (!el) return;

    const chars = Array.from(
        el.querySelectorAll<HTMLElement>('.hh__c'),
    );
    const total = chars.length;
    const startDelay = 80;
    const perChar = 18;
    const duration = 720;

    // Settle-in animation — slight overshoot via cubic-bezier spring.
    if (!prefersReduced) {
        chars.forEach((node, i) => {
            node.animate(
                [
                    {
                        opacity: 0,
                        transform: 'translateY(14px) scale(0.96)',
                        filter: 'blur(6px)',
                    },
                    {
                        opacity: 1,
                        transform: 'translateY(0) scale(1)',
                        filter: 'blur(0)',
                    },
                ],
                {
                    duration,
                    delay: startDelay + i * perChar,
                    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    fill: 'both',
                },
            );
        });
    } else {
        chars.forEach((node) => {
            node.style.opacity = '1';
            node.style.transform = 'none';
            node.style.filter = 'none';
        });
        return;
    }

    // Cursor-driven letter drift (skip on coarse pointer).
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (coarse) return;

    let targetX = -9999;
    let targetY = -9999;

    pointerHandler = (e: PointerEvent) => {
        targetX = e.clientX;
        targetY = e.clientY;
    };
    window.addEventListener('pointermove', pointerHandler, { passive: true });

    // Cache static bounding-box centers; refresh on resize.
    let centers: { x: number; y: number }[] = [];
    const measure = () => {
        centers = chars.map((c) => {
            const r = c.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener('scroll', measure, { passive: true });

    const driftStart = performance.now() + startDelay + total * perChar + duration;
    const radius = 120;

    const tick = () => {
        if (disposed) return;
        const now = performance.now();
        if (now < driftStart) {
            raf = requestAnimationFrame(tick);
            return;
        }
        for (let i = 0; i < chars.length; i++) {
            const c = centers[i];
            if (!c) continue;
            const dx = targetX - c.x;
            const dy = targetY - c.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > radius * radius) {
                chars[i].style.transform = '';
                continue;
            }
            const d = Math.sqrt(d2);
            const f = (1 - d / radius) ** 2;
            const tx = -(dx / Math.max(d, 1)) * f * 4;
            const ty = -(dy / Math.max(d, 1)) * f * 4 - f * 2;
            chars[i].style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
        }
        raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    onBeforeUnmount(() => {
        disposed = true;
        cancelAnimationFrame(raf);
        if (pointerHandler) {
            window.removeEventListener('pointermove', pointerHandler);
        }
        ro.disconnect();
        window.removeEventListener('scroll', measure);
    });
});
</script>

<template>
    <h1
        ref="root"
        class="hh title-tighter mt-6 text-[clamp(2.25rem,6vw,3.75rem)] font-semibold leading-[1.05] text-text"
        :class="{ 'hh--enhanced': enhanced }"
    >
        <span class="sr-only">{{ text }}</span>
        <template v-for="tok in tokens" :key="tok.id">
            <span v-if="tok.kind === 'space'" class="hh__sp" aria-hidden="true">{{ ' ' }}</span>
            <span
                v-else
                class="hh__w"
                :class="{ 'hh__w--accent': tok.isAccent }"
                aria-hidden="true"
            >
                <span
                    v-for="ch in tok.chars"
                    :key="ch.i"
                    class="hh__c"
                >{{ ch.c }}</span>
            </span>
        </template>
    </h1>
</template>

<style scoped>
.hh {
    position: relative;
}
.hh__w {
    display: inline-block;
    white-space: pre;
}
.hh__sp {
    display: inline-block;
    white-space: pre;
}
.hh__c {
    display: inline-block;
    will-change: transform, opacity, filter;
    transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
}
.hh--enhanced .hh__c {
    opacity: 0;
}
.hh__w--accent .hh__c {
    color: var(--primary);
}
@media (prefers-reduced-motion: reduce) {
    .hh--enhanced .hh__c {
        opacity: 1;
    }
    .hh__c {
        transition: none;
    }
}
</style>
