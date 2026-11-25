import { bandPower, clamp01, follow, toDecibels } from './BandTracker'
import { KeyTracker, type MusicalKey } from './KeyTracker'

/** Band edges in hertz: kick body, bass line, warmth, voice, presence, air. */
const EDGES_HZ: readonly number[] = [25, 60, 160, 500, 2000, 5000, 14000]
export const BAND_COUNT = EDGES_HZ.length - 1

/** Lifts the quieter upper bands so a balanced mix reads evenly across all six. */
const TILT_DB: readonly number[] = [0, 0, 2, 4, 9, 12]
const FLOOR_DB = -56
const RANGE_DB = 40
const ENVELOPE_ATTACK = 34
const ENVELOPE_RELEASE = 9
const LEVEL_ATTACK = 10
const LEVEL_RELEASE = 3
const HABIT_RATE = 0.45
const SPREAD_RATE = 0.35
const MIN_SPREAD_DB = 2.2
const ACCENT_OFFSET = 0.35
const ACCENT_SCALE = 1.9
const PRESENCE_GATE = 0.04
const PITCH_FROM_HZ = 140
const PITCH_TO_HZ = 4200
const PITCH_RATE = 2.5
const WARMUP_SECONDS = 1.2
const WARMUP_RATE = 3
const KEY_CONFIDENCE = 0.5

/**
 * Reads music the way a listener does: not how loud each band is, but how far it rises
 * above its own recent habit. A mastered track sits near full scale in every band all the
 * time, so absolute levels barely move; the accents carry the kicks, notes and syllables.
 */
export class BandDynamics {
  /** Steady presence of each band: 0 when silent, near 1 when it dominates a loud mix. */
  readonly levels = new Float32Array(BAND_COUNT)
  /** How far each band rises above its recent average, the musical events, 0 to 1. */
  readonly accents = new Float32Array(BAND_COUNT)
  /** Log spectral centroid of the voice and lead range, 0 dark to 1 bright. */
  pitch = 0.5
  /** The key of what is playing, followed from its chroma. */
  readonly keys = new KeyTracker()
  /** Bumped on every reset, so followers can tell a new source has started. */
  generation = 0

  private heard = 0
  private readonly envelopes = new Float32Array(BAND_COUNT).fill(Number.NaN)
  private readonly habits = new Float32Array(BAND_COUNT).fill(Number.NaN)
  private readonly spreads = new Float32Array(BAND_COUNT).fill(6)

  update(spectrumDb: Float32Array, binHz: number, gainDb: number, presence: number, delta: number): void {
    const { levels, accents, envelopes, habits, spreads } = this
    const awake = presence > PRESENCE_GATE
    if (awake) this.heard += delta
    // While a new source settles, habits adapt quickly so its first second is not one long accent.
    const habitRate = HABIT_RATE + WARMUP_RATE * Math.max(0, 1 - this.heard / WARMUP_SECONDS)

    for (let band = 0; band < BAND_COUNT; band++) {
      const power = bandPower(spectrumDb, binHz, EDGES_HZ[band] ?? 0, EDGES_HZ[band + 1] ?? 0)
      const decibels = toDecibels(power) + gainDb + (TILT_DB[band] ?? 0)
      const previous = envelopes[band] ?? Number.NaN
      const envelope = Number.isNaN(previous) ? decibels : follow(previous, decibels, delta, ENVELOPE_ATTACK, ENVELOPE_RELEASE)
      envelopes[band] = envelope

      const level = clamp01((envelope - FLOOR_DB) / RANGE_DB) * Math.min(1, presence * 2.5)
      levels[band] = follow(levels[band] ?? 0, level, delta, LEVEL_ATTACK, LEVEL_RELEASE)

      let habit = habits[band] ?? Number.NaN
      let spread = spreads[band] ?? 6
      if (awake) {
        habit = Number.isNaN(habit) ? envelope : follow(habit, envelope, delta, habitRate, habitRate)
        spread = follow(spread, Math.abs(envelope - habit), delta, SPREAD_RATE, SPREAD_RATE)
        habits[band] = habit
        spreads[band] = spread
      }
      const rise = Number.isNaN(habit) ? 0 : (envelope - habit) / Math.max(MIN_SPREAD_DB, spread)
      accents[band] = clamp01((rise - ACCENT_OFFSET) / ACCENT_SCALE) * clamp01(level * 3)
    }

    if (!awake) return
    this.trackPitch(spectrumDb, binHz, delta)
    this.keys.update(spectrumDb, binHz, delta)
  }

  /** The key of the music, or null while it is still unclear. */
  get confidentKey(): MusicalKey | null {
    return this.keys.key.confidence >= KEY_CONFIDENCE ? this.keys.key : null
  }

  /** How bright the mix is right now, from its presence and air. */
  get brightness(): number {
    return clamp01(((this.levels[4] ?? 0) + (this.levels[5] ?? 0)) * 0.6)
  }

  reset(): void {
    this.levels.fill(0)
    this.accents.fill(0)
    this.envelopes.fill(Number.NaN)
    this.heard = 0
    this.generation++
    this.keys.reset()
    this.habits.fill(Number.NaN)
    this.spreads.fill(6)
    this.pitch = 0.5
  }

  private trackPitch(spectrumDb: Float32Array, binHz: number, delta: number): void {
    const first = Math.max(1, Math.floor(PITCH_FROM_HZ / binHz))
    const last = Math.min(spectrumDb.length - 1, Math.ceil(PITCH_TO_HZ / binHz))
    let weighted = 0
    let total = 0
    for (let bin = first; bin <= last; bin++) {
      const decibels = spectrumDb[bin] ?? -Infinity
      if (!Number.isFinite(decibels)) continue
      const power = 10 ** (decibels / 10)
      weighted += power * Math.log(bin * binHz)
      total += power
    }
    if (total <= 1e-10) return
    const centroid = (weighted / total - Math.log(PITCH_FROM_HZ)) / Math.log(PITCH_TO_HZ / PITCH_FROM_HZ)
    this.pitch = follow(this.pitch, clamp01(centroid * 1.4 - 0.15), delta, PITCH_RATE, PITCH_RATE)
  }
}
