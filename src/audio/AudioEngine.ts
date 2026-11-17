import { AmbientSynth, type SynthPatch } from './AmbientSynth'
import { BandTracker, type AudioBands } from './BandTracker'

export type AudioSourceKind = 'synth' | 'file' | 'microphone'

interface AudioGraph {
  context: AudioContext
  analyser: AnalyserNode
  bus: GainNode
  limiter: DynamicsCompressorNode
  master: GainNode
  synth: AmbientSynth
  synthGain: GainNode
}

const FFT_SIZE = 4096
const FADE_SECONDS = 0.35
const RESUME_TIMEOUT_MS = 400
const DEFAULT_PATCH: SynthPatch = {
  rootHz: 55,
  intervals: [0, 7, 12, 16],
  filterCutoff: 1400,
  resonance: 4,
  lfoRate: 0.12,
  subLevel: 0.7,
}

export class AudioEngine {
  readonly spectrum = new Uint8Array(FFT_SIZE / 2)

  private readonly waveform = new Uint8Array(FFT_SIZE)
  private readonly tracker = new BandTracker()
  private graph: AudioGraph | null = null
  private fileNode: AudioBufferSourceNode | null = null
  private microphoneNode: MediaStreamAudioSourceNode | null = null
  private microphoneStream: MediaStream | null = null
  private patch: SynthPatch = DEFAULT_PATCH
  private volume = 0.8

  get bands(): AudioBands {
    return this.tracker.bands
  }

  get sampleRate(): number {
    return this.graph?.context.sampleRate ?? 48000
  }

  async engage(): Promise<void> {
    await this.ensureGraph()
    this.useSynth()
  }

  useSynth(): void {
    this.releaseExternalSources()
    this.fadeSynth(1)
  }

  async playFile(file: File): Promise<void> {
    const { context, bus } = await this.ensureGraph()
    const buffer = await context.decodeAudioData(await file.arrayBuffer())
    this.releaseExternalSources()
    this.fadeSynth(0)
    const node = context.createBufferSource()
    node.buffer = buffer
    node.loop = true
    node.connect(bus)
    node.start()
    this.fileNode = node
  }

  async useMicrophone(): Promise<void> {
    const { context, analyser } = await this.ensureGraph()
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
    this.releaseExternalSources()
    this.fadeSynth(0)
    this.microphoneStream = stream
    this.microphoneNode = context.createMediaStreamSource(stream)
    this.microphoneNode.connect(analyser)
  }

  applyPatch(patch: SynthPatch): void {
    this.patch = patch
    this.graph?.synth.apply(patch)
  }

  setVolume(volume: number): void {
    this.volume = volume
    this.graph?.master.gain.setTargetAtTime(volume, this.graph.context.currentTime, 0.05)
  }

  update(delta: number): void {
    if (!this.graph) return
    this.graph.analyser.getByteFrequencyData(this.spectrum)
    this.graph.analyser.getByteTimeDomainData(this.waveform)
    this.tracker.update(this.spectrum, this.waveform, this.sampleRate / FFT_SIZE, delta)
  }

  dispose(): void {
    this.releaseExternalSources()
    if (this.graph) {
      const { context, analyser, bus, limiter, master, synth, synthGain } = this.graph
      synth.dispose()
      for (const node of [synthGain, bus, analyser, limiter, master]) node.disconnect()
      void context.close()
      this.graph = null
    }
    this.spectrum.fill(0)
    this.tracker.reset()
  }

  private async ensureGraph(): Promise<AudioGraph> {
    this.graph ??= this.createGraph()
    const { context } = this.graph
    if (context.state === 'suspended') {
      const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, RESUME_TIMEOUT_MS))
      await Promise.race([context.resume(), timeout])
      if (context.state === 'suspended') {
        window.addEventListener('pointerdown', () => void context.resume(), { once: true })
      }
    }
    return this.graph
  }

  private createGraph(): AudioGraph {
    const context = new AudioContext({ latencyHint: 'playback' })
    const analyser = context.createAnalyser()
    analyser.fftSize = FFT_SIZE
    analyser.smoothingTimeConstant = 0.6

    const bus = context.createGain()
    const limiter = context.createDynamicsCompressor()
    limiter.threshold.value = -9
    limiter.knee.value = 12
    limiter.ratio.value = 8
    limiter.attack.value = 0.004
    limiter.release.value = 0.25
    const master = context.createGain()
    master.gain.value = this.volume
    bus.connect(analyser)
    bus.connect(limiter).connect(master).connect(context.destination)

    const synthGain = context.createGain()
    synthGain.gain.value = 0
    const synth = new AmbientSynth(context, this.patch)
    synth.output.connect(synthGain).connect(bus)

    return { context, analyser, bus, limiter, master, synth, synthGain }
  }

  private fadeSynth(level: number): void {
    if (!this.graph) return
    this.graph.synthGain.gain.setTargetAtTime(level, this.graph.context.currentTime, FADE_SECONDS)
  }

  private releaseExternalSources(): void {
    this.fileNode?.stop()
    this.fileNode?.disconnect()
    this.fileNode = null
    this.microphoneNode?.disconnect()
    this.microphoneNode = null
    this.microphoneStream?.getTracks().forEach((track) => track.stop())
    this.microphoneStream = null
  }
}

export const audioEngine = new AudioEngine()
