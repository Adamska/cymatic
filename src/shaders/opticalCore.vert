uniform vec3 uPhase;
uniform float uSwell;
uniform float uTwist;
uniform float uRipple;
uniform float uTurbulence;
uniform float uDisplacement;
uniform sampler2D uSpectrum;
uniform float uSpectrumMean;
uniform float uEnergy;

varying vec3 vViewPosition;
varying vec3 vViewNormal;
varying float vHeight;
varying float vSpectrum;
varying float vFrequency;

const float NORMAL_EPSILON = 0.012;
const float SPECTRAL_DEPTH = 0.34;
const float SOFT_CEILING = 1.25;
const float TWIST_ANGLE = 0.9;

// Simplex noise with analytic gradient, adapted from webgl-noise
// (Ian McEwan, Stefan Gustavson, Ashima Arts), MIT License.
vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
  return mod289((x * 34.0 + 10.0) * x);
}

float simplex(vec3 v, out vec3 gradient) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = i - floor(i * (1.0 / 289.0)) * 289.0;
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  vec3 ns = (1.0 / 7.0) * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  vec4 m2 = m * m;
  vec4 m4 = m2 * m2;
  vec4 pdotx = vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3));

  vec4 falloff = m2 * m * pdotx;
  gradient = -8.0 * (falloff.x * x0 + falloff.y * x1 + falloff.z * x2 + falloff.w * x3);
  gradient += m4.x * p0 + m4.y * p1 + m4.z * p2 + m4.w * p3;
  gradient *= 105.0;

  return 105.0 * dot(m4, pdotx);
}

vec3 curlNoise(vec3 p) {
  vec3 gx;
  vec3 gy;
  vec3 gz;
  simplex(p, gx);
  simplex(p + vec3(31.416, -47.853, 12.679), gy);
  simplex(p + vec3(-23.314, 9.172, 71.337), gz);
  return vec3(gz.y - gy.z, gx.z - gz.x, gy.x - gx.y);
}

vec3 twistAround(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
}

float spectralFrequency(vec3 direction, vec3 swirl) {
  vec3 unused;
  float meander = simplex(direction * 1.6 + uPhase.y * 0.04, unused);
  float latitude = clamp(direction.y + swirl.y * 0.8 + meander * 0.22, -1.0, 1.0);
  return abs(latitude);
}

float heightField(vec3 direction, out float lift, out float frequency) {
  vec3 slow = vec3(0.0, uPhase.x * 0.11, uPhase.x * 0.07);
  vec3 stir = vec3(uPhase.y * 0.05, uPhase.y * 0.11, uPhase.y * 0.07);
  vec3 skitter = vec3(uPhase.z * 0.29, -uPhase.z * 0.23, uPhase.z * 0.17);
  float swell = clamp(uSwell, 0.0, 1.4);
  float twist = clamp(uTwist, 0.0, 1.0);
  float ripple = clamp(uRipple, 0.0, 1.4);
  vec3 twisted = twistAround(direction, direction.y * twist * TWIST_ANGLE);
  vec3 swirl = curlNoise(twisted * 0.7 * uTurbulence + stir) * (0.06 + twist * 0.14);
  vec3 domain = twisted * uTurbulence + swirl;

  vec3 unused;
  float broad = simplex(domain * 1.05 + slow.zxy * 1.6, unused);
  float fine = simplex(domain * 2.1 - stir * 2.4, unused);
  float micro = simplex(direction * 8.5 * mix(1.0, uTurbulence, 0.5) + swirl * 2.0 + skitter, unused);
  float crest = 1.0 - abs(micro);

  frequency = spectralFrequency(direction, swirl);
  float band = texture2D(uSpectrum, vec2(0.01 + frequency * 0.98, 0.5)).r;
  lift = band * (0.6 + 0.4 * fine);

  float amplitude = uDisplacement / mix(1.0, uTurbulence, 0.6) * (0.8 + clamp(uEnergy, 0.0, 1.8) * 0.45);
  float lobes = broad * (0.26 + swell * 0.85);
  float folds = fine * twist * 0.3;
  float ripples = (crest * crest * crest - 0.35) * ripple * 0.34;
  float spectral = (lift - uSpectrumMean * 0.5) * SPECTRAL_DEPTH;
  float height = (lobes + folds + ripples + spectral) * amplitude;
  return height / (1.0 + max(height, 0.0) * SOFT_CEILING);
}

float heightField(vec3 direction) {
  float lift;
  float frequency;
  return heightField(direction, lift, frequency);
}

vec3 displace(vec3 direction) {
  return direction * (1.0 + heightField(direction));
}

void main() {
  vec3 direction = normalize(position);
  vec3 reference = abs(direction.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(reference, direction));
  vec3 bitangent = cross(direction, tangent);

  float lift;
  float frequency;
  float height = heightField(direction, lift, frequency);
  vec3 displaced = direction * (1.0 + height);
  vec3 alongTangent = displace(normalize(direction + tangent * NORMAL_EPSILON));
  vec3 alongBitangent = displace(normalize(direction + bitangent * NORMAL_EPSILON));
  vec3 displacedNormal = normalize(cross(alongTangent - displaced, alongBitangent - displaced));

  vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
  vViewPosition = -viewPosition.xyz;
  vViewNormal = normalize(normalMatrix * displacedNormal);
  vHeight = height;
  vSpectrum = lift;
  vFrequency = frequency;

  gl_Position = projectionMatrix * viewPosition;
}
