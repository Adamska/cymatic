import { usePlaylistStore } from '../../store/usePlaylistStore'

/** The imported queue: covers, titles, the track on air and the one loading. */
export function PlaylistQueue() {
  const tracks = usePlaylistStore((state) => state.tracks)
  const index = usePlaylistStore((state) => state.index)
  const loadingIndex = usePlaylistStore((state) => state.loadingIndex)
  const play = usePlaylistStore((state) => state.play)

  return (
    <ol className="-mx-1.5 mt-2 max-h-[32vh] space-y-0.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
      {tracks.map((track, position) => {
        const current = position === index
        const loading = position === loadingIndex
        return (
          <li key={track.key}>
            <button
              type="button"
              onClick={() => void play(position)}
              aria-current={current}
              className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition-colors duration-200 hover:bg-white/8 ${
                current ? 'bg-white/10' : ''
              }`}
            >
              {track.cover ? (
                <img src={track.cover} alt="" loading="lazy" className="size-8 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="size-8 shrink-0 rounded-md bg-white/10" />
              )}
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-xs ${current ? 'text-white' : 'font-light text-white/80'}`}>{track.title}</span>
                <span className="block truncate text-[0.68rem] font-light text-white/40">{track.artist}</span>
              </span>
              <span className={`label-caps shrink-0 ${current ? 'text-[var(--color-accent)]' : 'text-white/25'}`}>
                {loading ? 'Loading' : current ? 'On air' : position + 1}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
