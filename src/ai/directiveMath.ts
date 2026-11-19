import { LIGHT_INTENSITY_RANGE, OPTIC_RANGES, SYNTH_RANGES, type SceneDirective } from './directiveSchema'

type Range = readonly [number, number]
type PaletteKey = keyof SceneDirective['palette']
type LightColorKey = 'key' | 'fill' | 'rim'
type SynthScalarKey = keyof typeof SYNTH_RANGES

const PALETTE_KEYS: readonly PaletteKey[] = ['offset', 'amplitude', 'frequency', 'phase']
const LIGHT_COLOR_KEYS: readonly LightColorKey[] = ['key', 'fill', 'rim']
const OPTIC_KEYS = Object.keys(OPTIC_RANGES) as (keyof typeof OPTIC_RANGES)[]
const SYNTH_KEYS = Object.keys(SYNTH_RANGES) as SynthScalarKey[]

const lerp = (from: number, to: number, weight: number): number => from + (to - from) * weight
const clamp = (value: number, [min, max]: Range): number => Math.min(max, Math.max(min, value))

function mixHex(from: string, to: string, weight: number): string {
  const a = Number.parseInt(from.slice(1), 16)
  const b = Number.parseInt(to.slice(1), 16)
  const channel = (shift: number) => Math.round(lerp((a >> shift) & 0xff, (b >> shift) & 0xff, weight))
  const mixed = (channel(16) << 16) | (channel(8) << 8) | channel(0)
  return `#${mixed.toString(16).padStart(6, '0')}`
}

export function cloneDirective(directive: SceneDirective): SceneDirective {
  return structuredClone(directive)
}

export function blendDirectives(primary: SceneDirective, secondary: SceneDirective, weight: number): SceneDirective {
  const blended = cloneDirective(primary)

  for (const key of PALETTE_KEYS) {
    blended.palette[key] = primary.palette[key].map((value, index) => lerp(value, secondary.palette[key][index] ?? value, weight))
  }
  for (const key of LIGHT_COLOR_KEYS) {
    blended.lights[key] = mixHex(primary.lights[key], secondary.lights[key], weight)
  }
  blended.lights.intensity = lerp(primary.lights.intensity, secondary.lights.intensity, weight)
  for (const key of OPTIC_KEYS) blended.optics[key] = lerp(primary.optics[key], secondary.optics[key], weight)
  for (const key of SYNTH_KEYS) blended.synth[key] = lerp(primary.synth[key], secondary.synth[key], weight)

  return blended
}

export function clampDirective(directive: SceneDirective): SceneDirective {
  const clamped = cloneDirective(directive)
  clamped.lights.intensity = clamp(clamped.lights.intensity, LIGHT_INTENSITY_RANGE)
  for (const key of OPTIC_KEYS) clamped.optics[key] = clamp(clamped.optics[key], OPTIC_RANGES[key])
  for (const key of SYNTH_KEYS) clamped.synth[key] = clamp(clamped.synth[key], SYNTH_RANGES[key])
  return clamped
}
