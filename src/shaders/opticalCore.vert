uniform vec3 uPhase;
uniform float uBands[6];
uniform float uPitch;
uniform float uKickAge;
uniform float uKickForce;
uniform float uSnapAge;
uniform float uSnapForce;
uniform vec3 uStretch;
uniform float uTurbulence;
uniform float uDisplacement;
uniform sampler2D uSpectrum;
uniform float uSpectrumMean;
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
const float SOFT_CEILING = 1.1;
const float DEPTH_SCALE = 2.5;
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

// A band's spring, kept in a range the shapes are tuned for.
float band(int index) {
  return clamp(uBands[index], -0.35, 1.5);
}

float spectralLift(vec3 direction, vec3 swirl, float detail, out float frequency) {
  frequency = spectralFrequency(direction, swirl);
  return texture2D(uSpectrum, vec2(0.01 + frequency * 0.98, 0.5)).r * (0.6 + 0.4 * detail);
}

#include <cymatic_shape_organism>

float heightField(vec3 direction, out float lift, out float frequency) {
  float amplitude = uDisplacement * DEPTH_SCALE / mix(1.0, uTurbulence, 0.6);
  float height = shapeField(direction, lift, frequency) * amplitude;
  height += waveRing(direction) * WAVE_BULGE + strikeRipple(direction) * STRIKE_DEPTH;
  return height / (1.0 + max(height, 0.0) * SOFT_CEILING);
}

float heightField(vec3 direction) {
  float lift;
  float frequency;
  return heightField(direction, lift, frequency);
}

vec3 displace(vec3 direction) {
  return direction * (1.0 + heightField(direction)) * uStretch;
}

void main() {
  vec3 direction = normalize(position);
  vec3 reference = abs(direction.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(reference, direction));
  vec3 bitangent = cross(direction, tangent);

  float lift;
  float frequency;
  float height = heightField(direction, lift, frequency);
  vec3 displaced = direction * (1.0 + height) * uStretch;
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
