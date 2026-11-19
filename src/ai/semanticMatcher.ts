import { blendDirectives, clampDirective, cloneDirective } from './directiveMath'
import type { SceneDirective } from './directiveSchema'
import { PRESETS, type DirectivePreset } from './presets'

interface Modifier {
  keywords: readonly string[]
  apply: (directive: SceneDirective) => void
}

interface Ranked {
  preset: DirectivePreset
  score: number
}

const BLEND_THRESHOLD = 0.5
const MAX_TITLE_LENGTH = 40

const MODIFIERS: readonly Modifier[] = [
  {
    keywords: ['heavy', 'bass', 'sub', 'rumble', 'thunder', 'massive', 'seismic'],
    apply: ({ synth, optics }) => {
      synth.subLevel = 1
      synth.rootHz *= 0.82
      optics.displacement += 0.06
    },
  },
  {
    keywords: ['calm', 'slow', 'still', 'gentle', 'soft', 'quiet', 'drift', 'sleep', 'serene', 'glacial'],
    apply: ({ synth, optics }) => {
      optics.flow *= 0.55
      optics.turbulence *= 0.8
      optics.aberration *= 0.5
      synth.lfoRate *= 0.5
    },
  },
  {
    keywords: ['violent', 'storm', 'chaos', 'fast', 'intense', 'wild', 'fury', 'turbulent', 'frantic', 'electric'],
    apply: ({ synth, optics }) => {
      optics.flow *= 1.6
      optics.turbulence *= 1.3
      optics.aberration += 0.3
      synth.lfoRate *= 2.2
      synth.resonance += 3
    },
  },
  {
    keywords: ['bright', 'blinding', 'radiant', 'dazzling', 'luminous', 'glowing', 'incandescent'],
    apply: ({ synth, optics, lights }) => {
      optics.bloom *= 1.4
      lights.intensity *= 1.25
      synth.filterCutoff *= 1.5
    },
  },
  {
    keywords: ['dark', 'dim', 'shadow', 'midnight', 'moody', 'muted', 'smoky'],
    apply: ({ synth, optics, lights }) => {
      optics.bloom *= 0.65
      lights.intensity *= 0.72
      synth.filterCutoff *= 0.6
    },
  },
  {
    keywords: ['glass', 'liquid', 'crystal', 'prism', 'mirror', 'oil', 'iridescent', 'holographic', 'chrome'],
    apply: ({ optics }) => {
      optics.iridescence = Math.max(optics.iridescence, 0.9)
    },
  },
]

function tokenize(prompt: string): string[] {
  return prompt.toLowerCase().match(/[a-z]+/g) ?? []
}

function hits(tokens: readonly string[], keyword: string): number {
  if (tokens.includes(keyword)) return 2
  const partial = tokens.some((token) => token.length >= 4 && (token.startsWith(keyword) || keyword.startsWith(token)))
  return partial ? 1 : 0
}

function scoreKeywords(tokens: readonly string[], keywords: readonly string[]): number {
  return keywords.reduce((total, keyword) => total + hits(tokens, keyword), 0)
}

function hashPrompt(prompt: string): number {
  let hash = 2166136261
  for (let index = 0; index < prompt.length; index++) {
    hash = Math.imul(hash ^ prompt.charCodeAt(index), 16777619)
  }
  return hash >>> 0
}

function titleFromPrompt(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 4)
  const title = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
  return title.slice(0, MAX_TITLE_LENGTH) || 'Untitled Study'
}

function improvise(prompt: string): SceneDirective {
  const hash = hashPrompt(prompt.trim().toLowerCase())
  const primary = PRESETS[hash % PRESETS.length]
  const secondary = PRESETS[(hash >>> 8) % PRESETS.length]
  if (!primary || !secondary) throw new Error('Preset library is empty')

  const weight = 0.25 + ((hash >>> 16) % 100) / 200
  const directive = blendDirectives(primary.directive, secondary.directive, weight)
  directive.title = titleFromPrompt(prompt)
  directive.note = `An offline study between ${primary.directive.title} and ${secondary.directive.title}.`
  return directive
}

export function matchDirective(prompt: string): SceneDirective {
  const tokens = tokenize(prompt)
  const ranked: Ranked[] = PRESETS.map((preset) => ({ preset, score: scoreKeywords(tokens, preset.keywords) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)

  const [best, runnerUp] = ranked
  let directive: SceneDirective
  if (!best) {
    directive = improvise(prompt)
  } else if (runnerUp && runnerUp.score >= best.score * BLEND_THRESHOLD) {
    const weight = runnerUp.score / (best.score + runnerUp.score)
    directive = blendDirectives(best.preset.directive, runnerUp.preset.directive, weight)
    directive.title = titleFromPrompt(prompt)
    directive.note = `${best.preset.directive.title} folded into ${runnerUp.preset.directive.title}.`
  } else {
    directive = cloneDirective(best.preset.directive)
  }

  for (const modifier of MODIFIERS) {
    if (scoreKeywords(tokens, modifier.keywords) > 0) modifier.apply(directive)
  }
  return clampDirective(directive)
}
