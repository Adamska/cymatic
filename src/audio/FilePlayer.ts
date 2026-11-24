export interface PlaybackOptions {
  loop: boolean
  onEnded?: () => void
}

/** Plays a decoded buffer with pause, seek and position tracking on top of one-shot source nodes. */
export class FilePlayer {
  private node: AudioBufferSourceNode | null = null
  private buffer: AudioBuffer | null = null
  private startedAt = 0
  private offset = 0
  private loop = true
  private onEnded: (() => void) | undefined
  private peakCache: { count: number; peaks: Float32Array } | null = null

  constructor(
    private readonly context: AudioContext,
    private readonly output: AudioNode,
  ) {}

  get loaded(): boolean {
    return this.buffer !== null
  }

  get playing(): boolean {
    return this.node !== null
  }

  get duration(): number {
    return this.buffer?.duration ?? 0
  }

  get position(): number {
    const { duration } = this
    if (!this.node || duration === 0) return this.offset
    const elapsed = this.context.currentTime - this.startedAt
    return this.loop ? elapsed % duration : Math.min(elapsed, duration)
  }

  load(buffer: AudioBuffer, { loop, onEnded }: PlaybackOptions): void {
    this.detach()
    this.buffer = buffer
    this.loop = loop
    this.onEnded = onEnded
    this.offset = 0
    this.peakCache = null
    this.play()
  }

  play(): void {
    const { buffer, context } = this
    if (!buffer || this.node) return
    if (this.offset >= buffer.duration - 0.05) this.offset = 0
    const node = context.createBufferSource()
    node.buffer = buffer
    node.loop = this.loop
    node.connect(this.output)
    node.onended = () => {
      if (this.node !== node) return
      this.node = null
      this.offset = 0
      this.onEnded?.()
    }
    node.start(0, this.offset)
    this.startedAt = context.currentTime - this.offset
    this.node = node
  }

  pause(): void {
    if (!this.node) return
    this.offset = this.position
    this.detach()
  }

  toggle(): void {
    if (this.node) this.pause()
    else this.play()
  }

  seek(seconds: number): void {
    const resume = this.playing
    this.detach()
    this.offset = Math.min(Math.max(0, seconds), Math.max(0, this.duration - 0.05))
    if (resume) this.play()
  }

  stop(): void {
    this.detach()
    this.buffer = null
    this.offset = 0
    this.peakCache = null
  }

  /** Peak amplitude per bucket of the first channel, cached for the waveform display. */
  peaks(count: number): Float32Array {
    if (this.peakCache?.count === count) return this.peakCache.peaks
    const peaks = new Float32Array(count)
    const samples = this.buffer?.getChannelData(0)
    if (samples) {
      const size = Math.max(1, Math.floor(samples.length / count))
      for (let bucket = 0; bucket < count; bucket++) {
        let peak = 0
        for (let index = bucket * size; index < (bucket + 1) * size; index += 16) {
          peak = Math.max(peak, Math.abs(samples[index] ?? 0))
        }
        peaks[bucket] = peak
      }
    }
    this.peakCache = { count, peaks }
    return peaks
  }

  private detach(): void {
    const { node } = this
    if (!node) return
    this.node = null
    node.onended = null
    node.stop()
    node.disconnect()
  }
}
