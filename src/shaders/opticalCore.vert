uniform vec3 uPhase;
uniform float uSwell;
uniform float uTwist;
uniform float uRipple;
uniform float uTurbulence;
uniform float uDisplacement;
uniform sampler2D uSpectrum;
uniform float uSpectrumMean;
uniform float uEnergy;
uniform float uWave;
uniform vec3 uWaveOrigin;
uniform vec3 uStrikeDir;
uniform float uStrikeAge;
uniform float uStrikeForce;

varying vec3 vViewPosition;
varying vec3 vViewNormal;
varying float vHeight;
varying float vSpectrum;
varying float vFrequency;
varying vec3 vDirection;

const float NORMAL_EPSILON = 0.012;
const float SPECTRAL_DEPTH = 0.34;
const float SOFT_CEILING = 1.25;
const float TWIST_ANGLE = 0.9;
const float PI = 3.14159265359;
const float WAVE_BULGE = 0.07;
const float STRIKE_DEPTH = 0.06;

#include <cymatic_simplex>

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

// A cue change: a bright ridge travelling from uWaveOrigin to the far side of the form.
float waveRing(vec3 direction) {
  float travelled = acos(clamp(dot(direction, uWaveOrigin), -1.0, 1.0)) / PI;
  float offset = (travelled - uWave * 1.25) / 0.05;
  return exp(-offset * offset) * (1.0 - uWave);
}

// A strike: concentric ripples spreading from the struck point and ringing out.
float strikeRipple(vec3 direction) {
  float angle = acos(clamp(dot(direction, uStrikeDir), -1.0, 1.0));
  float reach = uStrikeAge * 2.2;
  float envelope = exp(-uStrikeAge * 2.4) * exp(-angle * 0.9) * (1.0 - smoothstep(reach - 0.35, reach, angle));
  return sin(angle * 16.0 - uStrikeAge * 18.0) * envelope * uStrikeForce;
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
  height += waveRing(direction) * WAVE_BULGE + strikeRipple(direction) * STRIKE_DEPTH;
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
  vDirection = direction;

  gl_Position = projectionMatrix * viewPosition;
}
