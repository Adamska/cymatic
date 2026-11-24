import { useEffect, type CSSProperties } from 'react'
import { useAudioDrop } from '../../hooks/useAudioDrop'
import { useShortcuts } from '../../hooks/useShortcuts'
import { useStudioSystems } from '../../hooks/useStudioSystems'
import { useStudioStore } from '../../store/useStudioStore'
import { useUiStore } from '../../store/useUiStore'
import { ActionBar } from './ActionBar'
import { CommandBar } from './CommandBar'
import { EngagePrompt } from './EngagePrompt'
import { LightControls } from './LightControls'
import { Notice } from './Notice'
import { PlaylistPanel } from './PlaylistPanel'
import { SceneReadout } from './SceneReadout'
import { ShortcutHelp } from './ShortcutHelp'
import { SourceControls } from './SourceControls'
import { SpectrumCanvas } from './SpectrumCanvas'
import { Transport } from './Transport'

export function Hud() {
  const accent = useStudioStore((state) => state.directive.lights.key)
  const hudHidden = useUiStore((state) => state.hudHidden)
  const idle = useUiStore((state) => state.idle)
  const panel = useUiStore((state) => state.panel)
  const dragging = useAudioDrop()
  const faded = hudHidden || (idle && panel === null)

  useShortcuts()
  useStudioSystems()
  useEffect(() => {
    document.body.classList.toggle('cursor-none', faded)
  }, [faded])

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none" style={{ '--accent': accent } as CSSProperties}>
      <div
        className={`absolute inset-0 transition-opacity duration-700 ease-optic ${faded ? 'opacity-0 [&_*]:pointer-events-none!' : 'opacity-100'}`}
        aria-hidden={faded}
      >
        <header className="absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-4 p-5">
          <SceneReadout />
          <SourceControls />
        </header>
        <LightControls />
        <PlaylistPanel />
        <EngagePrompt />
        <footer className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 p-5 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,36rem)_minmax(0,1fr)] xl:items-end xl:gap-4">
          <div className="hidden flex-col items-start gap-2 sm:flex xl:justify-self-start">
            <Transport />
            <SpectrumCanvas />
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end sm:gap-4 xl:contents">
            <div className="flex w-full min-w-0 justify-center sm:flex-1 sm:justify-start xl:justify-center">
              <CommandBar />
            </div>
            <div className="flex max-w-full min-w-0 justify-center sm:shrink-0 xl:justify-self-end">
              <ActionBar />
            </div>
          </div>
        </footer>
        <ShortcutHelp />
      </div>
      <Notice />
      <div
        className={`absolute inset-3 flex items-center justify-center rounded-4xl border border-dashed border-white/35 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          dragging ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden={!dragging}
      >
        <span className="label-caps text-sm text-white/85">Release to analyse</span>
      </div>
    </div>
  )
}
