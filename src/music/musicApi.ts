import { DeezerPlaylistSchema, DeezerTrackSchema, PreviewSchema, type DeezerPlaylist, type DeezerTrack } from './musicTypes'

const ENDPOINT = '/api/music'

export type LinkKind = { kind: 'deezer'; link: string } | { kind: 'spotify'; id: string } | { kind: 'unknown' }

/** Tells a Deezer link from a Spotify playlist link or URI. */
export function classifyLink(input: string): LinkKind {
  const trimmed = input.trim()
  const spotify = /(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?playlist\/|spotify:playlist:)([A-Za-z0-9]{22})/.exec(trimmed)
  if (spotify?.[1]) return { kind: 'spotify', id: spotify[1] }
  if (/deezer\.(com|page\.link)/.test(trimmed) || /^\d+$/.test(trimmed)) return { kind: 'deezer', link: trimmed }
  return { kind: 'unknown' }
}

async function request(query: string): Promise<unknown> {
  const response = await fetch(`${ENDPOINT}?${query}`, { signal: AbortSignal.timeout(15000) })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'error' in payload ? String(payload.error) : 'Request failed'
    throw new Error(message)
  }
  return payload
}

export async function fetchDeezerPlaylist(link: string): Promise<DeezerPlaylist> {
  return DeezerPlaylistSchema.parse(await request(`playlist=${encodeURIComponent(link)}`))
}

export async function fetchPreview(deezerId: number): Promise<Blob> {
  const { preview } = PreviewSchema.parse(await request(`track=${deezerId}`))
  const response = await fetch(preview, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error('The preview could not be downloaded')
  return response.blob()
}

export async function matchOnDeezer(title: string, artist: string, isrc: string | null): Promise<DeezerTrack | null> {
  const params = new URLSearchParams({ match: '1', title, artist })
  if (isrc) params.set('isrc', isrc)
  try {
    return DeezerTrackSchema.parse(await request(params.toString()))
  } catch {
    return null
  }
}
