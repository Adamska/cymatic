import type { MusicalKey } from './KeyTracker'

/** One octave of each pentatonic scale: open and modal, they sit over almost any chord of the key. */
const MINOR_SCALE: readonly number[] = [0, 3, 5, 7, 10]
const MAJOR_SCALE: readonly number[] = [0, 2, 4, 7, 9]
/** The tonic is folded into the octave from C2, so strikes ring low and deep. */
const LOWEST_TONIC_HZ = 65.4
/** Steps of the scale the form can reach, from the base to the crown. */
const REACH = 8
/** Repeated strikes walk this small motif, from the note the struck point gives. */
const MOTIF: readonly number[] = [0, 2, 1, 3, -1, 4, 2, 5]
const PHRASE_RESET_MS = 2500

const phrase = { index: -1, last: Number.NEGATIVE_INFINITY }

function fold(hertz: number): number {
  let folded = hertz
  while (folded < LOWEST_TONIC_HZ) folded *= 2
  while (folded >= LOWEST_TONIC_HZ * 2) folded /= 2
  return folded
}

/**
 * The pitch of a strike: a step of the pentatonic scale of the key that is playing, chosen
 * by height on the form, low at the base and high at the crown. Strikes in quick succession
 * walk a short motif from there; after a pause the phrase starts over. Without a confident
 * key the scale is built on the drone of the synth.
 */
export function strikePitch(height: number, key: MusicalKey | null, droneHz: number, now = performance.now()): number {
  phrase.index = now - phrase.last > PHRASE_RESET_MS ? 0 : phrase.index + 1
  phrase.last = now

  const scale = key && !key.minor ? MAJOR_SCALE : MINOR_SCALE
  const position = Math.min(0.999, Math.max(0, (height + 1) / 2))
  const base = Math.floor(position * REACH)
  const step = Math.max(-2, base + (MOTIF[phrase.index % MOTIF.length] ?? 0))
  const octave = Math.floor(step / scale.length)
  const semitones = (scale[step - octave * scale.length] ?? 0) + octave * 12
  const tonicHz = key ? 440 * 2 ** ((key.tonic - 9) / 12) : droneHz
  return fold(tonicHz) * 2 ** (semitones / 12)
}
