import { ClampToEdgeWrapping, DataTexture, LinearFilter, RedFormat, UnsignedByteType } from 'three'

const BIN_COUNT = 48
const LOWEST_HZ = 45
const HIGHEST_HZ = 11000
const NOISE_FLOOR = 0.16
const PEAK_FLOOR = 0.3
const PEAK_RELEASE = 0.16
const ADAPTIVE_SHARE = 0.3
const ATTACK_RATE = 11
const RELEASE_RATE = 4.5
const BLUR_RADIUS = 4

export class SpectrumField {
  readonly texture: DataTexture
  mean = 0

  private readonly data = new Uint8Array(BIN_COUNT)
  private readonly levels = new Float32Array(BIN_COUNT)
  private peak = PEAK_FLOOR

  constructor() {
    this.texture = new DataTexture(this.data, BIN_COUNT, 1, RedFormat, UnsignedByteType)
    this.texture.magFilter = LinearFilter
    this.texture.minFilter = LinearFilter
    this.texture.wrapS = ClampToEdgeWrapping
    this.texture.needsUpdate = true
  }

  update(spectrum: Uint8Array, binHz: number, delta: number): void {
    const { levels, data } = this
    const span = Math.log(HIGHEST_HZ / LOWEST_HZ)
    let loudest = 0
    let total = 0

    for (let index = 0; index < BIN_COUNT; index++) {
      const first = Math.max(1, Math.floor((LOWEST_HZ * Math.exp((span * index) / BIN_COUNT)) / binHz))
      const last = Math.max(first, Math.floor((LOWEST_HZ * Math.exp((span * (index + 1)) / BIN_COUNT)) / binHz))
      let raw = 0
      for (let bin = first; bin <= last; bin++) raw = Math.max(raw, (spectrum[bin] ?? 0) / 255)
      const level = Math.max(0, (raw - NOISE_FLOOR) / (1 - NOISE_FLOOR))
      loudest = Math.max(loudest, level)

      const adaptive = Math.min(1, level / this.peak)
      const target = level + (adaptive - level) * ADAPTIVE_SHARE
      const current = levels[index] ?? 0
      const rate = target > current ? ATTACK_RATE : RELEASE_RATE
      levels[index] = current + (target - current) * (1 - Math.exp(-delta * rate))
    }
    this.peak = Math.max(loudest, this.peak - delta * PEAK_RELEASE * this.peak, PEAK_FLOOR)

    for (let index = 0; index < BIN_COUNT; index++) {
      let weighted = 0
      let weights = 0
      for (let offset = -BLUR_RADIUS; offset <= BLUR_RADIUS; offset++) {
        const weight = BLUR_RADIUS + 1 - Math.abs(offset)
        weighted += (levels[Math.min(BIN_COUNT - 1, Math.max(0, index + offset))] ?? 0) * weight
        weights += weight
      }
      const value = Math.min(1, weighted / weights)
      data[index] = Math.round(value * 255)
      total += value
    }
    this.mean = total / BIN_COUNT
    this.texture.needsUpdate = true
  }

  dispose(): void {
    this.texture.dispose()
  }
}
