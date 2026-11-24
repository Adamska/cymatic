const STILL_PIXEL_RATIO = 2.5
const VIDEO_BITRATE = 12_000_000
const VIDEO_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']

interface StillRequest {
  resolve: (blob: Blob | null) => void
  framesLeft: number
  restoreRatio: number
}

/** Shared between the HUD, which asks for captures, and the frame loop, which takes them. */
export const captureState = {
  canvas: null as HTMLCanvasElement | null,
  still: null as StillRequest | null,
  stillPixelRatio: STILL_PIXEL_RATIO,
}

/** Resolves with a PNG of the next frames, rendered at a raised pixel ratio. */
export function requestStill(): Promise<Blob | null> {
  if (!captureState.canvas) return Promise.resolve(null)
  return new Promise((resolve) => {
    captureState.still = { resolve, framesLeft: 2, restoreRatio: 1 }
  })
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function captureName(title: string, extension: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cue'
  return `cymatic-${slug}.${extension}`
}

/**
 * Records the canvas, with the master audio when there is one, for `seconds`.
 * Prefers MP4 where the browser can encode it, WebM otherwise.
 */
export function recordClip(audio: MediaStream | null, seconds: number): Promise<{ blob: Blob; extension: string } | null> {
  const canvas = captureState.canvas
  if (!canvas || typeof MediaRecorder === 'undefined') return Promise.resolve(null)
  const mimeType = VIDEO_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
  if (!mimeType) return Promise.resolve(null)

  const video = canvas.captureStream(60)
  const stream = new MediaStream([...video.getVideoTracks(), ...(audio?.getAudioTracks() ?? [])])
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_BITRATE })
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  return new Promise((resolve) => {
    recorder.onstop = () => {
      video.getVideoTracks().forEach((track) => track.stop())
      const type = mimeType.split(';')[0] ?? 'video/webm'
      resolve(chunks.length > 0 ? { blob: new Blob(chunks, { type }), extension: type.endsWith('mp4') ? 'mp4' : 'webm' } : null)
    }
    recorder.start(250)
    window.setTimeout(() => recorder.stop(), seconds * 1000)
  })
}
