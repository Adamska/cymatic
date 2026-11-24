import { useStudioStore, type DirectiveOrigin } from '../../store/useStudioStore'
import { CueHistory } from './CueHistory'

const ORIGIN_LABELS: Record<DirectiveOrigin, string> = {
  default: 'Opening cue',
  model: 'AI director',
  preset: 'Preset library',
  shared: 'Shared cue',
  auto: 'Auto director',
  history: 'Cue history',
  morph: 'Morph',
}

export function SceneReadout() {
  const title = useStudioStore((state) => state.directive.title)
  const note = useStudioStore((state) => state.directive.note)
  const origin = useStudioStore((state) => state.origin)

  return (
    <section className="flex max-w-[19rem] flex-col items-start gap-3 pl-1 [text-shadow:0_1px_18px_rgb(0_0_0/0.65)]">
      <h1 className="flex h-9 items-center text-[1.05rem] font-medium tracking-tight text-white/95">Cymatic</h1>
      <div aria-live="polite">
        <p className="label-caps text-white/40">{ORIGIN_LABELS[origin]}</p>
        <h2 className="mt-1.5 truncate text-xl font-light tracking-tight text-white/95">{title}</h2>
        <p className="mt-1.5 line-clamp-3 hidden text-[0.8rem] leading-relaxed font-light text-white/50 sm:block">{note}</p>
      </div>
      <CueHistory />
    </section>
  )
}
