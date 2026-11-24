import { z } from 'zod'
import type { PlaylistTrack } from './musicTypes'

const API = 'https://api.spotify.com/v1'
const PAGE_LIMIT = 50
const TRACK_LIMIT = 100

const ImageSchema = z.object({ url: z.string() })
const PlaylistSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  collaborative: z.boolean().optional(),
  owner: z.object({ id: z.string() }),
  images: z.array(ImageSchema).nullable().optional(),
})
const TrackSchema = z.object({
  type: z.string().optional(),
  id: z.string().nullable().optional(),
  name: z.string(),
  artists: z.array(z.object({ name: z.string() })),
  external_ids: z.object({ isrc: z.string().optional() }).optional(),
  album: z.object({ images: z.array(ImageSchema).optional() }).optional(),
})
const EntrySchema = z.object({ item: TrackSchema.nullable().optional(), track: TrackSchema.nullable().optional() })

export interface SpotifyPlaylist {
  id: string
  name: string
  cover: string | null
}

async function get(token: string, path: string): Promise<unknown> {
  const response = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } })
  if (response.status === 401) throw new Error('Your Spotify session expired, connect again')
  if (response.status === 403) throw new Error('This Spotify account is not allowed on the app yet')
  if (!response.ok) throw new Error('Spotify could not be reached')
  return response.json()
}

/**
 * Playlists the signed-in user owns or collaborates on. Since February 2026 the Web API
 * only returns the contents of those, so followed playlists are left out of the picker.
 */
export async function listOwnPlaylists(token: string): Promise<SpotifyPlaylist[]> {
  const me = z.object({ id: z.string() }).parse(await get(token, '/me'))
  const page = z.object({ items: z.array(z.unknown()) }).parse(await get(token, `/me/playlists?limit=${PAGE_LIMIT}`))
  return page.items
    .map((entry) => PlaylistSummarySchema.safeParse(entry))
    .flatMap((result) => (result.success ? [result.data] : []))
    .filter((playlist) => playlist.owner.id === me.id || playlist.collaborative)
    .map((playlist) => ({ id: playlist.id, name: playlist.name, cover: playlist.images?.at(-1)?.url ?? null }))
}

export async function playlistTracks(token: string, id: string): Promise<{ name: string; tracks: PlaylistTrack[] }> {
  const meta = z.object({ name: z.string() }).parse(await get(token, `/playlists/${id}?fields=name`))
  const page = z.object({ items: z.array(z.unknown()) }).parse(await get(token, `/playlists/${id}/items?limit=${PAGE_LIMIT}`))
  const tracks = page.items
    .map((entry) => EntrySchema.safeParse(entry))
    .flatMap((result) => {
      const track = result.success ? (result.data.item ?? result.data.track) : null
      if (!track || (track.type && track.type !== 'track')) return []
      return [
        {
          key: `spotify-${track.id ?? track.name}`,
          title: track.name,
          artist: track.artists.map((artist) => artist.name).join(', '),
          cover: track.album?.images?.at(-1)?.url ?? null,
          deezerId: null,
          isrc: track.external_ids?.isrc ?? null,
        },
      ]
    })
    .slice(0, TRACK_LIMIT)
  return { name: meta.name, tracks }
}
