import { create } from 'zustand'
import { classifyLink, fetchDeezerPlaylist, fetchPreview, matchOnDeezer } from '../music/musicApi'
import type { PlaylistOrigin, PlaylistTrack } from '../music/musicTypes'
import { listOwnPlaylists, playlistTracks, type SpotifyPlaylist } from '../music/spotifyApi'
import { beginSpotifyLogin, completeSpotifyLogin, signOutOfSpotify, spotifyClientId, spotifyToken } from '../music/spotifyAuth'
import { useStudioStore } from './useStudioStore'
import { useUiStore } from './useUiStore'

interface PlaylistState {
  title: string | null
  origin: PlaylistOrigin | null
  tracks: readonly PlaylistTrack[]
  index: number
  loadingIndex: number | null
  busy: boolean
  error: string | null
  spotifyConnected: boolean
  spotifyPlaylists: readonly SpotifyPlaylist[]
  importLink: (link: string) => Promise<void>
  importSpotify: (playlist: SpotifyPlaylist) => Promise<void>
  play: (index: number) => Promise<void>
  step: (direction: 1 | -1) => void
  clear: () => void
  connectSpotify: () => Promise<void>
  restoreSpotify: () => Promise<void>
  disconnectSpotify: () => void
}

/** Spotify import is built but hidden until the integration is ready to ship. */
const SPOTIFY_ENABLED = false

export const spotifyAvailable = SPOTIFY_ENABLED && spotifyClientId.length > 0
let playRequest = 0

const failure = (error: unknown): string => (error instanceof Error ? error.message : 'Something went wrong')

export const usePlaylistStore = create<PlaylistState>()((set, get) => ({
  title: null,
  origin: null,
  tracks: [],
  index: -1,
  loadingIndex: null,
  busy: false,
  error: null,
  spotifyConnected: false,
  spotifyPlaylists: [],

  importLink: async (link) => {
    const parsed = classifyLink(link)
    if (parsed.kind === 'spotify' && !spotifyAvailable) {
      set({ error: 'Paste a Deezer playlist link' })
      return
    }
    if (parsed.kind === 'spotify') {
      const owned = get().spotifyPlaylists.find((playlist) => playlist.id === parsed.id)
      if (owned) return get().importSpotify(owned)
      if (!get().spotifyConnected) {
        set({ error: 'Connect Spotify first, then pick one of your playlists' })
        return
      }
      return get().importSpotify({ id: parsed.id, name: 'Spotify playlist', cover: null })
    }
    if (parsed.kind === 'unknown') {
      set({ error: spotifyAvailable ? 'Paste a Deezer or Spotify playlist link' : 'Paste a Deezer playlist link' })
      return
    }
    set({ busy: true, error: null })
    try {
      const playlist = await fetchDeezerPlaylist(parsed.link)
      if (playlist.tracks.length === 0) throw new Error('This playlist has no playable previews')
      const tracks = playlist.tracks.map((track) => ({ ...track, key: `deezer-${track.id}`, deezerId: track.id, isrc: null }))
      set({ title: playlist.title, origin: 'deezer', tracks, index: -1, busy: false })
      void get().play(0)
    } catch (error) {
      set({ busy: false, error: failure(error) })
    }
  },

  importSpotify: async (playlist) => {
    set({ busy: true, error: null })
    try {
      const token = await spotifyToken()
      if (!token) throw new Error('Connect Spotify again')
      const { name, tracks } = await playlistTracks(token, playlist.id)
      if (tracks.length === 0) throw new Error('Only playlists you own or collaborate on can be read')
      set({ title: name, origin: 'spotify', tracks, index: -1, busy: false })
      void get().play(0)
    } catch (error) {
      set({ busy: false, error: failure(error) })
    }
  },

  play: async (index) => {
    const track = get().tracks[index]
    if (!track) return
    const request = ++playRequest
    set({ loadingIndex: index, error: null })
    try {
      let deezerId = track.deezerId
      if (deezerId === null) {
        deezerId = (await matchOnDeezer(track.title, track.artist, track.isrc))?.id ?? null
        if (deezerId === null) throw new Error(`No preview found for ${track.title}`)
        set({ tracks: get().tracks.map((entry, position) => (position === index ? { ...entry, deezerId } : entry)) })
      }
      const blob = await fetchPreview(deezerId)
      if (request !== playRequest) return
      const started = await useStudioStore.getState().playBlob(blob, `${track.artist} - ${track.title}`, {
        loop: false,
        onEnded: () => get().step(1),
      })
      if (started) set({ index, loadingIndex: null })
    } catch (error) {
      if (request !== playRequest) return
      set({ loadingIndex: null, error: failure(error) })
      if (index + 1 < get().tracks.length) window.setTimeout(() => void get().play(index + 1), 900)
    }
  },

  step: (direction) => {
    const { tracks, index } = get()
    if (tracks.length === 0) return
    void get().play((index + direction + tracks.length) % tracks.length)
  },

  clear: () => set({ title: null, origin: null, tracks: [], index: -1, error: null }),

  connectSpotify: async () => {
    if (!spotifyAvailable) return set({ error: 'Set VITE_SPOTIFY_CLIENT_ID to enable Spotify' })
    await beginSpotifyLogin()
  },

  restoreSpotify: async () => {
    if (!spotifyAvailable) return
    try {
      const returning = await completeSpotifyLogin()
      const token = await spotifyToken()
      if (!token) return
      const spotifyPlaylists = await listOwnPlaylists(token)
      set({ spotifyConnected: true, spotifyPlaylists })
      if (returning) useUiStore.getState().openPanel('playlist')
    } catch (error) {
      set({ spotifyConnected: false, error: failure(error) })
    }
  },

  disconnectSpotify: () => {
    signOutOfSpotify()
    set({ spotifyConnected: false, spotifyPlaylists: [] })
  },
}))
