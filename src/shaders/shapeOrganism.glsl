// The organic skin of the sculpture, where every band has a gesture of its own.
//   kick      a wave climbs the body from its base, with a slight swell of the whole form
//   snare     a thinner, faster wave falls from the crown
//   bass      weight: the broad lobes swell and roll
//   warmth    torsion: the body wrings around its vertical axis
//   voice     a ripple through the waist, like a swallow, and folds that open
//   transient squash: short, sharp peaks flatten the body, which bounces back tall (uStretch)
//   air       light: a rim in the hues of the cue and a gliding sheen, in the fragment stage
float travellingRing(float position, float age, float speed, float width) {
  float offset = (position - age * speed) / width;
  return exp(-offset * offset) * exp(-age * 2.4);
}

float shapeField(vec3 direction, out float lift, out float frequency) {
  float bass = band(1);
  float warmth = band(2);
  float voice = max(band(3), 0.0);

  vec3 slow = vec3(0.0, uPhase.x * 0.11, uPhase.x * 0.07);
  vec3 stir = vec3(uPhase.y * 0.05, uPhase.y * 0.11, uPhase.y * 0.07);
  vec3 twisted = twistAround(direction, direction.y * (0.2 + warmth * 1.25));
  vec3 swirl = curlNoise(twisted * 0.6 * uTurbulence + stir) * (0.05 + voice * 0.06);
  vec3 domain = twisted * uTurbulence + swirl;

  vec3 unused;
  float broad = simplex(domain * 1.05 + slow.zxy * 1.6, unused);
  float fine = simplex(domain * 1.7 - stir * 2.4, unused);
  float lobes = broad * (0.15 + max(bass, -0.2) * 0.32);

  float height = (direction.y + 1.0) * 0.5;
  float folds = fine * (0.03 + voice * 0.08);
  float waist = exp(-direction.y * direction.y / 0.3);
  float swallow = sin(direction.y * 9.0 + broad * 1.5 - uPhase.y * 5.0) * waist * voice * 0.09;
  float pulse = travellingRing(height, uKickAge, 2.4, 0.13) * uKickForce * 0.16;
  float slap = travellingRing(1.0 - height, uSnapAge, 3.2, 0.08) * uSnapForce * 0.09;
  float gestures = swallow + pulse + slap;

  // The spectrum only tints the skin: as relief, its sharp peaks drew thin streaks.
  lift = spectralLift(direction, swirl, fine, frequency);
  return lobes + folds + gestures;
}
