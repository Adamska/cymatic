import { useState, type FormEvent } from 'react'
import { spotifyAvailable, usePlaylistStore } from '../../store/usePlaylistStore'
import { useUiStore } from '../../store/useUiStore'
import { GlassPanel } from './GlassPanel'
import { PlaylistQueue } from './PlaylistQueue'

const PILL = 'label-caps h-8 shrink-0 cursor-pointer rounded-full bg-white/10 px-3.5 text-white/85 transition-colors hover:bg-white/18 disabled:cursor-wait disabled:text-white/35'

function SpotifySection() {
  const connected = usePlaylistStore((state) => state.spotifyConnected)
  const playlists = usePlaylistStore((state) => state.spotifyPlaylists)
  const busy = usePlaylistStore((state) => state.busy)
  const { connectSpotify, importSpotify, disconnectSpotify } = usePlaylistStore.getState()

  if (!spotifyAvailable) return null
  if (!connected) {
    return (
      <button type="button" onClick={() => void connectSpotify()} className={`${PILL} mt-3 w-full`}>
        Connect Spotify
      </button>
    )
  }
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <span className="label-caps text-white/40">Your Spotify playlists</span>
        <button type="button" onClick={disconnectSpotify} className="label-caps cursor-pointer text-white/30 hover:text-white/70">
          Sign out
        </button>
      </div>
      <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto">
        {playlists.length === 0 && <li className="py-1.5 text-xs font-light text-white/40">No playlist of yours yet.</li>}
        {playlists.map((playlist) => (
          <li key={playlist.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void importSpotify(playlist)}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-1.5 py-1 text-left text-xs font-light text-white/80 hover:bg-white/8"
            >
              {playlist.cover ? <img src={playlist.cover} alt="" className="size-7 rounded-md object-cover" /> : <span className="size-7 rounded-md bg-white/10" />}
              <span className="truncate">{playlist.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Imports a playlist and plays its 30 second previews back to back. */
export function PlaylistPanel() {
  const open = useUiStore((state) => state.panel === 'playlist')
  const openPanel = useUiStore((state) => state.openPanel)
  const title = usePlaylistStore((state) => state.title)
  const origin = usePlaylistStore((state) => state.origin)
  const busy = usePlaylistStore((state) => state.busy)
  const error = usePlaylistStore((state) => state.error)
  const { importLink, clear } = usePlaylistStore.getState()
  const [link, setLink] = useState('')

  if (!open) return null

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (link.trim()) void importLink(link)
  }

  return (
    <GlassPanel
      className="absolute inset-x-3 top-24 z-20 max-h-[calc(100dvh-12rem)] overflow-y-auto rounded-3xl px-4 py-4 sm:inset-x-auto sm:top-1/2 sm:left-5 sm:w-80 sm:-translate-y-1/2"
      role="dialog"
      aria-label="Playlist import"
    >
      <div className="flex items-center justify-between">
        <h2 className="label-caps text-white/85">{title ? 'Playlist' : 'Import a playlist'}</h2>
        <button type="button" onClick={() => openPanel(null)} className="label-caps cursor-pointer text-white/45 hover:text-white">
          Close
        </button>
      </div>

      {title ? (
        <>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-light text-white/90">{title}</p>
            <button type="button" onClick={clear} className="label-caps shrink-0 cursor-pointer text-white/35 hover:text-white/80">
              Change
            </button>
          </div>
          <p className="label-caps mt-0.5 text-white/30">{origin === 'spotify' ? 'From Spotify, matched on Deezer' : 'From Deezer'}</p>
          <PlaylistQueue />
        </>
      ) : (
        <>
          <form onSubmit={onSubmit} className="mt-3 flex gap-2">
            <input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder={spotifyAvailable ? 'Paste a Deezer or Spotify playlist link' : 'Paste a Deezer playlist link'}
              aria-label="Playlist link"
              className="h-8 min-w-0 flex-1 rounded-full bg-white/6 px-3.5 text-xs font-light text-white/90 outline-none placeholder:text-white/35 focus:bg-white/10"
            />
            <button type="submit" disabled={busy} className={PILL}>
              {busy ? 'Loading' : 'Import'}
            </button>
          </form>
          <p className="mt-2.5 text-[0.7rem] leading-relaxed font-light text-white/40">
            Any public Deezer playlist works. {spotifyAvailable ? 'For Spotify, connect and pick one of your own playlists.' : ''}
          </p>
          <SpotifySection />
        </>
      )}

      {error && <p className="mt-3 text-[0.7rem] font-light text-[#ff9b9b]">{error}</p>}
      <p className="mt-3 border-t border-white/10 pt-2.5 text-[0.65rem] font-light text-white/30">
        30 second previews provided by{' '}
        <a href="https://www.deezer.com" target="_blank" rel="noreferrer" className="underline decoration-white/20 hover:text-white/70">
          Deezer
        </a>
        .
      </p>
    </GlassPanel>
  )
}
