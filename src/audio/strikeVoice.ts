const TAIL_SECONDS = 6.5
const PRE_DELAY_SECONDS = 0.035
/** Singing bowl partials: inharmonic ratios, each played as a slightly detuned pair that beats. */
const BOWL: readonly { ratio: number; level: number; decay: number }[] = [
  { ratio: 1, level: 1, decay: 6.5 },
  { ratio: 2.71, level: 0.42, decay: 3.8 },
  { ratio: 5.15, level: 0.16, decay: 1.9 },
  { ratio: 8.43, level: 0.05, decay: 0.9 },
]
const BEAT_HZ = 0.9
/** An open "ah": the first two formants the voice pad is filtered through. */
const FORMANTS: readonly { hertz: number; q: number; level: number }[] = [
  { hertz: 650, q: 5, level: 1 },
  { hertz: 1080, q: 7, level: 0.6 },
]

export interface StrikeMood {
  /** 0 for dark music, 1 for bright: opens the tone of the strike. */
  brightness: number
  /** 0 in silence, 1 for a loud mix: the strike rises to stay audible over it. */
  loudness: number
}

/** A long, dark hall: noise whose high end dies away faster than its body. */
function createHall(context: AudioContext): AudioBuffer {
  const rate = context.sampleRate
  const length = Math.floor(rate * TAIL_SECONDS)
  const offset = Math.floor(rate * PRE_DELAY_SECONDS)
  const hall = context.createBuffer(2, length, rate)
  for (let channel = 0; channel < 2; channel++) {
    const data = hall.getChannelData(channel)
    let smoothed = 0
    for (let i = offset; i < length; i++) {
      const t = (i - offset) / (length - offset)
      smoothed += ((Math.random() * 2 - 1) - smoothed) * (0.55 - t * 0.47)
      data[i] = smoothed * Math.pow(1 - t, 2.2) * Math.exp(-t * 1.5)
    }
  }
  return hall
}

function envelope(context: AudioContext, attack: number, peak: number, decay: number): GainNode {
  const now = context.currentTime
  const gain = context.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(peak, now + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay)
  return gain
}

function tone(context: AudioContext, type: OscillatorType, hertz: number, into: AudioNode, seconds: number): void {
  const now = context.currentTime
  const oscillator = context.createOscillator()
  oscillator.type = type
  oscillator.frequency.value = hertz
  oscillator.connect(into)
  oscillator.start(now)
  oscillator.stop(now + seconds)
  oscillator.onended = () => oscillator.disconnect()
}

/**
 * The sound of striking the sculpture: a deep singing bowl over a soft gong, with a wordless
 * voice swelling behind it, all sent into a long dark hall. Tuned and voiced by the caller
 * to sit inside whatever music is playing.
 */
export class StrikeVoice {
  private readonly dry: GainNode
  private readonly send: GainNode
  private readonly nodes: AudioNode[]

  constructor(
    private readonly context: AudioContext,
    output: AudioNode,
  ) {
    const hall = context.createConvolver()
    hall.buffer = createHall(context)
    const wet = context.createGain()
    wet.gain.value = 1.1
    this.dry = context.createGain()
    this.dry.gain.value = 0.5
    this.send = context.createGain()
    this.dry.connect(output)
    this.send.connect(hall).connect(wet).connect(output)
    this.nodes = [hall, wet, this.dry, this.send]
  }

  play(frequency: number, velocity: number, mood: StrikeMood): void {
    const { context } = this
    const level = 0.28 * Math.min(1, Math.max(0.15, velocity)) * (0.8 + mood.loudness * 1.1)
    const voice = context.createGain()
    voice.gain.value = level
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 700 + mood.brightness * 4200
    filter.Q.value = 0.4
    voice.connect(filter)
    filter.connect(this.dry)
    filter.connect(this.send)
    const spent: AudioNode[] = [voice, filter]

    for (const { ratio, level: partial, decay } of BOWL) {
      const ring = envelope(context, 0.012, partial * 0.5, decay)
      ring.connect(voice)
      spent.push(ring)
      tone(context, 'sine', frequency * ratio - BEAT_HZ * 0.5, ring, decay + 0.1)
      tone(context, 'sine', frequency * ratio + BEAT_HZ * 0.5, ring, decay + 0.1)
    }

    const gong = envelope(context, 0.06, 0.45, 4.5)
    gong.connect(voice)
    spent.push(gong)
    tone(context, 'sine', frequency / 2, gong, 4.7)

    const choir = envelope(context, 0.9, 0.05, 4.2)
    choir.connect(this.send)
    spent.push(choir)
    for (const { hertz, q, level: formant } of FORMANTS) {
      const band = context.createBiquadFilter()
      band.type = 'bandpass'
      band.frequency.value = hertz
      band.Q.value = q
      const gain = context.createGain()
      gain.gain.value = formant * level * 6
      band.connect(gain).connect(choir)
      spent.push(band, gain)
      for (const interval of [1, 1.5]) {
        tone(context, 'sawtooth', frequency * interval * 1.003, band, 5.2)
        tone(context, 'sawtooth', frequency * interval * 0.997, band, 5.2)
      }
    }

    window.setTimeout(() => spent.forEach((node) => node.disconnect()), (TAIL_SECONDS + 0.5) * 1000)
  }

  dispose(): void {
    for (const node of this.nodes) node.disconnect()
  }
}
