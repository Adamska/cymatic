import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { audioEngine } from '../../audio/AudioEngine'
import { togglePlayback } from '../../features/studioActions'
import { usePlaylistStore } from '../../store/usePlaylistStore'
import { useStudioStore } from '../../store/useStudioStore'
import { GlassPanel } from './GlassPanel'

const BARS = 72

const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

function seekFrom(event: PointerEvent<HTMLDivElement>): void {
  const player = audioEngine.player
  if (!player) return
  const bounds = event.currentTarget.getBoundingClientRect()
  player.seek(((event.clientX - bounds.left) / bounds.width) * player.duration)
}

/**
 * File transport: play and pause, a scrubbable waveform and the time. The playhead and clock
 * are written straight to the DOM every frame; React state only follows a slow poll.
 */
export function Transport() {
  const source = useStudioStore((state) => state.source)
  const trackName = useStudioStore((state) => state.trackName)
  const queued = usePlaylistStore((state) => state.tracks.length > 0)
  const { step } = usePlaylistStore.getState()
  const [playing, setPlaying] = useState(true)
  const [peaks, setPeaks] = useState<Float32Array | null>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (source !== 'file') return
    let frame = 0
    const draw = () => {
      const player = audioEngine.player
      if (player) {
        const progress = player.duration > 0 ? player.position / player.duration : 0
        if (headRef.current) headRef.current.style.width = `${progress * 100}%`
        if (timeRef.current) timeRef.current.textContent = `${clock(player.position)} / ${clock(player.duration)}`
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    const sync = window.setInterval(() => {
      const player = audioEngine.player
      if (!player) return
      setPlaying(player.playing)
      setPeaks((current) => current ?? player.peaks(BARS))
    }, 200)
    return () => {
      cancelAnimationFrame(frame)
      window.clearInterval(sync)
    }
  }, [source, trackName])

  useEffect(() => setPeaks(null), [trackName])

  if (source !== 'file') return null

  const button = 'label-caps h-6 cursor-pointer rounded-full px-1.5 text-white/60 transition-colors hover:text-white'
  return (
    <GlassPanel className="w-60 rounded-2xl px-3.5 pt-2.5 pb-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          {queued && (
            <button type="button" className={button} onClick={() => step(-1)} aria-label="Previous track">
              Prev
            </button>
          )}
          <button type="button" className={`${button} text-white/90`} onClick={togglePlayback}>
            {playing ? 'Pause' : 'Play'}
          </button>
          {queued && (
            <button type="button" className={button} onClick={() => step(1)} aria-label="Next track">
              Next
            </button>
          )}
        </div>
        <span ref={timeRef} className="font-mono text-[0.625rem] whitespace-nowrap text-white/45 tabular-nums" />
      </div>
      <div
        className="relative mt-2 flex h-7 cursor-pointer items-center gap-px"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          seekFrom(event)
        }}
        onPointerMove={(event) => {
          if (event.buttons === 1) seekFrom(event)
        }}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={-1}
      >
        {Array.from({ length: BARS }, (_, index) => (
          <span key={index} className="flex-1 rounded-full bg-white/20" style={{ height: `${Math.max(8, (peaks?.[index] ?? 0) * 100)}%` }} />
        ))}
        <div ref={headRef} className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden">
          <div className="h-full border-r border-white/80 bg-[var(--color-accent)]/25 mix-blend-screen" />
        </div>
      </div>
    </GlassPanel>
  )
}
