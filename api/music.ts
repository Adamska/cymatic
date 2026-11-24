import { z } from 'zod'
import type { DeezerPlaylist, DeezerTrack } from '../src/music/musicTypes'

export const config = { runtime: 'edge' }

const DEEZER = 'https://api.deezer.com'
const TRACK_LIMIT = 100
const SHORT_LINK_HOSTS = new Set(['link.deezer.com', 'deezer.page.link'])

const RawTrackSchema = z.object({
  id: z.number(),
  title: z.string(),
  duration: z.number().optional(),
  readable: z.boolean().optional(),
  preview: z.string().optional(),
  artist: z.object({ name: z.string() }),
  album: z.object({ cover_small: z.string().optional() }).optional(),
})
const RawPlaylistSchema = z.object({
  title: z.string(),
  picture_medium: z.string().optional(),
  tracks: z.object({ data: z.array(z.unknown()) }),
})
const RawSearchSchema = z.object({ data: z.array(z.unknown()) })

type RawTrack = z.infer<typeof RawTrackSchema>

function json(body: unknown, status = 200, cache = 'no-store'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': cache } })
}

async function deezer(path: string): Promise<unknown> {
  const response = await fetch(`${DEEZER}${path}`, { signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`Deezer answered ${response.status}`)
  const payload: unknown = await response.json()
  if (typeof payload === 'object' && payload !== null && 'error' in payload) throw new Error('Deezer reported an error')
  return payload
}

function toTrack(raw: RawTrack): DeezerTrack {
  return { id: raw.id, title: raw.title, artist: raw.artist.name, cover: raw.album?.cover_small ?? null, duration: raw.duration ?? 30 }
}

const playable = (raw: RawTrack): boolean => raw.readable !== false && Boolean(raw.preview)

/** Accepts a bare id, a deezer.com playlist URL, or a short share link that redirects to one. */
async function resolvePlaylistId(input: string): Promise<string | null> {
  const trimmed = input.trim()
  if (/^\d+$/.test(trimmed)) return trimmed
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (SHORT_LINK_HOSTS.has(url.hostname)) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(6000) })
    const location = response.headers.get('location')
    return location && !SHORT_LINK_HOSTS.has(new URL(location, url).hostname) ? resolvePlaylistId(new URL(location, url).toString()) : null
  }
  if (!url.hostname.endsWith('deezer.com')) return null
  return /\/playlist\/(\d+)/.exec(url.pathname)?.[1] ?? null
}

async function playlist(input: string): Promise<Response> {
  const id = await resolvePlaylistId(input)
  if (!id) return json({ error: 'That is not a Deezer playlist link' }, 400)
  const raw = RawPlaylistSchema.parse(await deezer(`/playlist/${id}`))
  const tracks = raw.tracks.data
    .map((entry) => RawTrackSchema.safeParse(entry))
    .flatMap((result) => (result.success && playable(result.data) ? [toTrack(result.data)] : []))
    .slice(0, TRACK_LIMIT)
  const body: DeezerPlaylist = { title: raw.title, cover: raw.picture_medium ?? null, tracks }
  return json(body, 200, 'public, s-maxage=300')
}

/** Preview links are signed and expire, so they are always fetched right before playback. */
async function preview(id: string): Promise<Response> {
  if (!/^\d+$/.test(id)) return json({ error: 'Invalid track id' }, 400)
  const raw = RawTrackSchema.parse(await deezer(`/track/${id}`))
  return raw.preview ? json({ preview: raw.preview }) : json({ error: 'No preview for this track' }, 404)
}

/** Finds the Deezer twin of a Spotify track, by ISRC first, by artist and title otherwise. */
async function match(params: URLSearchParams): Promise<Response> {
  const isrc = params.get('isrc')
  if (isrc && /^[A-Z0-9]{12}$/i.test(isrc)) {
    const byIsrc = RawTrackSchema.safeParse(await deezer(`/track/isrc:${isrc}`).catch(() => null))
    if (byIsrc.success && playable(byIsrc.data)) return json(toTrack(byIsrc.data), 200, 'public, s-maxage=86400')
  }
  const title = (params.get('title') ?? '').slice(0, 120)
  const artist = (params.get('artist') ?? '').slice(0, 120)
  if (!title) return json({ error: 'A title is required' }, 400)
  const query = encodeURIComponent(`artist:"${artist}" track:"${title}"`)
  const search = RawSearchSchema.parse(await deezer(`/search?q=${query}&limit=5`))
  const found = search.data.map((entry) => RawTrackSchema.safeParse(entry)).find((result) => result.success && playable(result.data))
  return found?.success ? json(toTrack(found.data), 200, 'public, s-maxage=86400') : json({ error: 'No match on Deezer' }, 404)
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  const params = new URL(request.url).searchParams
  try {
    const playlistInput = params.get('playlist')
    if (playlistInput) return await playlist(playlistInput)
    const track = params.get('track')
    if (track) return await preview(track)
    if (params.has('match')) return await match(params)
    return json({ error: 'Pass playlist, track or match' }, 400)
  } catch (error) {
    console.error('Music lookup failed', error)
    return json({ error: 'Deezer could not be reached' }, 502)
  }
}
