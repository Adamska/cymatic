export interface AudioBands {
  sub: number
  bass: number
  mid: number
  high: number
  rms: number
  transient: number
}

type SpectralBand = 'sub' | 'bass' | 'mid' | 'high'

const BAND_LAYOUT: Record<SpectralBand, { from: number; to: number; gain: number }> = {
  sub: { from: 20, to: 70, gain: 1 },
  bass: { from: 70, to: 250, gain: 1.05 },
  mid: { from: 250, to: 2200, gain: 1.35 },
  high: { from: 2200, to: 12000, gain: 2 },
}
const SPECTRAL_BANDS = Object.keys(BAND_LAYOUT) as SpectralBand[]
const ATTACK_RATE = 22
const RELEASE_RATE = 5
const CONTRAST = 1.8
const LOW_CUTOFF_HZ = 250
const TRANSIENT_SENSITIVITY = 2.4
const TRANSIENT_FLOOR = 0.02

function follow(current: number, target: number, delta: number): number {
  const rate = target > current ? ATTACK_RATE : RELEASE_RATE
  return current + (target - current) * (1 - Math.exp(-delta * rate))
}

export class BandTracker {
  readonly bands: AudioBands = { sub: 0, bass: 0, mid: 0, high: 0, rms: 0, transient: 0 }

  private lowAverage = 0

  update(spectrum: Uint8Array, waveform: Uint8Array, binHz: number, delta: number): void {
    const { bands } = this

    for (const name of SPECTRAL_BANDS) {
      const { from, to, gain } = BAND_LAYOUT[name]
      const first = Math.max(1, Math.floor(from / binHz))
      const last = Math.min(spectrum.length - 1, Math.ceil(to / binHz))
      let sum = 0
      for (let bin = first; bin <= last; bin++) sum += spectrum[bin] ?? 0
      const level = Math.pow(Math.min(1, (sum / (last - first + 1) / 255) * gain), CONTRAST)
      bands[name] = follow(bands[name], level, delta)
    }

    let squares = 0
    for (let i = 0; i < waveform.length; i++) {
      const sample = ((waveform[i] ?? 128) - 128) / 128
      squares += sample * sample
    }
    const rms = Math.min(1, Math.sqrt(squares / waveform.length) * 2)
    bands.rms = follow(bands.rms, rms, delta)

    const lowBins = Math.min(spectrum.length, Math.ceil(LOW_CUTOFF_HZ / binHz))
    let lowEnergy = 0
    for (let bin = 1; bin < lowBins; bin++) lowEnergy += Math.pow((spectrum[bin] ?? 0) / 255, 4)
    lowEnergy /= lowBins

    const rise = (lowEnergy - this.lowAverage) / Math.max(this.lowAverage, TRANSIENT_FLOOR)
    const flux = Math.min(1, Math.max(0, rise) * TRANSIENT_SENSITIVITY)
    this.lowAverage += (lowEnergy - this.lowAverage) * (1 - Math.exp(-delta * 2.5))
    bands.transient = Math.max(bands.transient * Math.exp(-delta * 5), flux)
  }

  reset(): void {
    this.lowAverage = 0
    for (const name of Object.keys(this.bands) as (keyof AudioBands)[]) this.bands[name] = 0
  }
}
