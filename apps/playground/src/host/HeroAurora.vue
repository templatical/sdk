<script setup lang="ts">
import {
  useDevicePixelRatio,
  useEventListener,
  useIntersectionObserver,
  usePreferredReducedMotion,
  useResizeObserver,
} from "@vueuse/core";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  AURORA_FRAME_MS,
  AURORA_IDLE_MS,
  AURORA_RENDER_SCALE,
  AURORA_VERTEX,
  auroraFragment,
} from "@/host/aurora";
import { usePlaygroundTheme } from "@/i18n";

/*
 * Ported from templatical.com's HeroAurora (same shader, quieter palette in
 * aurora.ts). Two differences that are the point of this copy: it stops a
 * stretch after the pointer does, so the home page is still most of the time,
 * and it paints behind the hero only, under a fade into the page's paper.
 */

const root = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const renderer = ref<"webgl2" | "fallback">("webgl2");
const running = ref(false);

const { isDark } = usePlaygroundTheme();
const reducedMotion = usePreferredReducedMotion();
const { pixelRatio } = useDevicePixelRatio();

let gl: WebGL2RenderingContext | null = null;
let program: WebGLProgram | null = null;
let raf = 0;
let idleTimer = 0;
let visible = true;
// Time only advances while the loop runs, so a resume picks up where the
// field stopped instead of jumping.
let elapsed = 0;
let last = 0;
let drawnAt = 0;
let mouseX = 0.5;
let mouseY = 0.4;
let targetX = 0.5;
let targetY = 0.4;

function compile(type: number, source: string): WebGLShader | null {
  if (!gl) return null;
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.warn(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

function init(): boolean {
  const c = canvas.value;
  const ctx = c?.getContext("webgl2", {
    antialias: false,
    premultipliedAlpha: false,
    powerPreference: "low-power",
  });
  if (!ctx) return false;
  gl = ctx;
  const vs = compile(gl.VERTEX_SHADER, AURORA_VERTEX);
  const fs = compile(gl.FRAGMENT_SHADER, auroraFragment());
  if (!vs || !fs) return false;
  const p = gl.createProgram();
  if (!p) return false;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(p));
    return false;
  }
  program = p;
  gl.useProgram(p);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(p, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  return true;
}

function resize(): void {
  const c = canvas.value;
  if (!c || !gl) return;
  const scale = Math.min(2, pixelRatio.value || 1) * AURORA_RENDER_SCALE;
  const width = Math.max(1, Math.floor(c.clientWidth * scale));
  const height = Math.max(1, Math.floor(c.clientHeight * scale));
  if (c.width === width && c.height === height) return;
  c.width = width;
  c.height = height;
  gl.viewport(0, 0, width, height);
}

function draw(): void {
  if (!gl || !program || !canvas.value) return;
  gl.uniform1f(gl.getUniformLocation(program, "uT"), elapsed);
  gl.uniform2f(
    gl.getUniformLocation(program, "uR"),
    canvas.value.width,
    canvas.value.height,
  );
  gl.uniform2f(gl.getUniformLocation(program, "uM"), mouseX, 1 - mouseY);
  gl.uniform1f(gl.getUniformLocation(program, "uDark"), isDark.value ? 1 : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function frame(now: number): void {
  if (last) elapsed += (now - last) / 1000;
  last = now;
  raf = requestAnimationFrame(frame);
  if (now - drawnAt < AURORA_FRAME_MS) return;
  drawnAt = now;
  mouseX += (targetX - mouseX) * 0.12;
  mouseY += (targetY - mouseY) * 0.12;
  draw();
}

function stop(): void {
  cancelAnimationFrame(raf);
  window.clearTimeout(idleTimer);
  raf = 0;
  last = 0;
  running.value = false;
}

/** Moves for a stretch after each call, then holds still. */
function wake(): void {
  if (!gl) return;
  if (reducedMotion.value === "reduce" || !visible) {
    stop();
    draw();
    return;
  }
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(stop, AURORA_IDLE_MS);
  if (!raf) raf = requestAnimationFrame(frame);
  running.value = true;
}

useEventListener(
  window,
  "pointermove",
  (event: PointerEvent) => {
    const el = root.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    targetX = (event.clientX - rect.left) / rect.width;
    targetY = (event.clientY - rect.top) / rect.height;
    wake();
  },
  { passive: true },
);

useResizeObserver(canvas, () => {
  resize();
  if (!raf) draw();
});

useIntersectionObserver(root, ([entry]) => {
  visible = entry?.isIntersecting ?? true;
  if (!visible) stop();
});

// A theme or motion change repaints; it does not start the drift again.
watch([isDark, reducedMotion, pixelRatio], () => {
  if (reducedMotion.value === "reduce") stop();
  resize();
  if (!raf) draw();
});

onMounted(() => {
  if (!init()) {
    renderer.value = "fallback";
    return;
  }
  resize();
  wake();
});

onBeforeUnmount(stop);
</script>

<template>
  <div
    ref="root"
    data-testid="hero-aurora"
    :data-renderer="renderer"
    :data-running="running ? 'true' : 'false'"
    aria-hidden="true"
    class="pg-hero-aurora"
  >
    <canvas
      v-show="renderer === 'webgl2'"
      ref="canvas"
      class="absolute inset-0 size-full"
    />
    <div v-if="renderer === 'fallback'" class="pg-hero-aurora-fallback" />
    <div class="pg-hero-aurora-fade" />
  </div>
</template>
