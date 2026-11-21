import { useCallback, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import type { AudioSourceKind } from '../../audio/AudioEngine'
import { useStudioStore } from '../../store/useStudioStore'
import { GlassPanel } from './GlassPanel'
import { TrackMenu } from './TrackMenu'

const SOURCES: readonly { kind: AudioSourceKind; label: string }[] = [
  { kind: 'synth', label: 'Synth' },
  { kind: 'microphone', label: 'Mic' },
  { kind: 'file', label: 'File' },
]

export function SourceControls() {
  const fileInput = useRef<HTMLInputElement>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const engaged = useStudioStore((state) => state.engaged)
  const source = useStudioStore((state) => state.source)
  const volume = useStudioStore((state) => state.volume)
  const { engage, selectSynth, selectMicrophone, loadFile, setVolume } = useStudioStore.getState()

  const choose = (kind: AudioSourceKind) => {
    setMenuOpen(kind === 'file' && !menuOpen)
    if (kind === 'file') return
    if (kind === 'microphone') void selectMicrophone()
    else if (engaged) selectSynth()
    else void engage()
  }

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void loadFile(file)
    event.target.value = ''
  }

  return (
    <div ref={anchor} className="pointer-events-auto relative">
      <GlassPanel className="flex h-9 items-center gap-1 rounded-full px-1.5">
        <div className="flex items-center" role="radiogroup" aria-label="Audio source">
          {SOURCES.map(({ kind, label }) => {
            const selected = engaged && source === kind
            const active = selected || (kind === 'file' && menuOpen)
            return (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-haspopup={kind === 'file' ? 'menu' : undefined}
                aria-expanded={kind === 'file' ? menuOpen : undefined}
                onClick={() => choose(kind)}
                className={`label-caps h-6 cursor-pointer rounded-full px-3 transition-colors duration-300 ${
                  active ? 'bg-white/12 text-white' : 'text-white/45 hover:text-white/85'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        <span className="mx-1 hidden h-3.5 w-px bg-white/12 sm:block" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          aria-label="Volume"
          className="optic-range mr-2 hidden w-16 sm:block"
          style={{ '--fill': `${volume * 100}%` } as CSSProperties}
        />
        <input ref={fileInput} type="file" accept="audio/*,.mp3,.wav,.ogg" onChange={onFile} className="hidden" />
      </GlassPanel>
      {menuOpen && <TrackMenu anchorRef={anchor} onBrowse={() => fileInput.current?.click()} onClose={closeMenu} />}
    </div>
  )
}
