import { Color, Vector3 } from 'three'

export interface SceneLook {
  palette: {
    offset: readonly number[]
    amplitude: readonly number[]
    frequency: readonly number[]
    phase: readonly number[]
  }
  lights: { key: string; fill: string; rim: string; intensity: number }
  optics: {
    bloom: number
    turbulence: number
    displacement: number
    flow: number
    iridescence: number
    aberration: number
  }
}

type PaletteKey = keyof SceneLook['palette']
type LightKey = 'key' | 'fill' | 'rim'
type ScalarKey = keyof SceneLook['optics'] | 'intensity'

interface SceneFrame {
  palette: Record<PaletteKey, Vector3>
  lights: Record<LightKey, Color>
  scalars: Record<ScalarKey, number>
}

const PALETTE_KEYS: readonly PaletteKey[] = ['offset', 'amplitude', 'frequency', 'phase']
const LIGHT_KEYS: readonly LightKey[] = ['key', 'fill', 'rim']
const TRANSITION_RATE = 1.6
const WAVE_SECONDS = 2.2
const TAU = Math.PI * 2

function createFrame(): SceneFrame {
  return {
    palette: {
      offset: new Vector3(0.5, 0.5, 0.5),
      amplitude: new Vector3(0.5, 0.5, 0.5),
      frequency: new Vector3(1, 1, 1),
      phase: new Vector3(0, 0.33, 0.67),
    },
    lights: { key: new Color('#ffffff'), fill: new Color('#ffffff'), rim: new Color('#ffffff') },
    scalars: {
      intensity: 1,
      bloom: 1,
      turbulence: 1,
      displacement: 0.4,
      flow: 0.6,
      iridescence: 0.6,
      aberration: 0.4,
    },
  }
}

const target = createFrame()
let primed = false

export const sceneLive = { ...createFrame(), time: 0 }

/** Target palette, shown by the sculpture behind the transition wave front. */
export const targetPalette = target.palette

/**
 * A cue change sweeps across the sculpture as a wave: the old palette stays ahead of the
 * front, the new one fills in behind it. `fresh` is cleared by whoever aims the wave.
 */
export const cueWave = {
  progress: 1,
  fresh: false,
  from: createFrame().palette,
}

function paletteChanged(look: SceneLook): boolean {
  return PALETTE_KEYS.some((key) => look.palette[key].some((value, index) => Math.abs(value - target.palette[key].getComponent(index)) > 1e-4))
}

export function setSceneTarget(look: SceneLook, sweep = true): void {
  if (primed && sweep && paletteChanged(look)) {
    for (const key of PALETTE_KEYS) cueWave.from[key].copy(sceneLive.palette[key])
    cueWave.progress = 0
    cueWave.fresh = true
  }
  for (const key of PALETTE_KEYS) target.palette[key].fromArray(look.palette[key])
  for (const key of LIGHT_KEYS) target.lights[key].set(look.lights[key])
  Object.assign(target.scalars, look.optics, { intensity: look.lights.intensity })

  if (!primed) {
    primed = true
    stepScene(Number.POSITIVE_INFINITY, 0)
    sceneLive.time = 0
  }
}

export function stepScene(delta: number, energy: number): void {
  const blend = 1 - Math.exp(-delta * TRANSITION_RATE)
  for (const key of PALETTE_KEYS) sceneLive.palette[key].lerp(target.palette[key], blend)
  for (const key of LIGHT_KEYS) sceneLive.lights[key].lerp(target.lights[key], blend)

  const { scalars } = sceneLive
  for (const key of Object.keys(scalars) as ScalarKey[]) {
    scalars[key] += (target.scalars[key] - scalars[key]) * blend
  }
  if (!Number.isFinite(delta)) return
  sceneLive.time += delta * scalars.flow * (1 + energy * 0.7)
  cueWave.progress = Math.min(1, cueWave.progress + delta / WAVE_SECONDS)
}

export function samplePalette(t: number, out: Color): Color {
  const { offset, amplitude, frequency, phase } = sceneLive.palette
  return out.setRGB(
    Math.max(0, offset.x + amplitude.x * Math.cos(TAU * (frequency.x * t + phase.x))),
    Math.max(0, offset.y + amplitude.y * Math.cos(TAU * (frequency.y * t + phase.y))),
    Math.max(0, offset.z + amplitude.z * Math.cos(TAU * (frequency.z * t + phase.z))),
  )
}
