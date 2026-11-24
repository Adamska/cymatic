import { z } from 'zod'

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SCOPES = 'playlist-read-private playlist-read-collaborative'
const VERIFIER_KEY = 'cymatic.spotify.verifier'
const TOKEN_KEY = 'cymatic.spotify.token'

const StoredTokenSchema = z.object({ access: z.string(), refresh: z.string().nullable(), expiresAt: z.number() })
const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
})

type StoredToken = z.infer<typeof StoredTokenSchema>

export const spotifyClientId: string = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? ''

const redirectUri = (): string => `${window.location.origin}/`

function storage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Starts the Authorization Code flow with PKCE: no client secret ever reaches the browser. */
export async function beginSpotifyLogin(): Promise<void> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)))
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  storage()?.setItem(VERIFIER_KEY, verifier)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: spotifyClientId,
    scope: SCOPES,
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })
  window.location.assign(`${AUTHORIZE_URL}?${params.toString()}`)
}

async function requestToken(body: URLSearchParams): Promise<StoredToken> {
  const response = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
  if (!response.ok) throw new Error('Spotify refused the sign-in')
  const payload = TokenResponseSchema.parse(await response.json())
  const token: StoredToken = {
    access: payload.access_token,
    refresh: payload.refresh_token ?? null,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 - 60_000,
  }
  storage()?.setItem(TOKEN_KEY, JSON.stringify(token))
  return token
}

/** Finishes a login when Spotify redirects back with `?code=`, then cleans the address bar. */
export async function completeSpotifyLogin(): Promise<boolean> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const verifier = storage()?.getItem(VERIFIER_KEY)
  if (!code && !url.searchParams.has('error')) return false
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  url.searchParams.delete('error')
  window.history.replaceState(null, '', url.toString())
  if (!code || !verifier) return false
  storage()?.removeItem(VERIFIER_KEY)
  await requestToken(
    new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), client_id: spotifyClientId, code_verifier: verifier }),
  )
  return true
}

/** A valid access token, refreshed when it has expired, or null when signed out. */
export async function spotifyToken(): Promise<string | null> {
  const raw = storage()?.getItem(TOKEN_KEY)
  if (!raw) return null
  const parsed = StoredTokenSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) return null
  const token = parsed.data
  if (Date.now() < token.expiresAt) return token.access
  if (!token.refresh) return null
  try {
    const fresh = await requestToken(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refresh, client_id: spotifyClientId }))
    return fresh.access
  } catch {
    storage()?.removeItem(TOKEN_KEY)
    return null
  }
}

export function signOutOfSpotify(): void {
  storage()?.removeItem(TOKEN_KEY)
}
