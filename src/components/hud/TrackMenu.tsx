import { useEffect, useState, type RefObject } from 'react'
import { SAMPLE_TRACKS, type SampleTrack } from '../../audio/sampleTracks'
import { useStudioStore } from '../../store/useStudioStore'
import { GlassPanel } from './GlassPanel'

interface TrackMenuProps {
  anchorRef: RefObject<HTMLElement | null>
  onBrowse: () => void
  onClose: () => void
}

const ITEM_CLASS =
  'flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-200 hover:bg-white/8 disabled:cursor-wait'

export function TrackMenu({ anchorRef, onBrowse, onClose }: TrackMenuProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const source = useStudioStore((state) => state.source)
  const trackName = useStudioStore((state) => state.trackName)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !anchorRef.current?.contains(event.target)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [anchorRef, onClose])

  const play = async (track: SampleTrack) => {
    setLoadingId(track.id)
    await useStudioStore.getState().loadTrack(track)
    setLoadingId(null)
    onClose()
  }

  return (
    <GlassPanel className="absolute top-full right-0 mt-2 w-56 rounded-2xl p-1.5" role="menu" aria-label="Audio file">
      <p className="label-caps px-2.5 pt-1.5 pb-2 text-white/40">Sample tracks</p>
      {SAMPLE_TRACKS.map((track) => {
        const playing = source === 'file' && trackName === track.title
        return (
          <button
            key={track.id}
            type="button"
            role="menuitemradio"
            aria-checked={playing}
            disabled={loadingId !== null}
            onClick={() => void play(track)}
            className={ITEM_CLASS}
          >
            <span className="flex items-center gap-2.5 text-xs font-light text-white/85">
              <span
                className={`size-1.5 rounded-full transition-colors duration-300 ${playing ? 'bg-[var(--accent)]' : 'bg-white/15'}`}
              />
              {track.title}
            </span>
            <span className="font-mono text-[0.625rem] text-white/40 tabular-nums">
              {loadingId === track.id ? 'Loading' : track.duration}
            </span>
          </button>
        )
      })}
      <div className="mx-2.5 my-1.5 h-px bg-white/10" />
      <button
        type="button"
        role="menuitem"
        disabled={loadingId !== null}
        onClick={() => {
          onBrowse()
          onClose()
        }}
        className={ITEM_CLASS}
      >
        <span className="text-xs font-light text-white/85">Open your own file</span>
        <span className="label-caps text-white/35">Browse</span>
      </button>
    </GlassPanel>
  )
}
