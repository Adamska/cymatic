import { Vector3 } from 'three'
import type { AudioBands } from '../audio/BandTracker'

interface Spring {
  value: number
  velocity: number
  stiffness: number
  damping: number
}

type Register = 'low' | 'mid' | 'high'

const TAU = Math.PI * 2
const SUBSTEP = 1 / 120
const SUSTAIN_RISE: Record<Register, number> = { low: 14, mid: 16, high: 24 }
const SUSTAIN_FALL: Record<Register, number> = { low: 3.5, mid: 4.5, high: 8 }
const IMPACT_PUNCH: Record<Register, number> = { low: 4.5, mid: 3.2, high: 2.4 }
const KICK_PUNCH = 4
const SPARKLE_PUNCH = 6
const PULSE_DECAY = 5
const CHARGE_RISE = 6
const CHARGE_FALL = 1.4
const DRIFT_RISE = 5
const DRIFT_FALL = 1.6
const KICK_IMPULSE = 0.16
const BASS_TORQUE = 0.14
const SPIN_FRICTION = 0.4

function createSpring(frequencyHz: number, dampingRatio: number): Spring {
  const omega = TAU * frequencyHz
  return { value: 0, velocity: 0, stiffness: omega * omega, damping: 2 * dampingRatio * omega }
}

function advance(spring: Spring, target: number, delta: number): number {
  spring.velocity += ((target - spring.value) * spring.stiffness - spring.velocity * spring.damping) * delta
  spring.value += spring.velocity * delta
  return spring.value
}

function ease(current: number, target: number, riseRate: number, fallRate: number, delta: number): number {
  const rate = target > current ? riseRate : fallRate
  return current + (target - current) * (1 - Math.exp(-delta * rate))
}

const springs: Record<Register, Spring> = {
  low: createSpring(1.5, 0.55),
  mid: createSpring(2.1, 0.6),
  high: createSpring(4.2, 0.65),
}
const sustain: Record<Register, number> = { low: 0, mid: 0, high: 0 }
const drift: Record<Register, number> = { low: 0.75, mid: 0.75, high: 1 }
const spin = { yaw: 0, pitch: 0 }
const previous = { transient: 0, sparkle: 0, impact: 0 }

export const motion = {
  low: 0,
  mid: 0,
  high: 0,
  charge: 0,
  pulse: 0,
  phase: new Vector3(),
  yaw: 0,
  pitch: 0,
}

export function stepMotion(delta: number, bands: AudioBands, flow: number): void {
  const kick = Math.max(0, bands.transient - previous.transient)
  const sparkle = Math.max(0, bands.sparkle - previous.sparkle)
  previous.transient = bands.transient
  const hit = Math.max(0, bands.impact - previous.impact)
  previous.sparkle = bands.sparkle
  previous.impact = bands.impact

  const targets: Record<Register, number> = {
    low: Math.min(1.2, bands.sub * 0.55 + bands.bass * 0.6),
    mid: bands.mid * 1.1,
    high: bands.high * 1.15,
  }
  for (const register of Object.keys(targets) as Register[]) {
    sustain[register] = ease(sustain[register], targets[register], SUSTAIN_RISE[register], SUSTAIN_FALL[register], delta)
  }
  springs.low.velocity += kick * KICK_PUNCH
  springs.high.velocity += sparkle * SPARKLE_PUNCH
  for (const register of Object.keys(springs) as Register[]) springs[register].velocity += hit * IMPACT_PUNCH[register]
  motion.pulse = Math.min(1.2, motion.pulse * Math.exp(-delta * PULSE_DECAY) + hit)

  for (let remaining = delta; remaining > 1e-6; remaining -= SUBSTEP) {
    const step = Math.min(remaining, SUBSTEP)
    motion.low = advance(springs.low, sustain.low, step)
    motion.mid = advance(springs.mid, sustain.mid, step)
    motion.high = advance(springs.high, sustain.high, step)
  }
  motion.charge = ease(motion.charge, bands.rms, CHARGE_RISE, CHARGE_FALL, delta)

  const swell = Math.max(0, motion.low)
  drift.low = ease(drift.low, 0.75 + motion.charge * 0.8 + swell * 0.6, DRIFT_RISE, DRIFT_FALL, delta)
  drift.mid = ease(drift.mid, 0.75 + sustain.mid * 2.2, DRIFT_RISE, DRIFT_FALL, delta)
  drift.high = ease(drift.high, 1 + sustain.high * 5, DRIFT_RISE * 1.6, DRIFT_FALL * 2, delta)
  motion.phase.x += drift.low * flow * delta
  motion.phase.y += drift.mid * flow * delta
  motion.phase.z += drift.high * flow * delta

  const heading = motion.phase.x * 1.7
  spin.yaw += kick * KICK_IMPULSE * Math.cos(heading) + swell * BASS_TORQUE * delta
  spin.pitch += kick * KICK_IMPULSE * Math.sin(heading)

  const friction = Math.exp(-delta * SPIN_FRICTION)
  spin.yaw *= friction
  spin.pitch *= friction
  motion.yaw += spin.yaw * delta
  motion.pitch += spin.pitch * delta
}
