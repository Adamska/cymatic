import { z } from 'zod'

type Range = readonly [min: number, max: number]

export const LIGHT_INTENSITY_RANGE: Range = [0.4, 1.8]

export const OPTIC_RANGES = {
  bloom: [0.2, 2.5],
  turbulence: [0.4, 2.2],
  displacement: [0.1, 0.7],
  flow: [0.15, 2],
  iridescence: [0, 1],
  aberration: [0, 1],
} as const satisfies Record<string, Range>

export const SYNTH_RANGES = {
  rootHz: [30, 110],
  filterCutoff: [200, 6000],
  resonance: [0.5, 12],
  lfoRate: [0.03, 1.5],
  subLevel: [0, 1],
} as const satisfies Record<string, Range>

const ranged = ([min, max]: Range) => z.number().min(min).max(max)
const vector = (max: number) => z.array(z.number().min(0).max(max)).length(3)
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const SceneDirectiveSchema = z.object({
  title: z.string().describe('Evocative two to four word name for the look, at most 40 characters'),
  note: z.string().describe('One sentence, at most 140 characters, describing the light and sound like a lighting cue'),
  palette: z
    .object({
      offset: vector(1).describe('Vector a: base brightness per RGB channel'),
      amplitude: vector(1).describe('Vector b: contrast per RGB channel'),
      frequency: vector(2).describe('Vector c: oscillation count per RGB channel, 1 is one full cycle'),
      phase: vector(1).describe('Vector d: phase shift per RGB channel, the main driver of hue'),
    })
    .describe('Cosine gradient palette, color(t) = a + b * cos(2 * PI * (c * t + d))'),
  lights: z.object({
    key: hexColor.describe('Key spotlight color as #RRGGBB'),
    fill: hexColor.describe('Fill light color as #RRGGBB, usually a contrasting hue'),
    rim: hexColor.describe('Rim light color as #RRGGBB, used for edge highlights'),
    intensity: ranged(LIGHT_INTENSITY_RANGE).describe('Overall rig intensity, 1 is neutral'),
  }),
  optics: z.object({
    bloom: ranged(OPTIC_RANGES.bloom).describe('HDR bloom intensity'),
    turbulence: ranged(OPTIC_RANGES.turbulence).describe('Noise frequency of the surface, higher is more intricate'),
    displacement: ranged(OPTIC_RANGES.displacement).describe('Depth of the surface deformation'),
    flow: ranged(OPTIC_RANGES.flow).describe('Speed of motion, below 0.4 is glacial and above 1.2 is restless'),
    iridescence: ranged(OPTIC_RANGES.iridescence).describe('Strength of thin-film interference colors'),
    aberration: ranged(OPTIC_RANGES.aberration).describe('Chromatic aberration on bass transients'),
  }),
  synth: z.object({
    rootHz: ranged(SYNTH_RANGES.rootHz).describe('Sub-bass drone frequency in hertz'),
    intervals: z
      .array(z.number().int().min(0).max(24))
      .min(2)
      .max(4)
      .describe('Pad chord as semitone offsets above the root, starting with 0'),
    filterCutoff: ranged(SYNTH_RANGES.filterCutoff).describe('Low-pass cutoff in hertz, low is dark and high is airy'),
    resonance: ranged(SYNTH_RANGES.resonance).describe('Filter resonance Q'),
    lfoRate: ranged(SYNTH_RANGES.lfoRate).describe('Filter sweep rate in hertz'),
    subLevel: ranged(SYNTH_RANGES.subLevel).describe('Sub-bass level'),
  }),
})

export const DirectorRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(240),
})

export const DirectorResponseSchema = z.object({
  directive: SceneDirectiveSchema,
  source: z.enum(['model', 'preset']),
})

export type SceneDirective = z.infer<typeof SceneDirectiveSchema>
export type DirectorResponse = z.infer<typeof DirectorResponseSchema>
export type OpticKey = keyof typeof OPTIC_RANGES
