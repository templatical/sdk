/**
 * The home page hero's aurora, ported from templatical.com's HeroAurora and
 * made quieter. The palette lives here, outside the shader, so a unit test can
 * prove the hero's text still clears 4.5:1 over the aurora's worst pixel:
 * templatical.com's own palette takes the lede to 3.10:1 on this page.
 */

/** OKLCH as [lightness 0–1, chroma, hue in degrees]. */
export type Lch = readonly [number, number, number];

export interface AuroraTheme {
  /** The page background: the aurora fades into it, so it must match. */
  base: Lch;
  accent: Lch;
  copper: Lch;
  gold: Lch;
  /** How far the pointer halo lifts lightness near the cursor. */
  halo: number;
}

export const AURORA_THEMES: Readonly<Record<"light" | "dark", AuroraTheme>> = {
  light: {
    base: [0.995, 0.002, 60],
    accent: [0.915, 0.06, 55],
    copper: [0.93, 0.045, 35],
    gold: [0.955, 0.03, 80],
    halo: 0.04,
  },
  dark: {
    base: [0.19, 0.008, 60],
    accent: [0.255, 0.05, 55],
    copper: [0.23, 0.035, 35],
    gold: [0.215, 0.02, 80],
    halo: 0.03,
  },
};

/** The darkest the vignette takes any pixel, as a factor on sRGB. */
export const AURORA_VIGNETTE_FLOOR = 0.97;

/** Film grain against banding: each pixel moves by up to this in sRGB. */
export const AURORA_GRAIN = 0.004;

/** How long the aurora keeps moving after the pointer last did. */
export const AURORA_IDLE_MS = 6000;

/**
 * The field is soft noise, so it renders at half the CSS resolution and the
 * browser scales it up with no visible loss. With the 30fps cap below, that
 * is an eighth of the fragment work, which is what keeps software WebGL
 * (headless Chromium, some laptops) from pinning a core.
 */
export const AURORA_RENDER_SCALE = 0.5;
export const AURORA_FRAME_MS = 33;

function lch(c: Lch): string {
  return `lch(${c[0].toFixed(3)}, ${c[1].toFixed(3)}, ${c[2].toFixed(1)})`;
}

export const AURORA_VERTEX = `#version 300 es
in vec2 a;
void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

/** The fragment shader, with both themes' palettes written in. */
export function auroraFragment(
  themes: typeof AURORA_THEMES = AURORA_THEMES,
): string {
  const { light, dark } = themes;
  const pick = (a: Lch, b: Lch) => `mix(${lch(a)}, ${lch(b)}, uDark)`;
  return `#version 300 es
precision highp float;
out vec4 o;
uniform float uT;
uniform vec2 uR;
uniform vec2 uM;
uniform float uDark;

vec3 hash3(vec2 p){
  vec3 q = vec3(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)), dot(p,vec2(419.2,371.9)));
  return fract(sin(q)*43758.5453);
}
float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  float a = hash3(i).x;
  float b = hash3(i+vec2(1.0,0.0)).x;
  float c = hash3(i+vec2(0.0,1.0)).x;
  float d = hash3(i+vec2(1.0,1.0)).x;
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float s = 0.0;
  float amp = 0.5;
  mat2 m = mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<5;i++){ s += amp*noise(p); p = m*p; amp *= 0.5; }
  return s;
}
vec3 oklabToLinear(vec3 c){
  float l_ = c.x + 0.3963377774*c.y + 0.2158037573*c.z;
  float m_ = c.x - 0.1055613458*c.y - 0.0638541728*c.z;
  float s_ = c.x - 0.0894841775*c.y - 1.2914855480*c.z;
  float l = l_*l_*l_;
  float m = m_*m_*m_;
  float s = s_*s_*s_;
  return vec3(
    4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
   -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
   -0.0041960863*l - 0.7034186147*m + 1.7076147010*s);
}
vec3 linearToSrgb(vec3 c){
  c = clamp(c, 0.0, 1.0);
  return mix(12.92*c, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
}
vec3 lch(float L, float C, float h){
  float r = radians(h);
  return vec3(L, C*cos(r), C*sin(r));
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uR.xy) / uR.y;
  vec2 m = (uM - 0.5) * vec2(uR.x/uR.y, 1.0);

  float t = uT * 0.04;
  vec2 q = uv*1.2 + vec2(t, -t*0.7);
  q += 0.35*vec2(fbm(uv*1.6 + t), fbm(uv*1.6 - t));
  float dm = length(uv - m*0.6);
  q += 0.18 * vec2(cos(t*1.3), sin(t*1.1)) * exp(-dm*1.8);

  float n = fbm(q);
  float n2 = fbm(q*1.7 + 5.0);
  float n3 = fbm(q*0.6 - 3.0);

  vec3 base = ${pick(light.base, dark.base)};
  vec3 accent = ${pick(light.accent, dark.accent)};
  vec3 copper = ${pick(light.copper, dark.copper)};
  vec3 gold = ${pick(light.gold, dark.gold)};

  vec3 lab = mix(base, accent, smoothstep(0.35, 0.85, n));
  lab = mix(lab, copper, smoothstep(0.45, 0.9, n2)*0.55);
  lab = mix(lab, gold, smoothstep(0.5, 0.95, n3)*0.35);
  lab.x += exp(-dm*2.6) * mix(${light.halo.toFixed(3)}, ${dark.halo.toFixed(3)}, uDark);

  vec3 srgb = linearToSrgb(oklabToLinear(lab));
  float vig = smoothstep(1.05, 0.2, length(uv*vec2(0.7,1.1)));
  srgb *= mix(${AURORA_VIGNETTE_FLOOR.toFixed(3)}, 1.0, vig);
  float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)))*43758.5453);
  srgb += (g - 0.5) * ${(AURORA_GRAIN * 2).toFixed(3)};
  o = vec4(srgb, 1.0);
}`;
}
