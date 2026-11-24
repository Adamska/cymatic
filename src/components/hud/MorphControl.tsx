import { useState, type CSSProperties } from 'react'
import { blendDirectives } from '../../ai/directiveMath'
import { useStudioStore } from '../../store/useStudioStore'

/**
 * Crossfades between the two latest cues. Every parameter is blended, palette, rig,
 * optics and synth, so the slider plays like a DJ crossfader for light and sound.
 */
export function MorphControl() {
  const history = useStudioStore((state) => state.history)
  const origin = useStudioStore((state) => state.origin)
  const setDirective = useStudioStore((state) => state.setDirective)
  const [weight, setWeight] = useState(1)
  const [latest, previous] = history

  if (!latest || !previous) return null
  const value = origin === 'morph' ? weight : 1

  const morph = (next: number) => {
    setWeight(next)
    setDirective({ ...blendDirectives(previous.directive, latest.directive, next), title: next > 0.5 ? latest.directive.title : previous.directive.title }, 'morph')
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-3.5">
      <div className="flex items-baseline justify-between">
        <span className="label-caps text-white/50">Morph</span>
        <span className="font-mono text-[0.625rem] text-white/75 tabular-nums">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => morph(Number(event.target.value))}
        aria-label={`Morph from ${previous.directive.title} to ${latest.directive.title}`}
        className="optic-range mt-1 w-full"
        style={{ '--fill': `${value * 100}%` } as CSSProperties}
      />
      <div className="mt-0.5 flex justify-between gap-2 text-[0.625rem] font-light text-white/40">
        <span className="truncate">{previous.directive.title}</span>
        <span className="truncate text-right">{latest.directive.title}</span>
      </div>
    </div>
  )
}
