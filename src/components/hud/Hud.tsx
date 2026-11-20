import type { CSSProperties } from 'react'
import { useAudioDrop } from '../../hooks/useAudioDrop'
import { useStudioStore } from '../../store/useStudioStore'
import { CommandBar } from './CommandBar'
import { EngagePrompt } from './EngagePrompt'
import { LightControls } from './LightControls'
import { Notice } from './Notice'
import { SceneReadout } from './SceneReadout'
import { SourceControls } from './SourceControls'
import { SpectrumCanvas } from './SpectrumCanvas'

export function Hud() {
  const accent = useStudioStore((state) => state.directive.lights.key)
  const dragging = useAudioDrop()

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none" style={{ '--accent': accent } as CSSProperties}>
      <header className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-5">
        <SceneReadout />
        <SourceControls />
      </header>
      <LightControls />
      <EngagePrompt />
      <footer className="absolute inset-x-0 bottom-0 grid grid-cols-1 items-end gap-4 p-5 sm:grid-cols-[1fr_minmax(0,36rem)_1fr]">
        <div className="hidden justify-self-start sm:block">
          <SpectrumCanvas />
        </div>
        <div className="flex justify-center">
          <CommandBar />
        </div>
        <p className="label-caps hidden justify-self-end pb-1 text-right leading-relaxed text-white/30 lg:block">
          Drag to orbit
          <br />
          Drop audio to analyse
        </p>
      </footer>
      <Notice />
      <div
        className={`absolute inset-3 flex items-center justify-center rounded-[2rem] border border-dashed border-white/35 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          dragging ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden={!dragging}
      >
        <span className="label-caps text-sm text-white/85">Release to analyse</span>
      </div>
    </div>
  )
}
