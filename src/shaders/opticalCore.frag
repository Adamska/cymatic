uniform float uTime;
uniform float uBass;
uniform float uHigh;
uniform float uRms;
uniform float uIridescence;
uniform float uEnvIntensity;
uniform vec3 uPaletteOffset;
uniform vec3 uPaletteAmplitude;
uniform vec3 uPaletteFrequency;
uniform vec3 uPalettePhase;
uniform samplerCube uEnvMap;

#if NUM_POINT_LIGHTS > 0
struct PointLight {
  vec3 position;
  vec3 color;
  float distance;
  float decay;
};
uniform PointLight pointLights[NUM_POINT_LIGHTS];
#endif

#if NUM_SPOT_LIGHTS > 0
struct SpotLight {
  vec3 position;
  vec3 direction;
  vec3 color;
  float distance;
  float decay;
  float coneCos;
  float penumbraCos;
};
uniform SpotLight spotLights[NUM_SPOT_LIGHTS];
#endif

varying vec3 vViewPosition;
varying vec3 vViewNormal;
varying float vHeight;

const float TAU = 6.28318530718;
const float FILM_IOR = 1.38;
const vec3 FILM_WAVELENGTHS = vec3(650.0, 532.0, 450.0);
const float WRAP = 0.45;
const float SHININESS = 96.0;
const float SCATTER_DISTORTION = 0.42;
const float SCATTER_POWER = 3.0;
const float BASE_REFLECTANCE = 0.06;

vec3 palette(float t) {
  return max(uPaletteOffset + uPaletteAmplitude * cos(TAU * (uPaletteFrequency * t + uPalettePhase)), 0.0);
}

vec3 thinFilm(float cosTheta, float thickness) {
  float sinRefracted2 = (1.0 - cosTheta * cosTheta) / (FILM_IOR * FILM_IOR);
  float pathDifference = 2.0 * FILM_IOR * thickness * sqrt(1.0 - sinRefracted2);
  return 0.5 + 0.5 * cos(TAU * pathDifference / FILM_WAVELENGTHS);
}

float attenuate(float lightDistance, float cutoff, float decay) {
  float falloff = 1.0 / max(pow(lightDistance, decay), 0.01);
  if (cutoff > 0.0) {
    float window = clamp(1.0 - pow(lightDistance / cutoff, 4.0), 0.0, 1.0);
    falloff *= window * window;
  }
  return falloff;
}

void shade(vec3 L, vec3 radiance, vec3 N, vec3 V, inout vec3 diffuse, inout vec3 specular, inout vec3 scatter) {
  float NdotL = dot(N, L);
  float wrapped = clamp((NdotL + WRAP) / (1.0 + WRAP), 0.0, 1.0);
  diffuse += radiance * wrapped * wrapped;

  vec3 H = normalize(L + V);
  float lobe = pow(max(dot(N, H), 0.0), SHININESS) * (SHININESS + 8.0) / (4.0 * TAU);
  specular += radiance * lobe * max(NdotL, 0.0);

  vec3 through = normalize(L + N * SCATTER_DISTORTION);
  scatter += radiance * pow(clamp(dot(V, -through), 0.0, 1.0), SCATTER_POWER);
}

void main() {
  vec3 N = normalize(vViewNormal);
  vec3 V = normalize(vViewPosition);
  float NdotV = clamp(dot(N, V), 0.0, 1.0);
  float fresnel = pow(1.0 - NdotV, 5.0);

  vec3 diffuse = vec3(0.0);
  vec3 specular = vec3(0.0);
  vec3 scatter = vec3(0.0);

  #if NUM_POINT_LIGHTS > 0
  for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
    vec3 toLight = pointLights[i].position + vViewPosition;
    float lightDistance = length(toLight);
    vec3 radiance = pointLights[i].color * attenuate(lightDistance, pointLights[i].distance, pointLights[i].decay);
    shade(toLight / lightDistance, radiance, N, V, diffuse, specular, scatter);
  }
  #endif

  #if NUM_SPOT_LIGHTS > 0
  for (int i = 0; i < NUM_SPOT_LIGHTS; i++) {
    vec3 toLight = spotLights[i].position + vViewPosition;
    float lightDistance = length(toLight);
    vec3 L = toLight / lightDistance;
    float cone = smoothstep(spotLights[i].coneCos, spotLights[i].penumbraCos, dot(L, spotLights[i].direction));
    vec3 radiance = spotLights[i].color * cone * attenuate(lightDistance, spotLights[i].distance, spotLights[i].decay);
    shade(L, radiance, N, V, diffuse, specular, scatter);
  }
  #endif

  float tone = vHeight * 1.5 + fresnel * 0.28 + uTime * 0.015 + uHigh * 0.22;
  vec3 body = palette(tone);
  vec3 glow = palette(tone + 0.33 + uHigh * 0.15);

  float thickness = mix(250.0, 620.0, clamp(0.5 + vHeight * 1.7, 0.0, 1.0)) + fresnel * 110.0 + uHigh * 170.0;
  vec3 film = thinFilm(NdotV, thickness);
  vec3 sheen = mix(vec3(1.0), film * 1.7, uIridescence);

  vec3 reflected = (vec4(reflect(-V, N), 0.0) * viewMatrix).xyz;
  vec3 environment = textureCube(uEnvMap, reflected).rgb * uEnvIntensity;
  float reflectance = mix(BASE_REFLECTANCE, 1.0, fresnel);

  float translucency = smoothstep(-0.25, 0.3, vHeight);
  float crest = pow(clamp(vHeight * 2.2, 0.0, 1.0), 2.0);
  float occlusion = mix(0.38, 1.0, smoothstep(-0.3, 0.12, vHeight));

  vec3 color = body * (0.03 + diffuse) * (1.0 - reflectance) * occlusion;
  color += glow * scatter * mix(0.35, 1.0, translucency) * (0.5 + uRms * 0.7);
  color += (specular + environment * reflectance * mix(0.6, 1.0, occlusion)) * sheen;
  color += film * fresnel * uIridescence * (0.3 + uHigh * 0.8);
  color += glow * crest * (uRms * 0.7 + uBass * 0.25);

  gl_FragColor = vec4(color, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
