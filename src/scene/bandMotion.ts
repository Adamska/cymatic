import { BAND_COUNT, type BandDynamics } from '../audio/BandDynamics'

interface Spring {
  value: number
  velocity: number
  stiffness: number
  damping: number
}

/** A musical event travelling over the skin: how long ago it started and how hard it hit. */
export interface SkinEvent {
  age: number
  force: number
}

const TAU = Math.PI * 2
const SUBSTEP = 1 / 120
/** Natural frequency and damping ratio of each band: heavy and slow below, light and quick above. */
const BAND_SPRINGS: readonly (readonly [number, number])[] = [
  [1.5, 0.42],
  [1.9, 0.48],
  [2.4, 0.52],
  [3.0, 0.55],
  [4.4, 0.58],
  [6.0, 0.6],
]
/** Share of the steady level that keeps the form shaped between peaks. */
const REST_SHARE: readonly number[] = [0.45, 0.45, 0.4, 0.42, 0.36, 0.3]
const ACCENT_SHARE: readonly number[] = [1, 0.9, 0.85, 0.9, 0.9, 1]
/** How fast the imprint of a peak fades, per second: the low end lingers longest. */
const HOLD_RELEASE: readonly number[] = [1.5, 1.2, 1.2, 1.5, 2.2, 3]
/** Velocity thrown into a spring by a sudden accent, so beats snap instead of fade in. */
const ACCENT_PUNCH: readonly number[] = [7, 6, 4, 4.5, 5.5, 6.5]
/** Momentum a peak leaves behind, which keeps the skin flowing while it coasts down. */
const MOMENTUM_GAIN: readonly number[] = [2.4, 2.2, 1.8, 2, 1.6, 1.4]
const MOMENTUM_DECAY = 0.6
const MOMENTUM_CAP = 2
const EVENT_RISE = 0.1
/** Squash and stretch: a loose spring, so a hit flattens the body and it bounces back tall. */
const SQUASH_SPRING: readonly [number, number] = [2.3, 0.26]
/** How strongly a sharp rise in each band flattens the body. */
const SQUASH_WEIGHT: readonly number[] = [1, 0.75, 0.35, 0.45, 0.9, 0.5]
const SQUASH_GAIN = 14
const SQUASH_FLOOR = 0.06
const SQUASH_LIMIT = 1.1
const EVENT_GAP = 0.16
const ACTIVITY_RISE = 5
const ACTIVITY_FALL = 0.8
const INTENSITY_RISE = 1.1
const INTENSITY_FALL = 0.55
/** Raw strength below which a passage counts as calm, and the span up to a full drop. */
const INTENSITY_FROM = 0.45
const INTENSITY_SPAN = 0.5

function createSpring([frequencyHz, dampingRatio]: readonly [number, number]): Spring {
  const omega = TAU * frequencyHz
  return { value: 0, velocity: 0, stiffness: omega * omega, damping: 2 * dampingRatio * omega }
}

function advance(spring: Spring, target: number, delta: number): void {
  for (let remaining = delta; remaining > 1e-6; remaining -= SUBSTEP) {
    const step = Math.min(remaining, SUBSTEP)
    spring.velocity += ((target - spring.value) * spring.stiffness - spring.velocity * spring.damping) * step
    spring.value += spring.velocity * step
  }
}

export function ease(current: number, target: number, riseRate: number, fallRate: number, delta: number): number {
  const rate = target > current ? riseRate : fallRate
  return current + (target - current) * (1 - Math.exp(-delta * rate))
}

const springs: Spring[] = BAND_SPRINGS.map(createSpring)
const squashSpring = createSpring(SQUASH_SPRING)
const held = new Float32Array(BAND_COUNT)
const lastAccents = new Float32Array(BAND_COUNT)
let generation = -1

/**
 * Three layers per band: the punch of a peak, its imprint fading over a second, and the
 * momentum it leaves in the flow of the skin. Intensity follows how loud and how busy the
 * music is, and dresses the background on the strongest passages.
 */
export const bandMotion = {
  values: new Float32Array(BAND_COUNT),
  momentum: new Float32Array(BAND_COUNT),
  activity: 0,
  intensity: 0,
  kickEvent: { age: 99, force: 0 } as SkinEvent,
  snapEvent: { age: 99, force: 0 } as SkinEvent,
  /** Positive while the body is flattened, negative while it rebounds tall. */
  squash: 0,
}

function trigger(event: SkinEvent, rise: number, accent: number): void {
  if (rise < EVENT_RISE || event.age < EVENT_GAP) return
  event.age = 0
  event.force = Math.min(1.2, 0.35 + accent)
}

/** Flattens the body for a short, sharp event: a beat, a snare, a click on the form. */
export function squashBody(force: number): void {
  squashSpring.velocity += force * SQUASH_GAIN
}

export function punchBands(force: number, shares: readonly number[]): void {
  springs.forEach((spring, band) => (spring.velocity += force * (shares[band] ?? 0)))
}

/** Advances every band; returns the sharpest rise of the low end this frame. */
export function stepBands(delta: number, dynamics: BandDynamics): number {
  const { levels, accents } = dynamics
  const { values, momentum, kickEvent, snapEvent } = bandMotion
  if (dynamics.generation !== generation) {
    generation = dynamics.generation
    momentum.fill(0)
    bandMotion.activity = 0
    bandMotion.intensity = 0
  }
  kickEvent.age += delta
  snapEvent.age += delta
  const decay = Math.exp(-delta * MOMENTUM_DECAY)
  let kick = 0
  let transient = 0
  let accentSum = 0

  for (let band = 0; band < BAND_COUNT; band++) {
    const level = levels[band] ?? 0
    const accent = accents[band] ?? 0
    const rise = Math.max(0, accent - (lastAccents[band] ?? 0))
    lastAccents[band] = accent
    accentSum += accent
    if (band < 2) kick = Math.max(kick, rise)
    if (band === 0) trigger(kickEvent, rise, accent)
    if (band === 4) trigger(snapEvent, rise, accent)
    transient = Math.max(transient, rise * (SQUASH_WEIGHT[band] ?? 0))

    const target = level * (REST_SHARE[band] ?? 0) + accent * (ACCENT_SHARE[band] ?? 0)
    held[band] = Math.max(target, (held[band] ?? 0) * Math.exp(-delta * (HOLD_RELEASE[band] ?? 1)))
    momentum[band] = Math.min(MOMENTUM_CAP, (momentum[band] ?? 0) * decay + accent * (MOMENTUM_GAIN[band] ?? 0) * delta)

    const spring = springs[band]
    if (!spring) continue
    spring.velocity += rise * (ACCENT_PUNCH[band] ?? 0)
    advance(spring, held[band] ?? 0, delta)
    values[band] = spring.value
  }

  // Strong passages carry a kick or a bass body and a lot happening on top of it.
  bandMotion.activity = ease(bandMotion.activity, Math.min(1, accentSum / 2.5), ACTIVITY_RISE, ACTIVITY_FALL, delta)
  const body = Math.max(levels[0] ?? 0, (levels[1] ?? 0) * 0.7)
  const raw = Math.min(1, Math.max(0, (body * 0.75 + bandMotion.activity * 0.55 - INTENSITY_FROM) / INTENSITY_SPAN))
  const goal = raw * raw * (3 - 2 * raw)
  bandMotion.intensity = ease(bandMotion.intensity, goal, INTENSITY_RISE, INTENSITY_FALL, delta)
  if (transient > SQUASH_FLOOR) squashBody(transient)
  advance(squashSpring, 0, delta)
  bandMotion.squash = Math.max(-SQUASH_LIMIT, Math.min(SQUASH_LIMIT, squashSpring.value))
  return kick
}
