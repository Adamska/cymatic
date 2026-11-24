import { z } from 'zod'

export const DeezerTrackSchema = z.object({
  id: z.number(),
  title: z.string(),
  artist: z.string(),
  cover: z.string().nullable(),
  duration: z.number(),
})

export const DeezerPlaylistSchema = z.object({
  title: z.string(),
  cover: z.string().nullable(),
  tracks: z.array(DeezerTrackSchema),
})

export const PreviewSchema = z.object({ preview: z.string().url() })

export type DeezerTrack = z.infer<typeof DeezerTrackSchema>
export type DeezerPlaylist = z.infer<typeof DeezerPlaylistSchema>

export type PlaylistOrigin = 'deezer' | 'spotify'

/** A track in the queue. Spotify tracks gain a Deezer id once matched for their preview. */
export interface PlaylistTrack {
  key: string
  title: string
  artist: string
  cover: string | null
  deezerId: number | null
  isrc: string | null
}
