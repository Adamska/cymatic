export interface SampleTrack {
  id: string
  title: string
  duration: string
  url: string
}

/** Bundled tracks served from `public/tracks`, for visitors without an audio file at hand. */
export const SAMPLE_TRACKS: readonly SampleTrack[] = [
  { id: 'neon-snap', title: 'Neon Snap', duration: '0:30', url: `${import.meta.env.BASE_URL}tracks/neon-snap.mp3` },
  { id: 'street-level', title: 'Street Level', duration: '2:00', url: `${import.meta.env.BASE_URL}tracks/street-level.mp3` },
]
