import { follow } from './BandTracker'

/** Krumhansl-Schmuckler key profiles, from the tonic upward. */
const MAJOR_PROFILE: readonly number[] = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE: readonly number[] = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
/** Below this the analyser bins are wider than a semitone and blur the pitch classes. */
const LOWEST_HZ = 180
const HIGHEST_HZ = 2100
const CHROMA_RATE = 0.18
const ESTIMATE_SECONDS = 0.25
const SWITCH_MARGIN = 0.06
/** A bin counts as a tone only if it stands this far above its neighbourhood, so drums add nothing. */
const PEAK_PROMINENCE_DB = 6
const NEIGHBOURHOOD = 4

export interface MusicalKey {
  /** Pitch class of the tonic, 0 for C up to 11 for B. */
  tonic: number
  minor: boolean
  /** Correlation with the best key profile; below about 0.5 the guess is unreliable. */
  confidence: number
}

function correlate(chroma: Float32Array, profile: readonly number[], tonic: number): number {
  let meanChroma = 0
  let meanProfile = 0
  for (let index = 0; index < 12; index++) {
    meanChroma += (chroma[index] ?? 0) / 12
    meanProfile += (profile[index] ?? 0) / 12
  }
  let product = 0
  let chromaSpread = 0
  let profileSpread = 0
  for (let index = 0; index < 12; index++) {
    const a = (chroma[(index + tonic) % 12] ?? 0) - meanChroma
    const b = (profile[index] ?? 0) - meanProfile
    product += a * b
    chromaSpread += a * a
    profileSpread += b * b
  }
  return product / Math.sqrt(chromaSpread * profileSpread + 1e-12)
}

/**
 * Follows the key of whatever is playing: a slow chroma, energy per pitch class, compared
 * with the 24 major and minor key profiles a few times a second, with some hysteresis.
 */
export class KeyTracker {
  readonly key: MusicalKey = { tonic: 9, minor: true, confidence: 0 }

  private readonly chroma = new Float32Array(12)
  private readonly frame = new Float32Array(12)
  private classes = new Int8Array(0)
  private mappedBinHz = 0
  private sinceEstimate = 0

  update(spectrumDb: Float32Array, binHz: number, delta: number): void {
    if (binHz !== this.mappedBinHz || this.classes.length !== spectrumDb.length) this.mapBins(spectrumDb.length, binHz)
    const { frame, chroma, classes } = this
    frame.fill(0)
    let total = 0
    for (let bin = 0; bin < classes.length; bin++) {
      const pitchClass = classes[bin] ?? -1
      const decibels = spectrumDb[bin] ?? -Infinity
      if (pitchClass < 0 || !Number.isFinite(decibels) || !this.isPeak(spectrumDb, bin, decibels)) continue
      const magnitude = 10 ** (decibels / 20)
      frame[pitchClass] = (frame[pitchClass] ?? 0) + magnitude
      total += magnitude
    }
    if (total <= 1e-8) return
    for (let index = 0; index < 12; index++) {
      chroma[index] = follow(chroma[index] ?? 0, (frame[index] ?? 0) / total, delta, CHROMA_RATE, CHROMA_RATE)
    }

    this.sinceEstimate += delta
    if (this.sinceEstimate >= ESTIMATE_SECONDS) {
      this.sinceEstimate = 0
      this.estimate()
    }
  }

  reset(): void {
    this.chroma.fill(0)
    this.key.confidence = 0
  }

  private estimate(): void {
    const { key, chroma } = this
    let best = { tonic: key.tonic, minor: key.minor, score: -1 }
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const minor of [false, true]) {
        const score = correlate(chroma, minor ? MINOR_PROFILE : MAJOR_PROFILE, tonic)
        if (score > best.score) best = { tonic, minor, score }
      }
    }
    const current = correlate(chroma, key.minor ? MINOR_PROFILE : MAJOR_PROFILE, key.tonic)
    if (best.score > current + SWITCH_MARGIN || key.confidence === 0) {
      key.tonic = best.tonic
      key.minor = best.minor
      key.confidence = best.score
    } else {
      key.confidence = current
    }
  }

  private isPeak(spectrumDb: Float32Array, bin: number, decibels: number): boolean {
    if (decibels < (spectrumDb[bin - 1] ?? -Infinity) || decibels < (spectrumDb[bin + 1] ?? -Infinity)) return false
    let surround = 0
    for (let offset = 2; offset <= NEIGHBOURHOOD; offset++) {
      surround += (spectrumDb[bin - offset] ?? decibels) + (spectrumDb[bin + offset] ?? decibels)
    }
    return decibels - surround / ((NEIGHBOURHOOD - 1) * 2) >= PEAK_PROMINENCE_DB
  }

  private mapBins(count: number, binHz: number): void {
    this.mappedBinHz = binHz
    this.classes = new Int8Array(count).fill(-1)
    for (let bin = 1; bin < count; bin++) {
      const hertz = bin * binHz
      if (hertz < LOWEST_HZ || hertz > HIGHEST_HZ) continue
      const midi = Math.round(69 + 12 * Math.log2(hertz / 440))
      this.classes[bin] = ((midi % 12) + 12) % 12
    }
  }
}
