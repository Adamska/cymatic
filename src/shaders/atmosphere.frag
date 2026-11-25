uniform float uTime;
uniform float uBass;
uniform float uRms;
uniform float uIntensity;
uniform float uFlow;
uniform float uFlash;
uniform vec3 uPaletteOffset;
uniform vec3 uPaletteAmplitude;
uniform vec3 uPaletteFrequency;
uniform vec3 uPalettePhase;

varying vec3 vWorldPosition;

const float TAU = 6.28318530718;

#include <cymatic_simplex>

vec3 palette(float t) {
  return max(uPaletteOffset + uPaletteAmplitude * cos(TAU * (uPaletteFrequency * t + uPalettePhase)), 0.0);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 ray = normalize(vWorldPosition - cameraPosition);
  vec3 toCore = -cameraPosition;
  float facing = smoothstep(0.0, 0.25, dot(ray, normalize(toCore)));
  float offAxis = length(cross(ray, toCore));

  float halo = exp(-offAxis * offAxis * 0.085) * facing;
  float corona = exp(-offAxis * offAxis * 0.42) * facing;
  float horizon = smoothstep(-0.7, 0.8, ray.y);

  vec3 floorTone = palette(0.08 + uTime * 0.006);
  vec3 skyTone = palette(0.58 + uTime * 0.006);
  vec3 color = mix(floorTone, skyTone, horizon) * 0.022;
  color += palette(0.36 + offAxis * 0.05) * halo * (0.05 + uRms * 0.16);
  color += palette(0.2 + offAxis * 0.08) * corona * (0.035 + uBass * 0.2);

  // Nebula: veils that only gather on strong passages and drift faster as the music pushes.
  float presence = uIntensity * uIntensity;
  if (presence > 0.002) {
    vec3 unused;
    vec3 drift = vec3(uFlow * 0.4, -uFlow * 0.25, uFlow * 0.3);
    float warp = simplex(ray * 1.3 + drift * 0.5, unused);
    float veil = simplex(ray * 2.4 + vec3(warp * 0.9) - drift, unused) * 0.65 + warp * 0.35;
    float wisps = smoothstep(0.05, 0.85, veil) * (1.0 - corona * 0.7);
    float tone = 0.45 + veil * 0.35 + uTime * 0.01;
    color += palette(tone) * wisps * presence * 0.11;
    color += palette(tone + 0.3) * pow(max(veil, 0.0), 3.0) * presence * 0.06;
  }
  color += palette(0.3 + offAxis * 0.06) * halo * uIntensity * 0.09;
  color += palette(0.15) * corona * uFlash * 0.5;
  color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;

  gl_FragColor = vec4(max(color, 0.0), 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
