<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const canvas = ref<HTMLCanvasElement | null>(null);
const fallback = ref(false);

type OklchReader = (varName: string) => [number, number, number];

const vertSrc = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Amber/blue aurora flow in linear sRGB (converted from OKLch on the CPU).
// Soft, slow, low-contrast. Reacts to pointer via u_mouse (0..1, with smoothing).
const fragSrc = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform float u_time;
uniform vec2 u_res;
uniform vec2 u_mouse;
uniform vec3 u_c1;  // primary (amber)
uniform vec3 u_c2;  // secondary (blue)
uniform vec3 u_bg;  // page background
uniform float u_dark;

// hash & 2D simplex-ish noise (cheap value noise with smoothing).
float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f*f*(3.0 - 2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 p = uv;
  p.x *= aspect;

  float t = u_time * 0.035;

  // Slow drifting flow field.
  vec2 q = vec2(
    fbm(p * 1.3 + vec2(0.0, t)),
    fbm(p * 1.3 + vec2(5.2, -t * 0.8))
  );
  vec2 r = vec2(
    fbm(p * 1.1 + 3.5 * q + vec2(1.7, 9.2) + t),
    fbm(p * 1.1 + 3.5 * q + vec2(8.3, 2.8) - t * 0.7)
  );
  float n = fbm(p * 1.2 + 2.0 * r);

  // Cursor warp — a soft lens pulling the flow toward the pointer.
  vec2 m = u_mouse;
  m.x *= aspect;
  float d = distance(p, m);
  float lens = exp(-d * d * 3.0) * 0.35;
  n = n + lens * (0.6 - n);

  // Two-axis blend: x-axis tilts amber↔blue, n modulates mix depth.
  float tilt = smoothstep(0.15, 0.95, uv.x * 0.6 + n * 0.55);
  vec3 color = mix(u_c1, u_c2, tilt);

  // Highlight ridges — sparse amber glow along flow.
  float ridge = smoothstep(0.55, 0.8, n) - smoothstep(0.8, 0.95, n);
  color += u_c1 * ridge * 0.55;

  // Bottom-up fade into page background so hero blends seamlessly.
  float vFade = smoothstep(0.0, 1.0, uv.y);
  float alphaMask = pow(vFade, 1.3);

  // Overall intensity: dim by default, lifts near cursor.
  float intensity = mix(0.32, 0.62, lens * 2.0);
  intensity = clamp(intensity, 0.28, 0.7);

  // Compose onto background. In dark mode we lift a touch more.
  float lift = mix(1.0, 1.35, u_dark);
  vec3 final = mix(u_bg, color, alphaMask * intensity * lift);

  // Subtle grain to avoid banding.
  float g = (hash(gl_FragCoord.xy + u_time) - 0.5) * 0.012;
  final += g;

  outColor = vec4(final, 1.0);
}`;

// --- color parsing ------------------------------------------------------

function parseOklchVar(value: string): [number, number, number] | null {
  const m = value.match(/oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/i);
  if (!m) return null;
  const L = parseFloat(m[1]) / 100;
  const C = parseFloat(m[2]);
  const h = (parseFloat(m[3]) * Math.PI) / 180;
  return oklchToLinearSrgb(L, C, h);
}

// OKLab/OKLch → linear sRGB (Björn Ottosson).
function oklchToLinearSrgb(
  L: number,
  C: number,
  h: number,
): [number, number, number] {
  const a = Math.cos(h) * C;
  const b = Math.sin(h) * C;
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;
  const r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
  return [Math.max(0, r), Math.max(0, g), Math.max(0, bl)];
}

// --- component lifecycle ------------------------------------------------

let raf = 0;
let observer: IntersectionObserver | null = null;
let resizeObs: ResizeObserver | null = null;
let themeObs: MutationObserver | null = null;
let disposed = false;
let running = false;
let lastTime = 0;
let elapsed = 0;

onMounted(() => {
  if (typeof window === "undefined") return;
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (prefersReduced) {
    fallback.value = true;
    return;
  }

  const el = canvas.value;
  if (!el) return;

  const gl = el.getContext("webgl2", {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
    powerPreference: "low-power",
  }) as WebGL2RenderingContext | null;

  if (!gl) {
    fallback.value = true;
    return;
  }

  const program = compile(gl, vertSrc, fragSrc);
  if (!program) {
    fallback.value = true;
    return;
  }
  gl.useProgram(program);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(program, "u_time");
  const uRes = gl.getUniformLocation(program, "u_res");
  const uMouse = gl.getUniformLocation(program, "u_mouse");
  const uC1 = gl.getUniformLocation(program, "u_c1");
  const uC2 = gl.getUniformLocation(program, "u_c2");
  const uBg = gl.getUniformLocation(program, "u_bg");
  const uDark = gl.getUniformLocation(program, "u_dark");

  const readColors: OklchReader = (name) => {
    const cs = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return parseOklchVar(cs) ?? [0.5, 0.5, 0.5];
  };
  let c1 = readColors("--primary");
  let c2 = readColors("--secondary");
  let bg = readColors("--bg");
  let dark =
    document.documentElement.getAttribute("data-theme") === "dark" ? 1 : 0;

  const refreshColors = () => {
    c1 = readColors("--primary");
    c2 = readColors("--secondary");
    bg = readColors("--bg");
    dark =
      document.documentElement.getAttribute("data-theme") === "dark" ? 1 : 0;
  };
  themeObs = new MutationObserver(refreshColors);
  themeObs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  // Smoothed mouse (0..1 in canvas space, y flipped for WebGL convention).
  const target = { x: 0.5, y: 0.5 };
  const smoothed = { x: 0.5, y: 0.5 };
  const onPointer = (e: PointerEvent) => {
    const rect = el.getBoundingClientRect();
    target.x = (e.clientX - rect.left) / rect.width;
    target.y = 1 - (e.clientY - rect.top) / rect.height;
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = el.clientWidth;
    const h = el.clientHeight;
    el.width = Math.max(1, Math.floor(w * dpr));
    el.height = Math.max(1, Math.floor(h * dpr));
    gl.viewport(0, 0, el.width, el.height);
  };
  resize();
  resizeObs = new ResizeObserver(resize);
  resizeObs.observe(el);

  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries[0]?.isIntersecting ?? false;
      if (visible && !running && !disposed) {
        running = true;
        lastTime = performance.now();
        raf = requestAnimationFrame(frame);
      } else if (!visible && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    },
    { threshold: 0 },
  );
  observer.observe(el);

  const frame = (now: number) => {
    if (disposed || !running) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    elapsed += dt;

    // Spring-ish smoothing toward target.
    const k = 1 - Math.exp(-dt * 6);
    smoothed.x += (target.x - smoothed.x) * k;
    smoothed.y += (target.y - smoothed.y) * k;

    gl.uniform1f(uTime, elapsed);
    gl.uniform2f(uRes, el.width, el.height);
    gl.uniform2f(uMouse, smoothed.x, smoothed.y);
    gl.uniform3f(uC1, c1[0], c1[1], c1[2]);
    gl.uniform3f(uC2, c2[0], c2[1], c2[2]);
    gl.uniform3f(uBg, bg[0], bg[1], bg[2]);
    gl.uniform1f(uDark, dark);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    raf = requestAnimationFrame(frame);
  };

  onBeforeUnmount(() => {
    disposed = true;
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onPointer);
    observer?.disconnect();
    resizeObs?.disconnect();
    themeObs?.disconnect();
    const ext = gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
  });
});

function compile(gl: WebGL2RenderingContext, v: string, f: string) {
  const vs = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vs, v);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) return null;
  const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fs, f);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) return null;
  const p = gl.createProgram()!;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
  return p;
}
</script>

<template>
  <div class="hero-aurora" aria-hidden="true">
    <canvas v-if="!fallback" ref="canvas" class="hero-aurora__canvas" />
    <div v-else class="hero-aurora__fallback" />
  </div>
</template>

<style scoped>
.hero-aurora {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
  mask-image: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 0.85) 50%,
    rgba(0, 0, 0, 0.3) 85%,
    transparent 100%
  );
}
.hero-aurora__canvas,
.hero-aurora__fallback {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.hero-aurora__fallback {
  background:
    radial-gradient(
      60% 70% at 20% 10%,
      color-mix(in oklch, var(--primary) 35%, transparent),
      transparent 70%
    ),
    radial-gradient(
      55% 60% at 85% 30%,
      color-mix(in oklch, var(--secondary) 25%, transparent),
      transparent 70%
    );
  opacity: 0.55;
}
</style>
