/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional Spotify app client id. Enables importing your own Spotify playlists. */
  readonly VITE_SPOTIFY_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
