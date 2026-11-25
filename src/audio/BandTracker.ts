export interface AudioBands {
  sub: number
  bass: number
  mid: number
  high: number
  rms: number
  transient: number
  sparkle: number
  impact: number
}

type SpectralBand = 'sub' | 'bass' | 'mid' | 'high'

const BAND_LAYOUT: Record<SpectralBand, { from: number; to: number; trim: number }> = {
  sub: { from: 20, to: 80, trim: 0 },
  bass: { from: 80, to: 300, trim: 0 },
  mid: { from: 300, to: 2500, trim: 3 },
  high: { from: 2500, to: 11000, trim: 8 },
}
const SPECTRAL_BANDS = Object.keys(BAND_LAYOUT) as SpectralBand[]

const TARGET_DB = -14
const MAX_BOOST_DB = 36
const LEVELING_SHARE = 0.9
const REFERENCE_START_DB = -30
const REFERENCE_RISE = 2
const REFERENCE_FALL = 0.08
const CALIBRATION_RATE = 2.4
const CALIBRATION_SECONDS = 2.5
const ACTIVITY_GATE_DB = 18
const SILENCE_DB = -58
const LOUDNESS_FLOOR_DB = -40
const LOUDNESS_CEILING_DB = -8
const BAND_FLOOR_DB = -52
const BAND_CEILING_DB = -14
const NOISE_CAP_DB = -58
const NOISE_CREEP_DB = 1.5
const NOISE_DROP_DB = 18
const NOISE_MARGIN_DB = 3
const NOISE_OPEN_DB = 9
const DIGITAL_SILENCE_DB = -110
const ONSET_DB = 10
const ONSET_RANGE_DB = 14
const IMPACT_DB = 6
const IMPACT_RANGE_DB = 10
const KICK_CUTOFF_HZ = 90
const SPARKLE_FROM_HZ = 4000

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))
export const toDecibels = (power: number): number => 10 * Math.log10(power + 1e-12)

export function follow(current: number, target: number, delta: number, attack: number, release: number): number {
  const rate = target > current ? attack : release
  return current + (target - current) * (1 - Math.exp(-delta * rate))
}

export function bandPower(spectrumDb: Float32Array, binHz: number, from: number, to: number): number {
  const first = Math.max(1, Math.floor(from / binHz))
  const last = Math.min(spectrumDb.length - 1, Math.ceil(to / binHz))
  let power = 0
  for (let bin = first; bin <= last; bin++) {
    const decibels = spectrumDb[bin] ?? -Infinity
    if (Number.isFinite(decibels)) power += 10 ** (decibels / 10)
  }
  return power
}

class NoiseFloor {
  private floor = NOISE_CAP_DB

  gate(decibels: number, delta: number): number {
    if (decibels <= DIGITAL_SILENCE_DB) return 0
    const gap = decibels - this.floor
    const step = gap < 0 ? Math.max(gap, -NOISE_DROP_DB * delta) : Math.min(gap, NOISE_CREEP_DB * delta)
    this.floor = Math.min(NOISE_CAP_DB, this.floor + step)
    return clamp01((decibels - this.floor - NOISE_MARGIN_DB) / NOISE_OPEN_DB)
  }

  reset(): void {
    this.floor = NOISE_CAP_DB
  }
}

class OnsetDetector {
  private average = -100

  constructor(
    private readonly threshold = ONSET_DB,
    private readonly range = ONSET_RANGE_DB,
  ) {}

  update(decibels: number, presence: number, delta: number): number {
    const rise = decibels - this.average
    this.average = follow(this.average, decibels, delta, 3, 3)
    return clamp01((rise - this.threshold) / this.range) * presence
  }

  reset(): void {
    this.average = -100
  }
}

export class BandTracker {
  readonly bands: AudioBands = { sub: 0, bass: 0, mid: 0, high: 0, rms: 0, transient: 0, sparkle: 0, impact: 0 }
  gainDb = 0

  private referenceDb = REFERENCE_START_DB

  private elapsed = 0
  private readonly noise: Record<SpectralBand | 'loudness', NoiseFloor> = {
    sub: new NoiseFloor(),
    bass: new NoiseFloor(),
    mid: new NoiseFloor(),
    high: new NoiseFloor(),
    loudness: new NoiseFloor(),
  }
  private readonly kick = new OnsetDetector()
  private readonly snap = new OnsetDetector()
  private readonly impact = new OnsetDetector(IMPACT_DB, IMPACT_RANGE_DB)

  update(spectrumDb: Float32Array, waveform: Float32Array, binHz: number, delta: number): void {
    const { bands, noise } = this

    let squares = 0
    for (let i = 0; i < waveform.length; i++) squares += (waveform[i] ?? 0) ** 2
    const loudnessDb = toDecibels(squares / waveform.length)
    this.level(loudnessDb, delta)

    const gain = this.gainDb
    const loudness = clamp01((loudnessDb + gain - LOUDNESS_FLOOR_DB) / (LOUDNESS_CEILING_DB - LOUDNESS_FLOOR_DB))
    const presence = loudness * noise.loudness.gate(loudnessDb, delta)
    bands.rms = follow(bands.rms, presence, delta, 14, 6)
    const impact = this.impact.update(loudnessDb + gain, Math.min(1, presence * 1.6), delta)
    bands.impact = Math.max(bands.impact * Math.exp(-delta * 6), impact)

    for (const name of SPECTRAL_BANDS) {
      const { from, to, trim } = BAND_LAYOUT[name]
      const bandDb = toDecibels(bandPower(spectrumDb, binHz, from, to)) + trim
      const level = clamp01((bandDb + gain - BAND_FLOOR_DB) / (BAND_CEILING_DB - BAND_FLOOR_DB))
      bands[name] = follow(bands[name], level * noise[name].gate(bandDb, delta), delta, 22, 9)
    }

    const kickDb = toDecibels(bandPower(spectrumDb, binHz, 20, KICK_CUTOFF_HZ)) + gain
    const snapDb = toDecibels(bandPower(spectrumDb, binHz, SPARKLE_FROM_HZ, 14000)) + gain + BAND_LAYOUT.high.trim
    const kick = this.kick.update(kickDb, clamp01((kickDb - BAND_FLOOR_DB) / 18), delta)
    const snap = this.snap.update(snapDb, clamp01((snapDb - BAND_FLOOR_DB) / 18), delta)
    bands.transient = Math.max(bands.transient * Math.exp(-delta * 4), kick)
    bands.sparkle = Math.max(bands.sparkle * Math.exp(-delta * 7), snap)
  }

  recalibrate(): void {
    this.elapsed = 0
    this.referenceDb = REFERENCE_START_DB
    for (const floor of Object.values(this.noise)) floor.reset()
  }

  reset(): void {
    this.recalibrate()
    this.gainDb = 0
    this.kick.reset()
    this.snap.reset()
    this.impact.reset()
    for (const name of Object.keys(this.bands) as (keyof AudioBands)[]) this.bands[name] = 0
  }

  private level(loudnessDb: number, delta: number): void {
    this.elapsed += delta
    const calibrating = this.elapsed < CALIBRATION_SECONDS
    const gate = calibrating ? SILENCE_DB : Math.max(SILENCE_DB, this.referenceDb - ACTIVITY_GATE_DB)
    if (loudnessDb > gate) {
      const rise = calibrating ? CALIBRATION_RATE : REFERENCE_RISE
      const fall = calibrating ? CALIBRATION_RATE : REFERENCE_FALL
      this.referenceDb = follow(this.referenceDb, loudnessDb, delta, rise, fall)
    }
    const boost = Math.min(MAX_BOOST_DB, Math.max(0, TARGET_DB - this.referenceDb)) * LEVELING_SHARE
    this.gainDb = follow(this.gainDb, boost, delta, 1.5, 1.5)
  }
}
