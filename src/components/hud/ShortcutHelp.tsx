import { SHORTCUTS } from '../../hooks/useShortcuts'
import { useUiStore } from '../../store/useUiStore'
import { GlassPanel } from './GlassPanel'

const TIPS: readonly string[] = [
  'Click the sculpture to strike it like a bell.',
  'Drop any audio file on the page, or import a Deezer playlist from the File menu.',
  'Turn a MIDI knob to map it to the next light rig dial. Keys strike the form.',
]

export function ShortcutHelp() {
  const open = useUiStore((state) => state.panel === 'help')
  const openPanel = useUiStore((state) => state.openPanel)
  if (!open) return null

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/30 p-5 backdrop-blur-[2px]" onClick={() => openPanel(null)}>
      <GlassPanel
        className="w-full max-w-md rounded-3xl px-6 py-5"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="label-caps text-white/85">Shortcuts</h2>
          <button type="button" onClick={() => openPanel(null)} className="label-caps cursor-pointer text-white/45 hover:text-white">
            Close
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2">
          {SHORTCUTS.map(({ keys, label }) => (
            <div key={keys} className="contents">
              <dt className="font-mono text-[0.7rem] text-white/85">{keys}</dt>
              <dd className="text-xs font-light text-white/55">{label}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-5 space-y-1.5 border-t border-white/10 pt-4 text-xs font-light text-white/45">
          {TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </GlassPanel>
    </div>
  )
}
