import type { SceneDirective } from '../ai/directiveSchema'
import { DEFAULT_DIRECTIVE, PRESETS } from '../ai/presets'
import { audioEngine } from '../audio/AudioEngine'

const TICK_MS = 250
const FAST_SECONDS = 1.2
const SLOW_SECONDS = 10
const SECTION_JUMP = 0.16
const MIN_HOLD_SECONDS = 8
const MAX_HOLD_SECONDS = 28

/** How agitated a cue looks, from 0 for glacial to 1 for violent. */
function agitation({ optics }: SceneDirective): number {
  return (optics.flow / 2 + (optics.turbulence - 0.4) / 1.8 + optics.aberration + optics.bloom / 2.5) / 4
}

const RANKED = [...PRESETS].map((preset) => preset.directive).sort((a, b) => agitation(a) - agitation(b))

/** Picks a cue whose agitation matches the energy, avoiding the one on stage. */
export function cueForEnergy(energy: number, currentTitle: string): SceneDirective {
  const center = Math.round(Math.min(1, Math.max(0, energy * 1.25)) * (RANKED.length - 1))
  const nearby = RANKED.filter((_, index) => Math.abs(index - center) <= 1).filter((cue) => cue.title !== currentTitle)
  const pool = nearby.length > 0 ? nearby : RANKED.filter((cue) => cue.title !== currentTitle)
  return pool[Math.floor(Math.random() * pool.length)] ?? DEFAULT_DIRECTIVE
}

/**
 * Watches the energy of the music on a slow timer, outside the render loop, and changes
 * the cue when the song moves into a new section: a drop, a breakdown, or a long plateau.
 */
export function startAutoDirector(currentTitle: () => string, onCue: (directive: SceneDirective) => void): () => void {
  let fast = audioEngine.bands.rms
  let slow = fast
  let held = 0
  const step = TICK_MS / 1000

  const timer = window.setInterval(() => {
    const energy = audioEngine.bands.rms
    fast += (energy - fast) * (1 - Math.exp(-step / FAST_SECONDS))
    slow += (energy - slow) * (1 - Math.exp(-step / SLOW_SECONDS))
    held += step

    const newSection = Math.abs(fast - slow) > SECTION_JUMP && held > MIN_HOLD_SECONDS
    if (!newSection && held < MAX_HOLD_SECONDS) return
    onCue(cueForEnergy(fast, currentTitle()))
    held = 0
    slow = fast
  }, TICK_MS)

  return () => window.clearInterval(timer)
}
