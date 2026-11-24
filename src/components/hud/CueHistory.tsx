import { useStudioStore } from '../../store/useStudioStore'

/** The last cues as colored dots: each recalls its cue in one click. */
export function CueHistory() {
  const history = useStudioStore((state) => state.history)
  const current = useStudioStore((state) => state.directive)
  const setDirective = useStudioStore((state) => state.setDirective)

  if (history.length < 2) return null

  return (
    <nav className="pointer-events-auto flex items-center gap-1.5" aria-label="Recent cues">
      <span className="label-caps mr-1 text-white/30">Recent</span>
      {history.map(({ id, directive }) => {
        const { key, rim } = directive.lights
        const active = directive === current
        return (
          <button
            key={id}
            type="button"
            title={directive.title}
            aria-label={`Recall ${directive.title}`}
            aria-current={active}
            onClick={() => setDirective(directive, 'history')}
            className={`size-3 cursor-pointer rounded-full transition-transform duration-300 hover:scale-125 ${
              active ? 'ring-1 ring-white/80 ring-offset-2 ring-offset-transparent' : ''
            }`}
            style={{ background: `linear-gradient(135deg, ${key}, ${rim})`, boxShadow: `0 0 10px ${key}66` }}
          />
        )
      })}
    </nav>
  )
}
