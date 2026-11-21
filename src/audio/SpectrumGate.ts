const BYTE_FLOOR_DB = -100
const BYTE_RANGE_DB = 70
const NOISE_CAP_DB = -78
const NOISE_CREEP_DB = 1.5
const NOISE_DROP_DB = 18
const NOISE_MARGIN_DB = 3
const NOISE_OPEN_DB = 9
const DIGITAL_SILENCE_DB = -140

/**
 * Turns raw analyser decibels into the leveled byte spectrum the visuals read.
 * Each bin tracks its own noise floor so a boosted microphone does not paint hiss.
 */
export class SpectrumGate {
  private readonly floors: Float32Array

  constructor(binCount: number) {
    this.floors = new Float32Array(binCount).fill(NOISE_CAP_DB)
  }

  apply(spectrumDb: Float32Array, gainDb: number, delta: number, target: Uint8Array): void {
    const { floors } = this
    const creep = NOISE_CREEP_DB * delta
    const drop = NOISE_DROP_DB * delta
    const offset = gainDb - BYTE_FLOOR_DB

    for (let bin = 0; bin < target.length; bin++) {
      const decibels = spectrumDb[bin] ?? -Infinity
      if (!(decibels > DIGITAL_SILENCE_DB)) {
        target[bin] = 0
        continue
      }
      const floor = floors[bin] ?? NOISE_CAP_DB
      const gap = decibels - floor
      const next = Math.min(NOISE_CAP_DB, floor + (gap < 0 ? Math.max(gap, -drop) : Math.min(gap, creep)))
      floors[bin] = next
      const gate = Math.min(1, Math.max(0, (decibels - next - NOISE_MARGIN_DB) / NOISE_OPEN_DB))
      const level = ((decibels + offset) / BYTE_RANGE_DB) * gate
      target[bin] = level > 0 ? Math.min(255, Math.round(level * 255)) : 0
    }
  }

  reset(): void {
    this.floors.fill(NOISE_CAP_DB)
  }
}
