import { useEffect, useState } from 'react'
import {
  connectMidiDevice,
  recordVideo,
  shareCue,
  takeStill,
  toggleFullscreen,
} from '../../features/studioActions'
import { useUiStore } from '../../store/useUiStore'
import { GlassPanel } from './GlassPanel'

interface ActionProps {
  label: string
  title: string
  active?: boolean
  className?: string
  onClick: () => void
}

function Action({ label, title, active = false, className = '', onClick }: ActionProps) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`label-caps h-6 shrink-0 cursor-pointer rounded-full px-2.5 transition-colors duration-300 ${
        active ? 'bg-white/12 text-white' : 'text-white/45 hover:text-white/85'
      } ${className}`}
    >
      {label}
    </button>
  )
}

function useRecordingCountdown(recording: boolean): number {
  const [left, setLeft] = useState(10)
  useEffect(() => {
    if (!recording) return
    setLeft(10)
    const timer = window.setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [recording])
  return left
}

/** Studio tools: auto director, sharing, capture, MIDI and display modes. */
export function ActionBar() {
  const autoDirector = useUiStore((state) => state.autoDirector)
  const recording = useUiStore((state) => state.recording)
  const midiDevice = useUiStore((state) => state.midiDevice)
  const panel = useUiStore((state) => state.panel)
  const { setAutoDirector, togglePanel } = useUiStore.getState()
  const left = useRecordingCountdown(recording)

  return (
    <GlassPanel className="flex h-9 max-w-full items-center gap-0.5 overflow-x-auto rounded-full px-1.5 [scrollbar-width:none]">
      <Action label="Auto" title="Auto director: changes the cue with the music (A)" active={autoDirector} onClick={() => setAutoDirector(!autoDirector)} />
      <Action label="Rig" title="Light rig" active={panel === 'rig'} onClick={() => togglePanel('rig')} className="md:hidden" />
      <Action label="Link" title="Copy a link to this cue (L)" onClick={() => void shareCue()} />
      <Action label="Still" title="Save a high resolution still (S)" onClick={() => void takeStill()} />
      <Action
        label={recording ? `Rec ${left}` : 'Rec'}
        title="Record ten seconds of video with sound (R)"
        active={recording}
        onClick={() => void recordVideo()}
        className={`hidden sm:block ${recording ? 'text-[#ff6b6b]!' : ''}`}
      />
      <Action
        label={midiDevice ? 'MIDI on' : 'MIDI'}
        title={midiDevice ?? 'Connect a MIDI controller'}
        active={midiDevice !== null}
        onClick={() => void connectMidiDevice()}
        className="hidden min-[1400px]:block"
      />
      <Action label="Full" title="Fullscreen (F)" onClick={toggleFullscreen} className="hidden min-[1400px]:block" />
      <Action label="?" title="Keyboard shortcuts (?)" active={panel === 'help'} onClick={() => togglePanel('help')} />
    </GlassPanel>
  )
}
