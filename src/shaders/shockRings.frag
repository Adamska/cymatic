uniform float uAges[6];
uniform float uForces[6];
uniform vec3 uColors[6];
uniform float uReach;

varying vec2 vUv;

const float LIFE = 1.6;
const float TAU = 6.28318530718;

// Rings of light expanding behind the sculpture on the strongest beats. Each edge wobbles
// a little so the wave reads as a pressure front in a fluid rather than a perfect circle.
void main() {
  vec2 p = (vUv - 0.5) * 2.0 * uReach;
  float r = length(p);
  float angle = atan(p.y, p.x);
  vec3 color = vec3(0.0);

  for (int i = 0; i < 6; i++) {
    float age = uAges[i];
    if (age >= LIFE) continue;
    float t = age / LIFE;
    float eased = 1.0 - pow(1.0 - t, 2.6);
    float radius = mix(1.3, uReach * 0.92, eased);
    radius *= 1.0 + sin(angle * 5.0 + float(i) * 1.7 + age * 3.0) * 0.018 + sin(angle * 3.0 - float(i)) * 0.012;
    float width = mix(0.05, 0.5, t);
    float edge = exp(-pow((r - radius) / width, 2.0));
    float wake = smoothstep(radius, radius - width * 5.0, r) * smoothstep(1.1, 1.6, r) * 0.18;
    float fade = pow(1.0 - t, 1.6) * uForces[i];
    color += uColors[i] * (edge + wake) * fade;
  }

  gl_FragColor = vec4(color, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
