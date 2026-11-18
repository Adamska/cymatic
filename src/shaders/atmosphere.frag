uniform float uTime;
uniform float uBass;
uniform float uRms;
uniform vec3 uPaletteOffset;
uniform vec3 uPaletteAmplitude;
uniform vec3 uPaletteFrequency;
uniform vec3 uPalettePhase;

varying vec3 vWorldPosition;

const float TAU = 6.28318530718;

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
  color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;

  gl_FragColor = vec4(max(color, 0.0), 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
