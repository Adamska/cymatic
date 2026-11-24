import { SceneDirectiveSchema, type SceneDirective } from '../ai/directiveSchema'

const PARAM = 'cue'
const PRECISION = 1000

const round = (_key: string, value: unknown): unknown => (typeof value === 'number' ? Math.round(value * PRECISION) / PRECISION : value)

function toBase64Url(text: string): string {
  let binary = ''
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(code: string): string {
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
}

/** A link that reopens the studio on this exact cue: palette, rig, optics and synth patch. */
export function shareUrl(directive: SceneDirective): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = `${PARAM}=${toBase64Url(JSON.stringify(directive, round))}`
  return url.toString()
}

/** The cue carried by the current URL, validated against the directive schema. */
export function readSharedDirective(): SceneDirective | null {
  const code = new URLSearchParams(window.location.hash.slice(1)).get(PARAM)
  if (!code) return null
  try {
    const parsed = SceneDirectiveSchema.safeParse(JSON.parse(fromBase64Url(code)))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
