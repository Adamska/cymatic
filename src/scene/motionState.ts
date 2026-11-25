import { Vector3 } from 'three'
import type { BandDynamics } from '../audio/BandDynamics'
import type { AudioBands } from '../audio/BandTracker'
import { bandMotion, ease, punchBands, squashBody, stepBands } from './bandMotion'

export type { SkinEvent } from './bandMotion'

const KNOCK_PUNCH: readonly number[] = [4.5, 4, 3.4, 3, 2.6, 2.2]
const PULSE_DECAY = 5
const CHARGE_RISE = 6
const CHARGE_FALL = 1.4
const DRIFT_RISE = 3
const DRIFT_FALL = 1.2
const KICK_IMPULSE = 0.14
const BASS_TORQUE = 0.1
const MOMENTUM_TORQUE = 0.09
const SPIN_FRICTION = 0.45
const UPRIGHT_PULL = 1.4

const drift = { low: 0.5, mid: 0.5, high: 0.8 }
const spin = { yaw: 0, pitch: 0 }
let lastImpact = 0

/** The last strike on the surface: where it landed in object space and how long ago. */
export const strikeState = { direction: new Vector3(0, 0, 1), age: 99, force: 0 }

export const motion = {
  /** One spring per band, from kick body to air; the sculpture reads these directly. */
  bands: bandMotion.values,
  low: 0,
  mid: 0,
  high: 0,
  pitch: 0.5,
  /** Momentum left by recent peaks in the low, middle and high registers. */
  surge: new Vector3(),
  /** Squash and stretch: positive flattens the body, negative stretches it tall. */
  squash: 0,
  /** How strong the passage is, 0 calm to 1 at the peak of a drop. Slow to fall. */
  intensity: 0,
  kickEvent: bandMotion.kickEvent,
  snapEvent: bandMotion.snapEvent,
  charge: 0,
  pulse: 0,
  phase: new Vector3(),
  yaw: 0,
  tilt: 0,
}

/** A physical knock on the form, from a click, a MIDI pad or a cue change. */
export function knock(force: number): void {
  punchBands(force, KNOCK_PUNCH)
  squashBody(force * 0.5)
  motion.pulse = Math.min(1.2, motion.pulse + force * 0.8)
}

export function strike(direction: Vector3, force: number): void {
  strikeState.direction.copy(direction).normalize()
  strikeState.age = 0
  strikeState.force = force
  knock(force * 0.6)
}

function pair(values: Float32Array, first: number): number {
  return ((values[first] ?? 0) + (values[first + 1] ?? 0)) * 0.5
}

export function stepMotion(delta: number, bands: AudioBands, dynamics: BandDynamics, flow: number): void {
  strikeState.age += delta
  const hit = Math.max(0, bands.impact - lastImpact)
  lastImpact = bands.impact
  if (hit > 0) {
    punchBands(hit * 0.5, KNOCK_PUNCH)
    squashBody(hit * 0.25)
  }
  motion.pulse = Math.min(1.2, motion.pulse * Math.exp(-delta * PULSE_DECAY) + hit)

  const kick = stepBands(delta, dynamics)
  const { momentum } = bandMotion
  motion.low = Math.max(motion.bands[0] ?? 0, motion.bands[1] ?? 0)
  motion.mid = pair(motion.bands, 2)
  motion.high = pair(motion.bands, 4)
  motion.surge.set(Math.max(momentum[0] ?? 0, momentum[1] ?? 0), pair(momentum, 2), pair(momentum, 4))
  motion.intensity = bandMotion.intensity
  motion.squash = bandMotion.squash
  motion.pitch = dynamics.pitch
  motion.charge = ease(motion.charge, bands.rms, CHARGE_RISE, CHARGE_FALL, delta)

  // The skin keeps flowing after a peak: momentum speeds up each register's drift and fades.
  const { levels } = dynamics
  const { surge } = motion
  drift.low = ease(drift.low, 0.45 + Math.max(levels[0] ?? 0, levels[1] ?? 0) * 0.5 + surge.x * 0.7, DRIFT_RISE, DRIFT_FALL, delta)
  drift.mid = ease(drift.mid, 0.45 + pair(levels, 2) * 0.9 + surge.y * 0.9, DRIFT_RISE, DRIFT_FALL, delta)
  drift.high = ease(drift.high, 0.7 + pair(levels, 4) * 1.6 + surge.z * 1.4, DRIFT_RISE, DRIFT_FALL, delta)
  motion.phase.x += drift.low * flow * delta
  motion.phase.y += drift.mid * flow * delta
  motion.phase.z += drift.high * flow * delta

  const heading = motion.phase.x * 1.7
  const torque = Math.max(0, motion.low) * BASS_TORQUE + (surge.x + surge.y * 0.5) * MOMENTUM_TORQUE
  spin.yaw += kick * KICK_IMPULSE * Math.cos(heading) + torque * delta
  spin.pitch += kick * KICK_IMPULSE * Math.sin(heading) - motion.tilt * UPRIGHT_PULL * delta
  const friction = Math.exp(-delta * SPIN_FRICTION)
  spin.yaw *= friction
  spin.pitch *= friction
  motion.yaw += spin.yaw * delta
  motion.tilt += spin.pitch * delta
}
