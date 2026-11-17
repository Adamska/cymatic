export interface SynthPatch {
  rootHz: number
  intervals: readonly number[]
  filterCutoff: number
  resonance: number
  lfoRate: number
  subLevel: number
}

const VOICE_COUNT = 4
const DETUNE_CENTS = 9
const GLIDE_SECONDS = 0.9
const REVERB_SECONDS = 3.2

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

function createImpulseResponse(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * REVERB_SECONDS)
  const impulse = context.createBuffer(2, length, context.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6)
    }
  }
  return impulse
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function createPulseCurve(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(1024)
  for (let i = 0; i < curve.length; i++) {
    const phase = i / (curve.length - 1)
    curve[i] = Math.min(1, phase / 0.03) * Math.pow(1 - phase, 4)
  }
  return curve
}

export class AmbientSynth {
  readonly output: GainNode

  private readonly sources: AudioScheduledSourceNode[] = []
  private readonly nodes: AudioNode[] = []
  private readonly sub: OscillatorNode
  private readonly subOctave: OscillatorNode
  private readonly subGain: GainNode
  private readonly pulseClock: OscillatorNode
  private readonly voices: OscillatorNode[][] = []
  private readonly filter: BiquadFilterNode
  private readonly lfo: OscillatorNode
  private readonly lfoDepth: GainNode
  private readonly airClock: OscillatorNode

  constructor(
    private readonly context: AudioContext,
    patch: SynthPatch,
  ) {
    this.output = this.track(context.createGain())
    this.output.gain.value = 0.9

    const reverb = this.track(context.createConvolver())
    reverb.buffer = createImpulseResponse(context)
    const wet = this.gain(0.42)
    reverb.connect(wet).connect(this.output)

    this.subGain = this.gain(0)
    this.subGain.connect(this.output)
    this.sub = this.oscillator('sine')
    this.sub.connect(this.subGain)
    this.subOctave = this.oscillator('triangle')
    this.subOctave.connect(this.gain(0.22)).connect(this.subGain)

    const pulse = this.gain(0)
    const pulseShape = this.track(context.createWaveShaper())
    pulseShape.curve = createPulseCurve()
    this.pulseClock = this.oscillator('sawtooth')
    this.pulseClock.connect(pulseShape).connect(pulse.gain)
    this.subOctave.connect(pulse).connect(this.subGain)

    this.filter = this.track(context.createBiquadFilter())
    this.filter.type = 'lowpass'
    const padBus = this.gain(0.5)
    this.filter.connect(padBus)
    padBus.connect(this.output)
    padBus.connect(reverb)

    this.lfo = this.oscillator('sine')
    this.lfoDepth = this.gain(0)
    this.lfo.connect(this.lfoDepth).connect(this.filter.frequency)

    for (let index = 0; index < VOICE_COUNT; index++) {
      const panner = this.track(context.createStereoPanner())
      panner.pan.value = (index / (VOICE_COUNT - 1)) * 1.4 - 0.7
      const voiceGain = this.gain(0.16 - index * 0.02)
      voiceGain.connect(panner).connect(this.filter)
      const pair = [-DETUNE_CENTS, DETUNE_CENTS].map((cents) => {
        const oscillator = this.oscillator('sawtooth')
        oscillator.detune.value = cents + index * 1.5
        oscillator.connect(voiceGain)
        return oscillator
      })
      this.voices.push(pair)
    }

    const air = this.track(context.createBufferSource())
    air.buffer = createNoiseBuffer(context)
    air.loop = true
    const airBand = this.track(context.createBiquadFilter())
    airBand.type = 'bandpass'
    airBand.frequency.value = 6200
    airBand.Q.value = 0.8
    const airGain = this.gain(0.012)
    this.airClock = this.oscillator('sine')
    this.airClock.connect(this.gain(0.01)).connect(airGain.gain)
    air.connect(airBand).connect(airGain)
    airGain.connect(this.output)
    airGain.connect(reverb)
    this.sources.push(air)

    this.apply(patch, 0.01)
    for (const source of this.sources) source.start()
  }

  apply(patch: SynthPatch, glide = GLIDE_SECONDS): void {
    const now = this.context.currentTime
    const root = clamp(patch.rootHz, 28, 120)
    const cutoff = clamp(patch.filterCutoff, 120, 8000)
    const lfoRate = clamp(patch.lfoRate, 0.01, 4)
    const intervals = patch.intervals.length > 0 ? patch.intervals : [0]

    this.sub.frequency.setTargetAtTime(root, now, glide)
    this.subOctave.frequency.setTargetAtTime(root * 2, now, glide)
    this.subGain.gain.setTargetAtTime(0.5 * clamp(patch.subLevel, 0, 1), now, glide)
    this.pulseClock.frequency.setTargetAtTime(clamp(lfoRate * 3, 0.3, 1.4), now, glide)

    this.voices.forEach((pair, index) => {
      const semitones = (intervals[index % intervals.length] ?? 0) + 12 * Math.floor(index / intervals.length)
      const frequency = root * 2 * Math.pow(2, semitones / 12)
      for (const oscillator of pair) oscillator.frequency.setTargetAtTime(frequency, now, glide)
    })

    this.filter.frequency.setTargetAtTime(cutoff, now, glide)
    this.filter.Q.setTargetAtTime(clamp(patch.resonance, 0.1, 14), now, glide)
    this.lfo.frequency.setTargetAtTime(lfoRate, now, glide)
    this.lfoDepth.gain.setTargetAtTime(cutoff * 0.6, now, glide)
    this.airClock.frequency.setTargetAtTime(lfoRate * 1.7, now, glide)
  }

  dispose(): void {
    for (const source of this.sources) {
      source.stop()
      source.disconnect()
    }
    for (const node of this.nodes) node.disconnect()
    this.sources.length = 0
    this.nodes.length = 0
  }

  private track<T extends AudioNode>(node: T): T {
    this.nodes.push(node)
    return node
  }

  private gain(value: number): GainNode {
    const node = this.track(this.context.createGain())
    node.gain.value = value
    return node
  }

  private oscillator(type: OscillatorType): OscillatorNode {
    const node = this.context.createOscillator()
    node.type = type
    this.sources.push(node)
    return node
  }
}
